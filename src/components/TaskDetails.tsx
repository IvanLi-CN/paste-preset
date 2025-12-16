import { Icon } from "@iconify/react/offline";
import { useTranslation } from "../i18n";
import type { ImageInfo } from "../lib/types.ts";
import { buildDownloadFileName, ImageCard } from "./ImageCard.tsx";

interface TaskDetailsProps {
  source: ImageInfo | null;
  result: ImageInfo | null;
  originalFileName?: string;
  onCopyResult: (blob: Blob, mimeType: string) => void;
}

export function TaskDetails(props: TaskDetailsProps) {
  const { source, result, originalFileName, onCopyResult } = props;
  const { t } = useTranslation();

  if (!source && !result) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 mt-4 p-4 bg-base-200/50 rounded-lg animate-fade-in-up">
      {source && <ImageCard title={t("preview.source.title")} image={source} />}
      {result && (
        <div className="flex flex-col gap-3">
          <ImageCard
            title={t("preview.result.title")}
            image={result}
            highlighted
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
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => onCopyResult(result.blob, result.mimeType)}
                  aria-label={t("preview.actions.copyAria")}
                >
                  <Icon icon="mdi:content-copy" data-icon="mdi:content-copy" />
                  {t("preview.actions.copyLabel")}
                </button>
                <a
                  href={result.url}
                  download={buildDownloadFileName(result, originalFileName)}
                  className="btn btn-sm btn-outline"
                  aria-label={t("preview.actions.downloadAria")}
                >
                  <Icon icon="mdi:download" data-icon="mdi:download" />
                  {t("preview.actions.downloadLabel")}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
