import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../i18n";
import { processImageViaWorker } from "../lib/imageWorkerClient.ts";
import { translateProcessingError } from "../lib/processingErrors.ts";
import type { ImageInfo, ImageTask, ProcessingOptions } from "../lib/types.ts";

export interface UseImageTaskQueueResult {
  tasks: ImageTask[];
  enqueueFiles: (files: File[]) => void;
  clearAll: () => void;
}

export function useImageTaskQueue(
  options: ProcessingOptions,
): UseImageTaskQueueResult {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<ImageTask[]>([]);

  const fileMapRef = useRef<Map<string, File>>(new Map());
  const activeProcessingIdRef = useRef<string | null>(null);
  const generationRef = useRef(0);

  const updateTask = useCallback(
    (id: string, updater: (task: ImageTask) => ImageTask): void => {
      setTasks((previous) =>
        previous.map((task) => (task.id === id ? updater(task) : task)),
      );
    },
    [],
  );

  const enqueueFiles = useCallback((files: File[]) => {
    if (!files.length) {
      return;
    }

    setTasks((previous) => {
      const now = Date.now();
      const newTasks: ImageTask[] = files.map((file) => {
        const id = createId();
        fileMapRef.current.set(id, file);
        return {
          id,
          fileName: file.name,
          status: "queued",
          createdAt: now,
        } satisfies ImageTask;
      });
      return [...previous, ...newTasks];
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
    const hasProcessing = tasks.some((task) => task.status === "processing");
    if (hasProcessing || activeProcessingIdRef.current) {
      return;
    }

    const next = tasks.find((task) => task.status === "queued");
    if (!next) {
      return;
    }

    const { id } = next;
    const file = fileMapRef.current.get(id);
    if (!file) {
      updateTask(id, (task) => ({
        ...task,
        status: "error",
        errorMessage: t("status.error.unknown"),
        completedAt: Date.now(),
      }));
      return;
    }

    activeProcessingIdRef.current = id;
    const currentGeneration = generationRef.current;

    updateTask(id, (task) => ({ ...task, status: "processing" }));

    const run = async () => {
      const globalWithTestHook = globalThis as typeof globalThis & {
        __processingDelayMsForTest?: number | null;
      };

      const delayMs = globalWithTestHook.__processingDelayMsForTest;
      if (typeof delayMs === "number" && delayMs > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, delayMs);
        });
      }

      try {
        const { source, result } = await processImageViaWorker(
          file,
          options,
          file.name,
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
          source,
          result,
          errorMessage: undefined,
          completedAt: Date.now(),
        }));
        fileMapRef.current.delete(id);
      } catch (error) {
        if (generationRef.current !== currentGeneration) {
          return;
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
        }));
        fileMapRef.current.delete(id);
      } finally {
        if (generationRef.current === currentGeneration) {
          activeProcessingIdRef.current = null;
        }
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

function createId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
