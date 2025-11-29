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

function ImageCard(props: { title: string; image: ImageInfo }) {
  const { title, image } = props;
  return (
    <div className="card bg-base-100 shadow-sm">
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
      </div>
    </div>
  );
}

export function PreviewPanel(props: PreviewPanelProps) {
  const { source, result, status, onCopyResult } = props;

  const hasImage = source || result;

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

      {hasImage && (
        <div className="grid gap-4 lg:grid-cols-2">
          {source && <ImageCard title="Source image" image={source} />}
          {result && (
            <div className="flex flex-col gap-3">
              <ImageCard title="Result image" image={result} />
              <div className="card bg-base-100 shadow-sm">
                <div className="card-body flex flex-row flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-base-content/70">
                    Result can be copied to clipboard or downloaded as a file.
                  </div>
                  <div className="flex gap-2">
                    {result && (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() =>
                            onCopyResult(result.blob, result.mimeType)
                          }
                        >
                          Copy to clipboard
                        </button>
                        <a
                          href={result.url}
                          download={result.sourceName ?? "pasted-image"}
                          className="btn btn-sm btn-outline"
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
    </section>
  );
}
