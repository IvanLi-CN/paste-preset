import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { PasteArea } from "./PasteArea";

class FakeDataTransferItem {
  kind = "file" as const;
  type: string;
  #file: File;

  constructor(file: File) {
    this.#file = file;
    this.type = file.type;
  }

  getAsFile() {
    return this.#file;
  }
}

class FakeDataTransfer {
  items: FakeDataTransferItem[] = [];
  files: File[] = [];

  addFile(file: File) {
    this.items.push(new FakeDataTransferItem(file));
    this.files.push(file);
  }
}

class FakeClipboardEvent extends Event {
  clipboardData: FakeDataTransfer;

  constructor(type: string, init: { clipboardData: FakeDataTransfer }) {
    super(type, { bubbles: true, cancelable: true });
    this.clipboardData = init.clipboardData;
  }
}

class FakeDragEvent extends Event {
  dataTransfer: FakeDataTransfer;

  constructor(type: string, init: { dataTransfer: FakeDataTransfer }) {
    super(type, { bubbles: true, cancelable: true });
    this.dataTransfer = init.dataTransfer;
  }
}

function renderPasteArea({
  hasImage = false,
  onImagesSelected = vi.fn(),
  onError = vi.fn(),
} = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <I18nProvider>
        <PasteArea
          hasImage={hasImage}
          onImagesSelected={onImagesSelected}
          onError={onError}
        />
      </I18nProvider>,
    );
  });

  const cleanup = () => {
    act(() => root.unmount());
    container.remove();
  };

  return { container, cleanup };
}

function createImageFile(name: string) {
  return new File([name], name, { type: "image/png" });
}

describe("PasteArea multi-image collection", () => {
  it("collects all clipboard images", () => {
    const onImagesSelected = vi.fn();
    const { container, cleanup } = renderPasteArea({ onImagesSelected });
    const button = container.querySelector("button");
    const dt = new FakeDataTransfer();
    dt.addFile(createImageFile("a.png"));
    dt.addFile(createImageFile("b.png"));

    const event = new FakeClipboardEvent("paste", { clipboardData: dt });
    button?.dispatchEvent(event);

    expect(onImagesSelected).toHaveBeenCalledTimes(1);
    const [files] = onImagesSelected.mock.calls[0];
    expect(files.map((f: File) => f.name)).toEqual(["a.png", "b.png"]);

    cleanup();
  });

  it("handles multi-file input selection", () => {
    const onImagesSelected = vi.fn();
    const { container, cleanup } = renderPasteArea({ onImagesSelected });
    const input =
      container.querySelector<HTMLInputElement>("input[type='file']");
    if (!input) throw new Error("file input not found");

    const files = [createImageFile("c.png"), createImageFile("d.png")];
    Object.defineProperty(input, "files", {
      value: files,
      configurable: true,
    });

    act(() => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onImagesSelected).toHaveBeenCalledTimes(1);
    const [selected] = onImagesSelected.mock.calls[0];
    expect(selected.map((f: File) => f.name)).toEqual(["c.png", "d.png"]);

    cleanup();
  });

  it("emits error when dropped files have no images", () => {
    const onError = vi.fn();
    const onImagesSelected = vi.fn();
    const { container, cleanup } = renderPasteArea({
      onError,
      onImagesSelected,
    });
    const button = container.querySelector("button");
    const dt = new FakeDataTransfer();
    dt.files.push(new File(["txt"], "note.txt", { type: "text/plain" }));

    const event = new FakeDragEvent("drop", { dataTransfer: dt });
    button?.dispatchEvent(event);

    expect(onImagesSelected).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
