import { Icon } from "@iconify/react/offline";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../i18n";
import type { ImageTask } from "../lib/types.ts";
import { TaskRow } from "./TaskRow.tsx";

interface TasksPanelProps {
  tasks: ImageTask[];
  onCopyResult: (taskId: string, blob: Blob, mimeType: string) => void;
  onDownloadAll: () => void;
  onClearAll: () => void;
  isBuildingZip?: boolean;
}

export function TasksPanel(props: TasksPanelProps) {
  const {
    tasks,
    onCopyResult,
    onDownloadAll,
    onClearAll,
    isBuildingZip = false,
  } = props;
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (tasks.length === 1) {
      return new Set([tasks[0].id]);
    }
    return new Set();
  });
  const previousTaskCountRef = useRef<number>(0);

  // Automatically expand the single task when transitioning from 0 -> 1 task.
  useEffect(() => {
    const previousCount = previousTaskCountRef.current;

    if (previousCount === 0 && tasks.length === 1) {
      const onlyTask = tasks[0];
      if (onlyTask) {
        setExpandedIds((prev) => {
          if (prev.has(onlyTask.id)) {
            return prev;
          }
          const next = new Set(prev);
          next.add(onlyTask.id);
          return next;
        });
      }
    }

    previousTaskCountRef.current = tasks.length;
  }, [tasks]);

  // If no tasks, we could show empty state, or let App handle it.
  // Requirement says: "当 tasks 为空时，TasksPanel 应向用户显示一个友好的空态提示"
  const hasTasks = tasks.length > 0;
  const hasDoneTasks = tasks.some((task) => task.status === "done");

  const handleToggleExpand = (task: ImageTask, event: React.MouseEvent) => {
    const isMultiSelect = event.altKey || event.shiftKey;
    const isExpanded = expandedIds.has(task.id);

    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (isMultiSelect) {
        if (isExpanded) {
          next.delete(task.id);
        } else {
          next.add(task.id);
        }
      } else {
        if (isExpanded) {
          next.delete(task.id);
        } else {
          // Single expand mode: collapse others
          return new Set([task.id]);
        }
      }
      return next;
    });
  };

  if (!hasTasks) {
    return (
      <div className="alert alert-info text-sm animate-fade-in-up">
        <span>{t("preview.empty")}</span>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4 pb-10">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm text-error gap-2"
          onClick={onClearAll}
          title="Clear all tasks"
        >
          <Icon
            icon="mdi:delete-sweep"
            data-icon="mdi:delete-sweep"
            className="h-4 w-4"
          />
          <span className="hidden sm:inline">Clear all</span>
        </button>
        <button
          type="button"
          className={`btn btn-primary btn-sm gap-2 ${isBuildingZip ? "loading" : ""}`}
          onClick={onDownloadAll}
          disabled={!hasDoneTasks || isBuildingZip}
          title={
            !hasDoneTasks
              ? "No completed tasks to download"
              : "Download all results"
          }
        >
          {!isBuildingZip && (
            <Icon
              icon="mdi:folder-zip"
              data-icon="mdi:folder-zip"
              className="h-4 w-4"
            />
          )}
          {isBuildingZip ? "Preparing..." : "Download all"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            isExpanded={expandedIds.has(task.id)}
            onToggleExpand={(e) => handleToggleExpand(task, e)}
            onCopyResult={onCopyResult}
          />
        ))}
      </div>
    </section>
  );
}
