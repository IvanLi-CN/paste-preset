import { Icon } from "@iconify/react/offline";
import { useState } from "react";
import { useTranslation } from "../i18n";
import type { ImageTask } from "../lib/types.ts";
import { buildDownloadFileName, type ImageCardProps } from "./ImageCard.tsx";
import { TaskDetails } from "./TaskDetails.tsx";

interface TaskRowProps {
  task: ImageTask;
  isExpanded: boolean;
  isActive?: boolean;
  onActivate?: (taskId: string) => void;
  onToggleExpand: (event: React.MouseEvent) => void;
  onCopyResult: (taskId: string, blob: Blob, mimeType: string) => void;
}

export function TaskRow(props: TaskRowProps) {
  const {
    task,
    isExpanded,
    isActive = false,
    onActivate,
    onToggleExpand,
    onCopyResult,
  } = props;
  const { t } = useTranslation();

  const result = task.result;
  const [isCopying, setIsCopying] = useState(false);
  const [previewRotationDeg, setPreviewRotationDeg] = useState(0);

  const hasCurrentResult =
    Boolean(result) &&
    typeof task.resultGeneration === "number" &&
    task.resultGeneration === task.desiredGeneration;
  const canExport = task.status === "done" && hasCurrentResult;
  const isResultStale = Boolean(result) && !hasCurrentResult;

  const exportDisabledReason = (() => {
    if (!result) return t("export.gate.noResult");
    if (isResultStale) {
      switch (task.status) {
        case "processing":
          return t("export.gate.regenerating");
        case "queued":
          return t("export.gate.waiting");
        case "error":
          return t("export.gate.failed");
        default:
          return t("export.gate.stale");
      }
    }

    switch (task.status) {
      case "processing":
        return t("export.gate.processing");
      case "queued":
        return t("export.gate.queued");
      case "error":
        return t("export.gate.failed");
      default:
        return t("export.gate.unavailable");
    }
  })();

  const resultOverlay = isResultStale
    ? task.status === "processing"
      ? ({
          label: t("preview.result.overlay.regenerating"),
          tone: "info",
        } satisfies ImageCardProps["overlay"])
      : task.status === "error"
        ? ({
            label: t("preview.result.overlay.failed"),
            tone: "error",
          } satisfies ImageCardProps["overlay"])
        : ({
            label: t("preview.result.overlay.waiting"),
          } satisfies ImageCardProps["overlay"])
    : null;

  const copyResult = async () => {
    if (!result) return;
    if (!canExport) return;

    setIsCopying(true);
    try {
      await Promise.resolve(
        onCopyResult(task.id, result.blob, result.mimeType) as unknown,
      );
    } finally {
      setIsCopying(false);
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onActivate?.(task.id);
    await copyResult();
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onActivate?.(task.id);
  };

  const handleRotatePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    onActivate?.(task.id);
    setPreviewRotationDeg((current) => (current + 90) % 360);
  };

  const getStatusBadge = () => {
    if (isResultStale) {
      switch (task.status) {
        case "processing":
          return (
            <span className="badge badge-sm badge-info whitespace-nowrap shrink-0">
              {t("export.gate.regenerating")}
            </span>
          );
        case "error":
          return (
            <span className="badge badge-sm badge-error whitespace-nowrap shrink-0">
              {t("preview.result.overlay.failed")}
            </span>
          );
        default:
          return (
            <span className="badge badge-sm badge-warning whitespace-nowrap shrink-0">
              {t("status.regenerateQueued")}
            </span>
          );
      }
    }

    switch (task.status) {
      case "queued":
        return (
          <span className="badge badge-sm badge-ghost whitespace-nowrap shrink-0">
            {t("status.queued")}
          </span>
        );
      case "processing":
        return (
          <span className="badge badge-sm badge-info whitespace-nowrap shrink-0">
            {t("status.processing")}
          </span>
        );
      case "done":
        return (
          <span className="badge badge-sm badge-success whitespace-nowrap shrink-0">
            {t("status.done")}
          </span>
        );
      case "error":
        return (
          <span className="badge badge-sm badge-error whitespace-nowrap shrink-0">
            {t("status.error")}
          </span>
        );
      default:
        return null;
    }
  };

  const thumbnailSrc = task.result?.url ?? task.source?.url;

  const rowClassName = [
    "collapse bg-base-100 border",
    isActive ? "border-primary/50 ring-1 ring-primary/20" : "border-base-300",
    isExpanded ? "collapse-open" : "collapse-close",
  ].join(" ");

  return (
    <div
      data-testid="task-row"
      data-active={isActive ? "true" : "false"}
      className={rowClassName}
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
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
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
          {result && (
            <>
              {!canExport ? (
                <span
                  className="tooltip tooltip-bottom"
                  data-tip={exportDisabledReason}
                >
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-square"
                    onClick={handleCopy}
                    aria-label={t("preview.actions.copyAria")}
                    data-testid="task-copy"
                    title={t("preview.actions.copyLabel")}
                    disabled
                  >
                    <Icon
                      icon="mdi:content-copy"
                      data-icon="mdi:content-copy"
                      className="w-5 h-5"
                    />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-square"
                  onClick={handleCopy}
                  aria-label={t("preview.actions.copyAria")}
                  data-testid="task-copy"
                  title={t("preview.actions.copyLabel")}
                  disabled={isCopying}
                >
                  {isCopying ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <Icon
                      icon="mdi:content-copy"
                      data-icon="mdi:content-copy"
                      className="w-5 h-5"
                    />
                  )}
                </button>
              )}

              {!canExport ? (
                <span
                  className="tooltip tooltip-bottom"
                  data-tip={exportDisabledReason}
                >
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-square"
                    onClick={handleDownloadClick}
                    aria-label={t("preview.actions.downloadAria")}
                    data-testid="task-download"
                    title={t("preview.actions.downloadLabel")}
                    disabled
                  >
                    <Icon
                      icon="mdi:download"
                      data-icon="mdi:download"
                      className="w-5 h-5"
                    />
                  </button>
                </span>
              ) : (
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
              )}
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
            onCopyResult={() => copyResult()}
            onRotatePreview={handleRotatePreview}
            previewRotationDeg={previewRotationDeg}
            canExportResult={canExport}
            exportDisabledReason={canExport ? null : exportDisabledReason}
            isCopyingResult={isCopying}
            resultOverlay={resultOverlay}
          />
        )}
      </div>
    </div>
  );
}
