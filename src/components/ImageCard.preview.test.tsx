import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../i18n";
import type { ImageInfo } from "../lib/types.ts";
import { FullscreenImagePreviewProvider } from "./FullscreenImagePreviewProvider.tsx";
import { ImageCard } from "./ImageCard";

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
} as unknown as typeof ResizeObserver;

function renderImageCard({
  title = "Source image",
  image,
}: {
  title?: string;
  image: ImageInfo;
}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <I18nProvider>
        <FullscreenImagePreviewProvider>
          <ImageCard title={title} image={image} />
        </FullscreenImagePreviewProvider>
      </I18nProvider>,
    );
  });

  const cleanup = () => {
    act(() => root.unmount());
    container.remove();
  };

  return { container, cleanup };
}

function sampleImage(overrides: Partial<ImageInfo> = {}): ImageInfo {
  const width = overrides.width ?? 800;
  const height = overrides.height ?? 600;
  const blob = new Blob(["sample-image"], {
    type: overrides.mimeType ?? "image/jpeg",
  });
  return {
    blob,
    url: overrides.url ?? "/storybook/sample-800x600.jpg",
    width,
    height,
    mimeType: overrides.mimeType ?? "image/jpeg",
    fileSize: overrides.fileSize ?? blob.size,
    metadataStripped: overrides.metadataStripped ?? false,
    metadata: overrides.metadata,
    sourceName: overrides.sourceName ?? "sample.jpg",
  };
}

describe("ImageCard fullscreen preview integration", () => {
  it("opens and closes the preview and restores focus to the trigger", () => {
    const title = "Source image";
    const { container, cleanup } = renderImageCard({
      title,
      image: sampleImage(),
    });

    const trigger = container.querySelector<HTMLButtonElement>(
      `button[aria-label="${title}"]`,
    );
    if (!trigger) throw new Error("preview trigger button not found");

    act(() => {
      trigger.click();
    });

    expect(document.querySelector("dialog.modal")).not.toBeNull();

    const rotateRightButton = [
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent === "Rotate right");
    if (!rotateRightButton) throw new Error("rotate right button not found");

    act(() => {
      rotateRightButton.click();
    });

    const previewImage =
      document.querySelector<HTMLImageElement>("dialog.modal img");
    if (!previewImage) throw new Error("preview image not found");
    expect(previewImage.style.transform).toContain("rotate(90deg)");

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(document.querySelector("dialog.modal")).toBeNull();
    expect(document.activeElement).toBe(trigger);

    cleanup();
  });
});
