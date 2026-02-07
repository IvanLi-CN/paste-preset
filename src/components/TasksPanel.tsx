import { Icon } from "@iconify/react/offline";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../i18n";
import type { ImageTask } from "../lib/types.ts";
import { TaskRow } from "./TaskRow.tsx";

interface TasksPanelProps {
  tasks: ImageTask[];
  onCopyResult: (taskId: string, blob: Blob, mimeType: string) => void;
  onClearAll: () => void;
  onExpandedIdsChange?: (expandedIds: ReadonlySet<string>) => void;
  onActiveTaskIdChange?: (taskId: string | null) => void;
}

export function TasksPanel(props: TasksPanelProps) {
  const { tasks, onCopyResult, onClearAll } = props;
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const previousTopBatchIdRef = useRef<string | null>(null);

  // If no tasks, we could show empty state, or let App handle it.
  // Requirement says: "当 tasks 为空时，TasksPanel 应向用户显示一个友好的空态提示"
  const hasTasks = tasks.length > 0;

  const batchGroups = useMemo(() => {
    const groups: {
      batchId: string;
      batchCreatedAt: number;
      tasks: ImageTask[];
    }[] = [];
    for (const task of tasks) {
      const last = groups.at(-1);
      if (last && last.batchId === task.batchId) {
        last.tasks.push(task);
        continue;
      }
      groups.push({
        batchId: task.batchId,
        batchCreatedAt: task.batchCreatedAt,
        tasks: [task],
      });
    }
    return groups;
  }, [tasks]);

  useEffect(() => {
    props.onExpandedIdsChange?.(expandedIds);
  }, [expandedIds, props.onExpandedIdsChange]);

  useEffect(() => {
    props.onActiveTaskIdChange?.(activeTaskId);
  }, [activeTaskId, props.onActiveTaskIdChange]);

  const autoExpandBatchFirstTask = useCallback((firstTask: ImageTask) => {
    setExpandedIds(new Set<string>([firstTask.id]));
    setActiveTaskId(firstTask.id);
  }, []);

  const handleActivateTask = useCallback((taskId: string) => {
    setActiveTaskId(taskId);
  }, []);

  // New batch behavior: collapse previous expansions and auto-expand first of the new batch.
  useEffect(() => {
    if (!hasTasks) {
      setExpandedIds(new Set<string>());
      setActiveTaskId(null);
      previousTopBatchIdRef.current = null;
      return;
    }

    const top = tasks[0];
    if (!top) {
      return;
    }

    const previousTopBatchId = previousTopBatchIdRef.current;
    const nextTopBatchId = top.batchId;

    if (previousTopBatchId !== nextTopBatchId) {
      autoExpandBatchFirstTask(top);
    }

    previousTopBatchIdRef.current = nextTopBatchId;
  }, [autoExpandBatchFirstTask, hasTasks, tasks]);

  const handleToggleExpand = (task: ImageTask, event: React.MouseEvent) => {
    const isMultiSelect = event.altKey || event.shiftKey;
    const isExpanded = expandedIds.has(task.id);

    const nextExpanded = new Set(expandedIds);

    if (isMultiSelect) {
      if (isExpanded) {
        nextExpanded.delete(task.id);
      } else {
        nextExpanded.add(task.id);
      }
    } else {
      if (isExpanded) {
        nextExpanded.delete(task.id);
      } else {
        nextExpanded.clear();
        nextExpanded.add(task.id);
      }
    }

    setExpandedIds(nextExpanded);
    // "Active" selection is independent from expansion state so it can stay
    // usable for keyboard shortcuts even when the row is collapsed.
    setActiveTaskId(task.id);
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
      </div>

      <div className="flex flex-col gap-2">
        {batchGroups.map((group, groupIndex) => (
          <div key={group.batchId} data-testid="task-batch-group">
            {groupIndex > 0 && <div className="divider my-2" />}
            <div
              className="flex items-center justify-between px-1 text-xs text-base-content/60"
              data-testid="task-batch-separator"
              data-batch-id={group.batchId}
            >
              <span>Batch</span>
              <span>{group.tasks.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {group.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isExpanded={expandedIds.has(task.id)}
                  isActive={task.id === activeTaskId}
                  onActivate={handleActivateTask}
                  onToggleExpand={(e) => handleToggleExpand(task, e)}
                  onCopyResult={onCopyResult}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
