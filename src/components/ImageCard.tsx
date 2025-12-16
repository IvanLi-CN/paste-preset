import { useState } from "react";
import { useTranslation } from "../i18n";
import type { ImageInfo } from "../lib/types.ts";
import { FullscreenImagePreview } from "./FullscreenImagePreview.tsx";

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

export interface ImageCardProps {
  title: string;
  image: ImageInfo;
  highlighted?: boolean;
}

export function ImageCard(props: ImageCardProps) {
  const { title, image, highlighted } = props;
  const { t } = useTranslation();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
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
        <button
          type="button"
          className="flex cursor-pointer items-center justify-center rounded-md bg-base-200 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
          aria-label={title}
          onClick={(event) => {
            event.currentTarget.focus();
            setIsPreviewOpen(true);
          }}
        >
          <img
            src={image.url}
            alt={image.sourceName ?? title}
            className="max-h-64 max-w-full object-contain"
          />
        </button>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-base-content/80">
          <div>
            <dt className="font-medium">{t("preview.card.dimensions")}</dt>
            <dd>
              {image.width} × {image.height}
            </dd>
          </div>
          <div>
            <dt className="font-medium">{t("preview.card.format")}</dt>
            <dd>{image.mimeType || "unknown"}</dd>
          </div>
          <div>
            <dt className="font-medium">{t("preview.card.size")}</dt>
            <dd>{formatFileSize(image.fileSize)}</dd>
          </div>
        </dl>
        <div className="divider my-2" />
        <div className="flex flex-col gap-1 text-[11px] text-base-content/70">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium uppercase tracking-wide text-[11px]">
              {t("preview.card.metadataLabel")}
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
                {image.metadataStripped
                  ? t("preview.card.metadataStrippedBadge")
                  : t("preview.card.metadataPreservedBadge")}
              </span>
            ) : (
              <span className="badge badge-xs badge-outline">
                {t("preview.card.metadataUnknownBadge")}
              </span>
            )}
          </div>
          {image.metadata && (
            <dl className="mt-1 grid grid-cols-1 gap-y-1 text-[11px] text-base-content/80">
              {image.metadata.capturedAt && (
                <div className="flex gap-1">
                  <dt className="font-medium">{t("preview.card.captured")}</dt>
                  <dd className="flex-1 truncate">
                    {image.metadata.capturedAt}
                  </dd>
                </div>
              )}
              {image.metadata.camera && (
                <div className="flex gap-1">
                  <dt className="font-medium">{t("preview.card.camera")}</dt>
                  <dd className="flex-1 truncate">{image.metadata.camera}</dd>
                </div>
              )}
              {image.metadata.lens && (
                <div className="flex gap-1">
                  <dt className="font-medium">{t("preview.card.lens")}</dt>
                  <dd className="flex-1 truncate">{image.metadata.lens}</dd>
                </div>
              )}
              {(image.metadata.exposure ||
                image.metadata.aperture ||
                typeof image.metadata.iso === "number") && (
                <div className="flex gap-1">
                  <dt className="font-medium">{t("preview.card.exposure")}</dt>
                  <dd className="flex flex-wrap gap-x-2 gap-y-0.5">
                    {image.metadata.exposure && (
                      <span>{image.metadata.exposure}</span>
                    )}
                    {image.metadata.aperture && (
                      <span>{image.metadata.aperture}</span>
                    )}
                    {typeof image.metadata.iso === "number" && (
                      <span>
                        {t("preview.card.isoPrefix")} {image.metadata.iso}
                      </span>
                    )}
                  </dd>
                </div>
              )}
              {image.metadata.focalLength && (
                <div className="flex gap-1">
                  <dt className="font-medium">
                    {t("preview.card.focalLength")}
                  </dt>
                  <dd className="flex-1 truncate">
                    {image.metadata.focalLength}
                  </dd>
                </div>
              )}
              {image.metadata.location && (
                <div className="flex gap-1">
                  <dt className="font-medium">{t("preview.card.location")}</dt>
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
                ? t("preview.card.metadataSummary.stripped")
                : t("preview.card.metadataSummary.preserved")
              : t("preview.card.metadataSummary.unknown")}
          </p>
        </div>
      </div>
      <FullscreenImagePreview
        open={isPreviewOpen}
        image={image}
        title={title}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
}

// Export useful helper for others
export function buildDownloadFileName(
  image: ImageInfo,
  originalName?: string,
): string {
  // If we want to strictly follow the requirement of using original name where possible:
  // "fileNameOrGeneratedName 可用现有 buildDownloadFileName 逻辑或新增一个工具函数，但要注意优先用原文件名（task.fileName）"
  // However, the original `buildDownloadFileName` was purely time-based.
  // Let's modify it to be more flexible or just keep it as is if it serves "generated name" purpose.
  // For now, I'll copy the existing logic, but maybe we should enhance it later or here if needed.
  // Actually, looking at the requirement: "fileNameOrGeneratedName 可用现有 buildDownloadFileName 逻辑或新增一个工具函数，但要注意优先用原文件名"

  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());

  const getExtension = (mimeType: string) => {
    if (mimeType === "image/jpeg") return "jpg";
    if (mimeType === "image/png") return "png";
    if (mimeType === "image/webp") return "webp";
    return "png";
  };

  const ext = getExtension(image.mimeType);

  if (originalName) {
    // Try to preserve original name but change extension if format changed
    const lastDot = originalName.lastIndexOf(".");
    const baseName =
      lastDot > 0 ? originalName.substring(0, lastDot) : originalName;
    return `${baseName}.${ext}`;
  }

  return `pastepreset-${year}${month}${day}-${hours}${minutes}${seconds}.${ext}`;
}
