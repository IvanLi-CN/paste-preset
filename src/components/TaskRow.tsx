import { Icon } from "@iconify/react/offline";
import { useTranslation } from "../i18n";
import type { ImageTask } from "../lib/types.ts";
import { buildDownloadFileName } from "./ImageCard.tsx";
import { TaskDetails } from "./TaskDetails.tsx";

interface TaskRowProps {
  task: ImageTask;
  isExpanded: boolean;
  onToggleExpand: (event: React.MouseEvent) => void;
  onCopyResult: (taskId: string, blob: Blob, mimeType: string) => void;
}

export function TaskRow(props: TaskRowProps) {
  const { task, isExpanded, onToggleExpand, onCopyResult } = props;
  const { t } = useTranslation();

  const result = task.result;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (result) {
      onCopyResult(task.id, result.blob, result.mimeType);
    }
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const getStatusBadge = () => {
    switch (task.status) {
      case "queued":
        return (
          <span className="badge badge-sm badge-ghost">
            {t("status.queued")}
          </span>
        );
      case "processing":
        return (
          <span className="badge badge-sm badge-info">
            {t("status.processing")}
          </span>
        );
      case "done":
        return (
          <span className="badge badge-sm badge-success">
            {t("status.done")}
          </span>
        );
      case "error":
        return (
          <span className="badge badge-sm badge-error">
            {t("status.error")}
          </span>
        );
      default:
        return null;
    }
  };

  const thumbnailSrc = task.result?.url ?? task.source?.url;

  return (
    <div
      data-testid="task-row"
      className={`collapse bg-base-100 border border-base-300 ${isExpanded ? "collapse-open" : "collapse-close"}`}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: DaisyUI structure requires div or specifically styled element */}
      <div
        role="button"
        data-testid="task-toggle"
        tabIndex={0}
        className="collapse-title flex items-center gap-4 py-3 px-4 outline-none focus-visible:bg-base-200"
        onClick={onToggleExpand}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpand(e as unknown as React.MouseEvent);
          }
        }}
      >
        {/* Thumbnail */}
        <div className="w-12 h-12 shrink-0 bg-base-200 rounded overflow-hidden flex items-center justify-center">
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <Icon
              icon="mdi:image-outline"
              data-icon="mdi:image-outline"
              className="w-6 h-6 text-base-content/30"
            />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="font-medium text-sm truncate" title={task.fileName}>
            {task.fileName || `Image #${task.id.slice(0, 4)}`}
          </div>
          <div className="flex items-center gap-2 text-xs">
            {getStatusBadge()}
            {(task.result || task.source) && (
              <span className="text-base-content/60">
                {task.result
                  ? `${task.result.width}×${task.result.height}`
                  : task.source
                    ? `${task.source.width}×${task.source.height}`
                    : ""}
              </span>
            )}
            {task.status === "error" && task.errorMessage && (
              <span
                className="text-error truncate max-w-[200px]"
                title={task.errorMessage}
              >
                {task.errorMessage}
              </span>
            )}
          </div>
        </div>

        {/* Actions (Visible when folded or expanded, but mainly for folded quick access) */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Stop propagation */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Stop propagation */}
        <div
          className="flex items-center gap-1 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {task.status === "done" && result && (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                onClick={handleCopy}
                aria-label={t("preview.actions.copyAria")}
                data-testid="task-copy"
                title={t("preview.actions.copyLabel")}
              >
                <Icon
                  icon="mdi:content-copy"
                  data-icon="mdi:content-copy"
                  className="w-5 h-5"
                />
              </button>
              <a
                href={result.url}
                download={buildDownloadFileName(result, task.fileName)}
                className="btn btn-ghost btn-sm btn-square"
                onClick={handleDownloadClick}
                aria-label={t("preview.actions.downloadAria")}
                data-testid="task-download"
                title={t("preview.actions.downloadLabel")}
              >
                <Icon
                  icon="mdi:download"
                  data-icon="mdi:download"
                  className="w-5 h-5"
                />
              </a>
            </>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-circle opacity-50"
          >
            <Icon
              icon={isExpanded ? "mdi:chevron-up" : "mdi:chevron-down"}
              data-icon={isExpanded ? "mdi:chevron-up" : "mdi:chevron-down"}
              className="w-5 h-5"
            />
          </button>
        </div>
      </div>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Stop propagation */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Stop propagation */}
      <div
        className="collapse-content px-0 py-0 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {isExpanded && (
          <TaskDetails
            source={task.source ?? null}
            result={task.result ?? null}
            originalFileName={task.fileName}
            onCopyResult={(blob, mime) => onCopyResult(task.id, blob, mime)}
          />
        )}
      </div>
    </div>
  );
}
