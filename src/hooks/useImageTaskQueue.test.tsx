import {
  act,
  createRef,
  forwardRef,
  type RefObject,
  useImperativeHandle,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import type { ImageInfo, ProcessingOptions } from "../lib/types.ts";
import {
  type UseImageTaskQueueResult,
  useImageTaskQueue,
} from "./useImageTaskQueue.ts";

const processImageViaWorkerMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/imageWorkerClient.ts", () => ({
  processImageViaWorker: processImageViaWorkerMock,
}));

const baseOptions: ProcessingOptions = {
  presetId: null,
  targetWidth: null,
  targetHeight: null,
  lockAspectRatio: false,
  resizeMode: "fit",
  outputFormat: "auto",
  quality: null,
  stripMetadata: false,
};

const Harness = forwardRef<UseImageTaskQueueResult>((_, ref) => {
  const queue = useImageTaskQueue(baseOptions);
  useImperativeHandle(ref, () => queue, [queue]);
  return null;
});

Harness.displayName = "Harness";

function renderHookWithProvider(
  ref: RefObject<UseImageTaskQueueResult | null>,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <I18nProvider>
        <Harness ref={ref} />
      </I18nProvider>,
    );
  });
  return { root, container } as const;
}

function createProcessResult(name: string): {
  source: ImageInfo;
  result: ImageInfo;
} {
  const blob = new Blob([name], { type: "image/png" });
  const base: ImageInfo = {
    blob,
    url: `blob:${name}`,
    width: 1,
    height: 1,
    mimeType: "image/png",
    fileSize: blob.size,
    sourceName: name,
    metadataStripped: false,
  };
  return { source: base, result: { ...base, url: `blob:${name}-result` } };
}

function createFile(name: string): File {
  if (typeof File !== "undefined") {
    return new File([name], name, { type: "image/png" });
  }
  return Object.assign(new Blob([name], { type: "image/png" }), {
    name,
  }) as File;
}

async function waitForCondition(predicate: () => boolean, timeoutMs = 1_000) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (predicate()) {
      return;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function createDeferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  let reject: ((reason?: unknown) => void) | undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  if (!resolve || !reject) {
    throw new Error("Deferred not initialized");
  }
  return { promise, resolve, reject } as const;
}

describe("useImageTaskQueue", () => {
  let ref: React.RefObject<UseImageTaskQueueResult | null>;
  let root: Root;
  let container: HTMLElement;

  beforeEach(() => {
    ref = createRef<UseImageTaskQueueResult | null>();
    ({ root, container } = renderHookWithProvider(ref));
    processImageViaWorkerMock.mockReset();
    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL = vi.fn();
    }
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("enqueues files and processes them sequentially", async () => {
    const first = createFile("first.png");
    const second = createFile("second.png");

    const firstDeferred = createDeferred<{
      source: ImageInfo;
      result: ImageInfo;
    }>();

    processImageViaWorkerMock
      .mockImplementationOnce(async (_file: File) => firstDeferred.promise)
      .mockImplementationOnce(async (file: File) =>
        createProcessResult(file.name),
      );

    await act(async () => {
      ref.current?.enqueueFiles([first, second]);
    });

    await waitForCondition(
      () => processImageViaWorkerMock.mock.calls.length === 1,
    );

    await act(async () => {
      firstDeferred.resolve(createProcessResult("first.png"));
    });

    await waitForCondition(() =>
      Boolean(ref.current?.tasks[0]?.status === "done"),
    );

    await waitForCondition(
      () => processImageViaWorkerMock.mock.calls.length === 2,
    );

    await waitForCondition(() =>
      Boolean(ref.current?.tasks[1]?.status === "done"),
    );

    const tasks = ref.current?.tasks ?? [];
    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.fileName).toBe("first.png");
    expect(tasks[0]?.status).toBe("done");
    expect(tasks[1]?.fileName).toBe("second.png");
    expect(tasks[1]?.status).toBe("done");
  });

  it("continues after a failed task", async () => {
    const files = [
      createFile("a.png"),
      createFile("b.png"),
      createFile("c.png"),
    ];

    processImageViaWorkerMock
      .mockImplementationOnce(async (file: File) =>
        createProcessResult(file.name),
      )
      .mockImplementationOnce(async () => {
        throw new Error("image.tooLarge");
      })
      .mockImplementationOnce(async (file: File) =>
        createProcessResult(file.name),
      );

    await act(async () => {
      ref.current?.enqueueFiles(files);
    });

    await waitForCondition(
      () => processImageViaWorkerMock.mock.calls.length === 3,
    );

    await waitForCondition(() =>
      (ref.current?.tasks ?? []).every(
        (task) => task.status === "done" || task.status === "error",
      ),
    );

    const tasks = ref.current?.tasks ?? [];
    expect(tasks.map((t) => t.status)).toEqual(["done", "error", "done"]);
    expect(tasks[1]?.errorMessage).toMatch(/too large/i);
    expect(processImageViaWorkerMock).toHaveBeenCalledTimes(3);
  });

  it("clearAll empties tasks and revokes URLs", async () => {
    const revokeSpy = vi.spyOn(globalThis.URL, "revokeObjectURL");

    processImageViaWorkerMock.mockImplementation(async (file: File) =>
      createProcessResult(file.name),
    );

    await act(async () => {
      ref.current?.enqueueFiles([createFile("x.png"), createFile("y.png")]);
    });

    await waitForCondition(() =>
      (ref.current?.tasks ?? []).every((task) => task.status === "done"),
    );

    await act(async () => {
      ref.current?.clearAll();
    });

    expect(ref.current?.tasks ?? []).toHaveLength(0);
    expect(revokeSpy).toHaveBeenCalledTimes(4);
  });
});
