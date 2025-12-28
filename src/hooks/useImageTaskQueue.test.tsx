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
const resetImageWorkerMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/imageWorkerClient.ts", () => ({
  processImageViaWorker: processImageViaWorkerMock,
  resetImageWorker: resetImageWorkerMock,
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

const Harness = forwardRef<
  UseImageTaskQueueResult,
  { options: ProcessingOptions }
>(({ options }, ref) => {
  const queue = useImageTaskQueue(options);
  useImperativeHandle(ref, () => queue, [queue]);
  return null;
});

Harness.displayName = "Harness";

function renderHookWithProvider(
  ref: RefObject<UseImageTaskQueueResult | null>,
  options: ProcessingOptions,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = (nextOptions: ProcessingOptions) => {
    act(() => {
      root.render(
        <I18nProvider>
          <Harness ref={ref} options={nextOptions} />
        </I18nProvider>,
      );
    });
  };

  render(options);

  return { root, container, render } as const;
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
  let render: (options: ProcessingOptions) => void;

  beforeEach(() => {
    ref = createRef<UseImageTaskQueueResult | null>();
    ({ root, container, render } = renderHookWithProvider(ref, baseOptions));
    processImageViaWorkerMock.mockReset();
    resetImageWorkerMock.mockReset();
    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL = vi.fn();
    }
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    delete (
      globalThis as typeof globalThis & {
        __processingTimeoutMsForTest?: number;
      }
    ).__processingTimeoutMsForTest;
    delete (
      globalThis as typeof globalThis & {
        __sourceReadTimeoutMsForTest?: number;
      }
    ).__sourceReadTimeoutMsForTest;
  });

  it("inserts newest batch at the top while preserving file order", async () => {
    processImageViaWorkerMock.mockImplementation(
      async () => new Promise(() => {}),
    );

    await act(async () => {
      ref.current?.enqueueFiles([createFile("a.png"), createFile("b.png")]);
    });

    await act(async () => {
      ref.current?.enqueueFiles([
        createFile("c.png"),
        createFile("d.png"),
        createFile("e.png"),
      ]);
    });

    const tasks = ref.current?.tasks ?? [];
    expect(tasks.map((t) => t.fileName)).toEqual([
      "c.png",
      "d.png",
      "e.png",
      "a.png",
      "b.png",
    ]);
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

  it("reprocesses all tasks when output-affecting options change", async () => {
    const file = createFile("x.png");

    processImageViaWorkerMock
      .mockImplementationOnce(async (f: File) => createProcessResult(f.name))
      .mockImplementationOnce(async (f: File) =>
        createProcessResult(`${f.name}-second`),
      );

    await act(async () => {
      ref.current?.enqueueFiles([file]);
    });

    await waitForCondition(() => ref.current?.tasks[0]?.status === "done");
    expect(processImageViaWorkerMock).toHaveBeenCalledTimes(1);
    expect(ref.current?.tasks[0]?.resultGeneration).toBe(0);
    expect(ref.current?.tasks[0]?.attemptGeneration).toBe(0);

    render({ ...baseOptions, targetWidth: 123 });

    await waitForCondition(
      () => ref.current?.tasks[0]?.desiredGeneration === 1,
    );
    await waitForCondition(
      () => processImageViaWorkerMock.mock.calls.length === 2,
    );
    await waitForCondition(() => ref.current?.tasks[0]?.resultGeneration === 1);

    const task = ref.current?.tasks[0];
    expect(task?.status).toBe("done");
    expect(task?.attemptGeneration).toBe(1);
    expect(task?.resultGeneration).toBe(1);
    expect(task?.result?.url).toBe("blob:x.png-second-result");
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

  it("does not retry a failure within the same generation", async () => {
    const file = createFile("fail.png");

    processImageViaWorkerMock.mockImplementationOnce(async () => {
      throw new Error("image.tooLarge");
    });

    await act(async () => {
      ref.current?.enqueueFiles([file]);
    });

    await waitForCondition(() => ref.current?.tasks[0]?.status === "error");
    expect(processImageViaWorkerMock).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(processImageViaWorkerMock).toHaveBeenCalledTimes(1);
    expect(ref.current?.tasks[0]?.attemptGeneration).toBe(0);

    // A settings change (new generation) permits retry.
    processImageViaWorkerMock.mockImplementationOnce(async (f: File) =>
      createProcessResult(`${f.name}-recovered`),
    );
    render({ ...baseOptions, outputFormat: "image/png" });

    await waitForCondition(
      () => processImageViaWorkerMock.mock.calls.length === 2,
    );
    await waitForCondition(() => ref.current?.tasks[0]?.status === "done");
    expect(ref.current?.tasks[0]?.attemptGeneration).toBe(1);
    expect(ref.current?.tasks[0]?.resultGeneration).toBe(1);
  });

  it("discards late-arriving results from an old generation", async () => {
    const revokeSpy = vi.spyOn(globalThis.URL, "revokeObjectURL");

    const deferred = createDeferred<{ source: ImageInfo; result: ImageInfo }>();

    processImageViaWorkerMock
      .mockImplementationOnce(async () => deferred.promise)
      .mockImplementationOnce(async () => createProcessResult("new"));

    await act(async () => {
      ref.current?.enqueueFiles([createFile("late.png")]);
    });

    await waitForCondition(
      () => processImageViaWorkerMock.mock.calls.length === 1,
    );

    render({ ...baseOptions, stripMetadata: true });

    await waitForCondition(
      () => ref.current?.tasks[0]?.desiredGeneration === 1,
    );

    await act(async () => {
      deferred.resolve(createProcessResult("old"));
    });

    await waitForCondition(
      () => processImageViaWorkerMock.mock.calls.length === 2,
    );
    await waitForCondition(() => ref.current?.tasks[0]?.status === "done");

    const task = ref.current?.tasks[0];
    expect(task?.resultGeneration).toBe(1);
    expect(task?.result?.url).toBe("blob:new-result");
    // We revoke both URLs from the discarded old generation output.
    expect(revokeSpy).toHaveBeenCalledWith("blob:old");
    expect(revokeSpy).toHaveBeenCalledWith("blob:old-result");
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

  it("marks a task as error on timeout and continues", async () => {
    const first = createFile("first.png");
    const second = createFile("second.png");

    processImageViaWorkerMock
      .mockImplementationOnce(async () => new Promise(() => {}))
      .mockImplementationOnce(async (file: File) =>
        createProcessResult(file.name),
      );

    (
      globalThis as typeof globalThis & {
        __processingTimeoutMsForTest?: number;
      }
    ).__processingTimeoutMsForTest = 20;

    await act(async () => {
      ref.current?.enqueueFiles([first, second]);
    });

    await waitForCondition(
      () => processImageViaWorkerMock.mock.calls.length === 1,
      500,
    );

    await waitForCondition(
      () => ref.current?.tasks[0]?.status === "error",
      500,
    );

    await waitForCondition(
      () => processImageViaWorkerMock.mock.calls.length === 2,
      500,
    );

    await waitForCondition(() => ref.current?.tasks[1]?.status === "done", 500);

    const tasks = ref.current?.tasks ?? [];
    expect(tasks.map((t) => t.status)).toEqual(["error", "done"]);
    expect(tasks[0]?.errorMessage?.toLowerCase()).toContain("timed out");
    expect(resetImageWorkerMock).toHaveBeenCalledTimes(1);
  });
});
