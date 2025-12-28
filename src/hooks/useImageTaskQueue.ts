import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../i18n";
import {
  processImageViaWorker,
  resetImageWorker,
} from "../lib/imageWorkerClient.ts";
import { translateProcessingError } from "../lib/processingErrors.ts";
import type { ImageInfo, ImageTask, ProcessingOptions } from "../lib/types.ts";

export interface UseImageTaskQueueResult {
  tasks: ImageTask[];
  enqueueFiles: (files: File[]) => void;
  clearAll: () => void;
}

const DEFAULT_SOURCE_READ_TIMEOUT_MS = 30_000;
const DEFAULT_PROCESSING_TIMEOUT_MS = 120_000;

export function useImageTaskQueue(
  options: ProcessingOptions,
): UseImageTaskQueueResult {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<ImageTask[]>([]);

  const fileMapRef = useRef<Map<string, File>>(new Map());
  const activeProcessingIdRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const lastOptionsKeyRef = useRef<string | null>(null);

  const updateTask = useCallback(
    (id: string, updater: (task: ImageTask) => ImageTask): void => {
      setTasks((previous) =>
        previous.map((task) => (task.id === id ? updater(task) : task)),
      );
    },
    [],
  );

  const bumpGeneration = useCallback(() => {
    generationRef.current += 1;
    const nextGeneration = generationRef.current;

    setTasks((previous) =>
      previous.map((task) => {
        const shouldResetState =
          task.status === "processing" || task.status === "error";

        return {
          ...task,
          desiredGeneration: nextGeneration,
          status: shouldResetState ? "queued" : task.status,
          errorMessage: shouldResetState ? undefined : task.errorMessage,
          completedAt: shouldResetState ? undefined : task.completedAt,
        };
      }),
    );
  }, []);

  const enqueueFiles = useCallback((files: File[]) => {
    if (!files.length) {
      return;
    }

    setTasks((previous) => {
      const now = Date.now();
      const desiredGeneration = generationRef.current;
      const newTasks: ImageTask[] = files.map((file) => {
        const id = createId();
        fileMapRef.current.set(id, file);
        return {
          id,
          fileName: file.name,
          status: "queued",
          createdAt: now,
          desiredGeneration,
        } satisfies ImageTask;
      });
      // Newest batch first; preserve in-batch file order.
      return [...newTasks, ...previous];
    });
  }, []);

  const clearAll = useCallback(() => {
    generationRef.current += 1;
    activeProcessingIdRef.current = null;

    setTasks((previous) => {
      previous.forEach((task) => {
        revokeImageInfo(task.source);
        revokeImageInfo(task.result);
      });
      return [];
    });

    fileMapRef.current.clear();
  }, []);

  useEffect(() => {
    const key = optionsKey(options);
    if (lastOptionsKeyRef.current === null) {
      lastOptionsKeyRef.current = key;
      return;
    }
    if (lastOptionsKeyRef.current === key) {
      return;
    }
    lastOptionsKeyRef.current = key;
    bumpGeneration();
  }, [bumpGeneration, options]);

  useEffect(() => {
    const hasProcessing = tasks.some((task) => task.status === "processing");
    if (hasProcessing || activeProcessingIdRef.current) {
      return;
    }

    const currentGeneration = generationRef.current;

    const next = tasks.find(
      (task) =>
        task.status !== "processing" &&
        task.desiredGeneration === currentGeneration &&
        task.attemptGeneration !== currentGeneration,
    );
    if (!next) {
      return;
    }

    const { id } = next;
    const file = fileMapRef.current.get(id);
    if (!file) {
      const currentGeneration = generationRef.current;
      updateTask(id, (task) => ({
        ...task,
        status: "error",
        errorMessage: t("status.error.unknown"),
        completedAt: Date.now(),
        attemptGeneration: currentGeneration,
      }));
      return;
    }

    activeProcessingIdRef.current = id;

    updateTask(id, (task) => ({ ...task, status: "processing" }));

    const run = async () => {
      const globalWithTestHook = globalThis as typeof globalThis & {
        __processingDelayMsForTest?: number | null;
        __processingTimeoutMsForTest?: number | null;
        __sourceReadTimeoutMsForTest?: number | null;
      };

      const delayMs = globalWithTestHook.__processingDelayMsForTest;
      if (typeof delayMs === "number" && delayMs > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, delayMs);
        });
      }

      const sourceReadTimeoutMs =
        typeof globalWithTestHook.__sourceReadTimeoutMsForTest === "number" &&
        globalWithTestHook.__sourceReadTimeoutMsForTest > 0
          ? globalWithTestHook.__sourceReadTimeoutMsForTest
          : DEFAULT_SOURCE_READ_TIMEOUT_MS;

      const processingTimeoutMs =
        typeof globalWithTestHook.__processingTimeoutMsForTest === "number" &&
        globalWithTestHook.__processingTimeoutMsForTest > 0
          ? globalWithTestHook.__processingTimeoutMsForTest
          : DEFAULT_PROCESSING_TIMEOUT_MS;

      try {
        await probeFileReadable(file, sourceReadTimeoutMs);

        let didTimeout = false;
        const processingPromise = processImageViaWorker(
          file,
          options,
          file.name,
        ).then((value) => {
          if (didTimeout) {
            // If processing finishes after we've already timed out, revoke any
            // created object URLs immediately to avoid leaking blob URLs.
            revokeImageInfo(value.source);
            revokeImageInfo(value.result);
          }
          return value;
        });

        const { source, result } = await withTimeout(
          processingPromise,
          processingTimeoutMs,
          new Error("image.processingTimeout"),
          () => {
            didTimeout = true;
          },
        );

        const cancelled =
          generationRef.current !== currentGeneration ||
          activeProcessingIdRef.current !== id;
        if (cancelled) {
          revokeImageInfo(source);
          revokeImageInfo(result);
          return;
        }

        updateTask(id, (task) => ({
          ...task,
          status: "done",
          source: (() => {
            revokeImageInfo(task.source);
            return source;
          })(),
          result: (() => {
            revokeImageInfo(task.result);
            return result;
          })(),
          errorMessage: undefined,
          completedAt: Date.now(),
          attemptGeneration: currentGeneration,
          resultGeneration: currentGeneration,
        }));
      } catch (error) {
        if (generationRef.current !== currentGeneration) {
          return;
        }

        if (
          error instanceof Error &&
          error.message === "image.processingTimeout"
        ) {
          resetImageWorker(error);
        }

        const message =
          error instanceof Error
            ? translateProcessingError(error, t)
            : t("status.error.unknown");
        updateTask(id, (task) => ({
          ...task,
          status: "error",
          errorMessage: message,
          completedAt: Date.now(),
          attemptGeneration: currentGeneration,
        }));
      } finally {
        if (activeProcessingIdRef.current === id) {
          activeProcessingIdRef.current = null;
        }
        // If we discarded a result due to generation changes, there may have
        // been no state update to re-trigger scheduling. Force a harmless
        // rerender so the queue can pick up any pending work.
        setTasks((previous) => [...previous]);
      }
    };

    void run();
  }, [options, t, tasks, updateTask]);

  const result = useMemo<UseImageTaskQueueResult>(
    () => ({ tasks, enqueueFiles, clearAll }),
    [tasks, enqueueFiles, clearAll],
  );

  return result;
}

export function getLastCompletedTask(
  tasks: ImageTask[],
): ImageTask | undefined {
  return [...tasks]
    .filter((task) => task.status === "done")
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0];
}

function revokeImageInfo(info: ImageInfo | undefined) {
  if (info) {
    URL.revokeObjectURL(info.url);
  }
}

function optionsKey(options: ProcessingOptions): string {
  return [
    options.presetId ?? "",
    options.targetWidth ?? "",
    options.targetHeight ?? "",
    options.lockAspectRatio ? "1" : "0",
    options.resizeMode,
    options.outputFormat,
    options.quality ?? "",
    options.stripMetadata ? "1" : "0",
  ].join("|");
}

async function probeFileReadable(file: File, timeoutMs: number): Promise<void> {
  try {
    const probe = file.slice(0, 1);
    if (typeof probe.arrayBuffer !== "function") {
      return;
    }
    await withTimeout(
      probe.arrayBuffer(),
      timeoutMs,
      new Error("image.sourceReadTimeout"),
    );
  } catch {
    throw new Error("image.sourceReadTimeout");
  }
}

async function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  error: Error,
  onTimeout?: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function createId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
