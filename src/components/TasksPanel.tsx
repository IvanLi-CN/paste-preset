import { useState } from "react";
import { useTranslation } from "../i18n";
import type { ImageTask } from "../lib/types.ts";
import { TaskRow } from "./TaskRow.tsx";

interface TasksPanelProps {
  tasks: ImageTask[];
  onCopyResult: (taskId: string, blob: Blob, mimeType: string) => void;
}

export function TasksPanel(props: TasksPanelProps) {
  const { tasks, onCopyResult } = props;
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // If no tasks, we could show empty state, or let App handle it.
  // Requirement says: "当 tasks 为空时，TasksPanel 应向用户显示一个友好的空态提示"
  // We can reuse the one from PreviewPanel (conceptually) or creating a new empty state.
  // PreviewPanel had: "preview.empty"
  const hasTasks = tasks.length > 0;

  const handleToggleExpand = (task: ImageTask, event: React.MouseEvent) => {
    const isMultiSelect = event.altKey || event.shiftKey;
    const isExpanded = expandedIds.has(task.id);

    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (isMultiSelect) {
        // Multi mode: toggle current, leave others
        if (isExpanded) {
          next.delete(task.id);
        } else {
          next.add(task.id);
        }
      } else {
        // Single mode:
        // If current is collapsed -> expand it, collapse others
        // If current is expanded -> collapse it (collapse all effectively or just it?)
        // Req: "若该任务当前已展开：从 expandedIds 中移除该任务 id（即收起它），其他行保持收起。"
        if (isExpanded) {
          next.delete(task.id);
          // "其他行保持收起" - implied they were already collapsed if we were in single mode,
          // but if we were in mixed state, maybe we should just collapse this one?
          // "其他行保持收起" usually means "don't touch others".
          // But the default restart logic for "IfNotExpanded" says "收起其他所有行".
          // So for "IfExpanded", just removing it is safer to preserve behavior if user accidentally
          // clicked without modifier in a multi-state?
          // Wait: "默认点击行为为“单展开”：点击一行时只展开这一行、收起其他行；再点击已展开行时收起它。"
          // This implies strict single-expansion mode unless modified.
          // So if I have A and B expanded, and I click A (no modifier):
          // It matches "If A expanded": remove A. What about B?
          // "收起其他行" applies to "Clicking a row" generally in single mode?
          // Usually "Accordion" behavior:
          // Click Expanded -> Collapse it. (Others? Usually collapse others too to enforce single?)
          // Click Collapsed -> Expand it, Collapse others.

          // Let's interpret "再点击已展开行时收起它" as JUST collapse it?
          // But if I clicked it with no modifier, I usually expect reset to single focus?
          // Let's follow requirement strictly:
          // "若该任务当前已展开：从 expandedIds 中移除该任务 id（即收起它），其他行保持收起。" -> implied NO change to others.
        } else {
          // If not expanded:
          // "设置 expandedIds 为仅包含该任务 id 的集合（收起其他所有行）。"
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

  // Sort tasks? The hook returns them appended, so oldest first (Queue).
  // Usually lists show newest at bottom or top?
  // Chat app: newest at bottom.
  // Task list: often newest at top?
  // Req doesn't specify order, but implies "tasks" prop order.
  // "按任务顺序渲染任务卡片"
  // We'll just map tasks. Since `useImageTaskQueue` appends new tasks,
  // `tasks` is oldest -> newest.

  return (
    <section className="flex flex-col gap-2 pb-10">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          isExpanded={expandedIds.has(task.id)}
          onToggleExpand={(e) => handleToggleExpand(task, e)}
          onCopyResult={onCopyResult}
        />
      ))}
    </section>
  );
}
