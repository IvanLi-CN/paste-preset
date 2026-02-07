import { Icon } from "@iconify/react/offline";
import { useTranslation } from "../i18n";
import type { ImageInfo } from "../lib/types.ts";
import {
  buildDownloadFileName,
  ImageCard,
  type ImageCardProps,
} from "./ImageCard.tsx";

interface TaskDetailsProps {
  source: ImageInfo | null;
  result: ImageInfo | null;
  originalFileName?: string;
  onCopyResult: (blob: Blob, mimeType: string) => void;
  onRotatePreview?: () => void;
  previewRotationDeg?: number;
  canExportResult?: boolean;
  exportDisabledReason?: string | null;
  isCopyingResult?: boolean;
  resultOverlay?: ImageCardProps["overlay"] | null;
}

export function TaskDetails(props: TaskDetailsProps) {
  const {
    source,
    result,
    originalFileName,
    onCopyResult,
    onRotatePreview,
    previewRotationDeg,
    canExportResult,
    exportDisabledReason,
    isCopyingResult,
    resultOverlay,
  } = props;
  const { t } = useTranslation();

  if (!source && !result) return null;

  const rotationDeg = previewRotationDeg ?? 0;
  const canExport = canExportResult ?? Boolean(result);
  const isCopying = isCopyingResult ?? false;

  return (
    <div className="mt-4 rounded-lg bg-base-200/50 p-4 animate-fade-in-up">
      <div className="grid gap-4 md:grid-cols-2">
        {source && (
          <ImageCard
            title={t("preview.source.title")}
            image={source}
            rotationDeg={rotationDeg}
          />
        )}
        {result && (
          <div className="flex flex-col gap-3">
            <ImageCard
              title={t("preview.result.title")}
              image={result}
              rotationDeg={rotationDeg}
              highlighted
              overlay={resultOverlay ?? undefined}
            />
            <div className="card bg-base-100 shadow-sm animate-fade-in-up">
              <div className="card-body flex flex-row flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col gap-1 text-xs text-base-content/70">
                  <div>{t("preview.result.description")}</div>
                  <div className="flex flex-wrap gap-1">
                    {source && result && (
                      <span className="badge badge-xs badge-outline">
                        {source.width === result.width &&
                        source.height === result.height
                          ? t("preview.result.badge.originalSize")
                          : `${t(
                              "preview.result.badge.resizedPrefix",
                            )} ${result.width} × ${result.height}`}
                      </span>
                    )}
                    {typeof result.metadataStripped === "boolean" && (
                      <span className="badge badge-xs badge-outline">
                        {result.metadataStripped
                          ? t("preview.result.badge.metadataStripped")
                          : t("preview.result.badge.metadataPreserved")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {onRotatePreview && (
                    <span
                      className="tooltip tooltip-bottom"
                      data-tip={t("preview.actions.rotate90Label")}
                    >
                      <button
                        type="button"
                        className="btn btn-sm btn-outline gap-1"
                        onClick={onRotatePreview}
                        aria-label={t("preview.actions.rotate90Aria")}
                        data-testid="preview-rotate"
                      >
                        <Icon
                          icon="mdi:rotate-right"
                          data-icon="mdi:rotate-right"
                        />
                        <span className="hidden sm:inline">
                          {t("preview.actions.rotate90Label")}
                        </span>
                      </button>
                    </span>
                  )}

                  {!canExport && exportDisabledReason ? (
                    <span
                      className="tooltip tooltip-bottom"
                      data-tip={exportDisabledReason}
                    >
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() =>
                          onCopyResult(result.blob, result.mimeType)
                        }
                        aria-label={t("preview.actions.copyAria")}
                        disabled
                      >
                        <Icon
                          icon="mdi:content-copy"
                          data-icon="mdi:content-copy"
                        />
                        {t("preview.actions.copyLabel")}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => onCopyResult(result.blob, result.mimeType)}
                      aria-label={t("preview.actions.copyAria")}
                      disabled={!canExport || isCopying}
                    >
                      {isCopying ? (
                        <span className="loading loading-spinner loading-sm" />
                      ) : (
                        <Icon
                          icon="mdi:content-copy"
                          data-icon="mdi:content-copy"
                        />
                      )}
                      {t("preview.actions.copyLabel")}
                    </button>
                  )}

                  {!canExport && exportDisabledReason ? (
                    <span
                      className="tooltip tooltip-bottom"
                      data-tip={exportDisabledReason}
                    >
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        aria-label={t("preview.actions.downloadAria")}
                        disabled
                      >
                        <Icon icon="mdi:download" data-icon="mdi:download" />
                        {t("preview.actions.downloadLabel")}
                      </button>
                    </span>
                  ) : (
                    <a
                      href={result.url}
                      download={buildDownloadFileName(result, originalFileName)}
                      className={`btn btn-sm btn-outline ${
                        canExport ? "" : "btn-disabled"
                      }`}
                      aria-label={t("preview.actions.downloadAria")}
                      onClick={(event) => {
                        if (!canExport) {
                          event.preventDefault();
                        }
                      }}
                      aria-disabled={!canExport}
                      tabIndex={canExport ? 0 : -1}
                    >
                      <Icon icon="mdi:download" data-icon="mdi:download" />
                      {t("preview.actions.downloadLabel")}
                    </a>
                  )}
                </div>

                {!canExport && exportDisabledReason && (
                  <div className="w-full text-xs text-base-content/60">
                    {exportDisabledReason}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
