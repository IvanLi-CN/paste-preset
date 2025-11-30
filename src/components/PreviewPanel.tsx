import type { KeyboardEvent } from "react";
import type { AppStatus, ImageInfo } from "../lib/types.ts";

interface PreviewPanelProps {
  source: ImageInfo | null;
  result: ImageInfo | null;
  status: AppStatus;
  onCopyResult: (blob: Blob, mimeType: string) => Promise<void> | void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function ImageCard(props: {
  title: string;
  image: ImageInfo;
  highlighted?: boolean;
}) {
  const { title, image, highlighted } = props;
  const cardClassName = [
    "card bg-base-100 shadow-sm animate-fade-in-up",
    highlighted
      ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-base-100"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cardClassName}>
      <div className="card-body gap-3">
        <h3 className="card-title text-sm">{title}</h3>
        <div className="flex items-center justify-center rounded-md bg-base-200 p-2">
          <img
            src={image.url}
            alt={image.sourceName ?? title}
            className="max-h-64 max-w-full object-contain"
          />
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-base-content/80">
          <div>
            <dt className="font-medium">Dimensions</dt>
            <dd>
              {image.width} × {image.height}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Format</dt>
            <dd>{image.mimeType || "unknown"}</dd>
          </div>
          <div>
            <dt className="font-medium">Size</dt>
            <dd>{formatFileSize(image.fileSize)}</dd>
          </div>
        </dl>
        <div className="divider my-2" />
        <div className="flex flex-col gap-1 text-[11px] text-base-content/70">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium uppercase tracking-wide text-[11px]">
              Metadata
            </span>
            {typeof image.metadataStripped === "boolean" ? (
              <span
                className={[
                  "badge badge-xs badge-outline",
                  image.metadataStripped ? "badge-warning" : "badge-success",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {image.metadataStripped ? "Stripped" : "Preserved"}
              </span>
            ) : (
              <span className="badge badge-xs badge-outline">Unknown</span>
            )}
          </div>
          {image.metadata && (
            <dl className="mt-1 grid grid-cols-1 gap-y-1 text-[11px] text-base-content/80">
              {image.metadata.capturedAt && (
                <div className="flex gap-1">
                  <dt className="font-medium">Captured</dt>
                  <dd className="flex-1 truncate">
                    {image.metadata.capturedAt}
                  </dd>
                </div>
              )}
              {image.metadata.camera && (
                <div className="flex gap-1">
                  <dt className="font-medium">Camera</dt>
                  <dd className="flex-1 truncate">{image.metadata.camera}</dd>
                </div>
              )}
              {image.metadata.lens && (
                <div className="flex gap-1">
                  <dt className="font-medium">Lens</dt>
                  <dd className="flex-1 truncate">{image.metadata.lens}</dd>
                </div>
              )}
              {(image.metadata.exposure ||
                image.metadata.aperture ||
                typeof image.metadata.iso === "number") && (
                <div className="flex gap-1">
                  <dt className="font-medium">Exposure</dt>
                  <dd className="flex flex-wrap gap-x-2 gap-y-0.5">
                    {image.metadata.exposure && (
                      <span>{image.metadata.exposure}</span>
                    )}
                    {image.metadata.aperture && (
                      <span>{image.metadata.aperture}</span>
                    )}
                    {typeof image.metadata.iso === "number" && (
                      <span>ISO {image.metadata.iso}</span>
                    )}
                  </dd>
                </div>
              )}
              {image.metadata.focalLength && (
                <div className="flex gap-1">
                  <dt className="font-medium">Focal length</dt>
                  <dd className="flex-1 truncate">
                    {image.metadata.focalLength}
                  </dd>
                </div>
              )}
              {image.metadata.location && (
                <div className="flex gap-1">
                  <dt className="font-medium">Location</dt>
                  <dd className="flex flex-wrap gap-x-1">
                    <span>{image.metadata.location.latitude.toFixed(5)}</span>
                    <span>{image.metadata.location.longitude.toFixed(5)}</span>
                  </dd>
                </div>
              )}
            </dl>
          )}
          <p className="leading-snug">
            {typeof image.metadataStripped === "boolean"
              ? image.metadataStripped
                ? "EXIF / IPTC / XMP data was removed when generating this image."
                : "Original image metadata is kept for this image whenever possible."
              : "This image's metadata status could not be determined."}
          </p>
        </div>
      </div>
    </div>
  );
}

function getDownloadExtension(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function buildDownloadFileName(image: ImageInfo): string {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());

  const ext = getDownloadExtension(image.mimeType);
  return `pastepreset-${year}${month}${day}-${hours}${minutes}${seconds}.${ext}`;
}

export function PreviewPanel(props: PreviewPanelProps) {
  const { source, result, status, onCopyResult } = props;

  const hasImage = source || result;

  const handleCopyKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!result) {
      return;
    }

    const isCopyShortcut =
      (event.metaKey || event.ctrlKey) &&
      (event.key === "c" || event.key === "C");

    if (isCopyShortcut) {
      event.preventDefault();
      onCopyResult(result.blob, result.mimeType);
    }
  };

  return (
    <section className="flex flex-1 flex-col gap-4">
      {!hasImage && (
        <div className="alert alert-info text-sm">
          <span>
            Paste, drop, or select an image to see the original and processed
            previews here.
          </span>
        </div>
      )}

      {status === "processing" && (
        <div className="alert alert-warning text-sm">
          <span>Processing image…</span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-4">
        {hasImage && (
          <div className="grid gap-4 md:grid-cols-2">
            {source && <ImageCard title="Source image" image={source} />}
            {result && (
              <div className="flex flex-col gap-3">
                <ImageCard title="Result image" image={result} highlighted />
                <div className="card bg-base-100 shadow-sm animate-fade-in-up">
                  <div className="card-body flex flex-row flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col gap-1 text-xs text-base-content/70">
                      <div>
                        Result can be copied to clipboard or downloaded as a
                        file.
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {source && result && (
                          <span className="badge badge-xs badge-outline">
                            {source.width === result.width &&
                            source.height === result.height
                              ? "Original size"
                              : `Resized to ${result.width} × ${result.height}`}
                          </span>
                        )}
                        {typeof result.metadataStripped === "boolean" && (
                          <span className="badge badge-xs badge-outline">
                            {result.metadataStripped
                              ? "Stripped metadata"
                              : "Metadata preserved"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {result && (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onKeyDown={handleCopyKeyDown}
                            onClick={() =>
                              onCopyResult(result.blob, result.mimeType)
                            }
                            aria-label="Copy result image to clipboard"
                          >
                            Copy to clipboard
                          </button>
                          <a
                            href={result.url}
                            download={buildDownloadFileName(result)}
                            className="btn btn-sm btn-outline"
                            aria-label="Download result image"
                          >
                            Download
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
