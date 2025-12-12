import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { useTranslation } from "../i18n";

interface PasteAreaProps {
  onImagesSelected: (files: File[]) => void;
  onError: (message: string) => void;
  hasImage: boolean;
}

export function PasteArea(props: PasteAreaProps) {
  const { onImagesSelected, onError, hasImage } = props;
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const iterable =
        files instanceof FileList ? Array.from(files) : (files as File[]);

      const images = iterable.filter((file) => file.type.startsWith("image/"));
      if (images.length === 0) {
        onError(t("pasteArea.error.noImageFile"));
        return [] as File[];
      }

      onImagesSelected(images);
      return images;
    },
    [onError, onImagesSelected, t],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLButtonElement>) => {
      const { items, files } = event.clipboardData;

      const clipboardImages = Array.from(items)
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));

      if (clipboardImages.length > 0) {
        event.preventDefault();
        onImagesSelected(clipboardImages);
        return;
      }

      if (files.length > 0) {
        event.preventDefault();
        const collected = handleFiles(files);
        if (collected.length > 0) {
          return;
        }
      }

      onError(t("pasteArea.error.noClipboardImage"));
    },
    [handleFiles, onError, onImagesSelected, t],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);

      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        handleFiles(event.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!isDragging) {
        setIsDragging(true);
      }
    },
    [isDragging],
  );

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (isDragging) {
        setIsDragging(false);
      }
    },
    [isDragging],
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files) {
        return;
      }
      handleFiles(event.target.files);
      event.target.value = "";
    },
    [handleFiles],
  );

  const cardClassName = ["card bg-base-100", hasImage ? "" : "h-full"]
    .filter(Boolean)
    .join(" ");

  const bodyClassName = ["card-body", hasImage ? "py-3" : ""]
    .filter(Boolean)
    .join(" ");

  const buttonPadding = hasImage ? "px-4 py-3" : "p-8";

  return (
    <section className={cardClassName}>
      <div className={bodyClassName}>
        <button
          className={[
            "flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center text-sm",
            "transition-all duration-200 ease-out hover:shadow-md hover:-translate-y-0.5",
            buttonPadding,
            isDragging
              ? "border-primary bg-primary/5"
              : "border-base-300 bg-base-200/40",
          ].join(" ")}
          aria-label={
            hasImage ? t("pasteArea.aria.replace") : t("pasteArea.aria.select")
          }
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
          type="button"
        >
          <div className="font-medium">
            {hasImage
              ? t("pasteArea.title.replace")
              : t("pasteArea.title.initial")}
          </div>
          {!hasImage && (
            <div className="text-base-content/70">
              {t("pasteArea.subtitle")}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
        </button>
      </div>
    </section>
  );
}
