import { useTranslation } from "../i18n";
import type { AppStatus } from "../lib/types.ts";

interface StatusBarProps {
  status: AppStatus;
  processingError: string | null;
  clipboardError: string | null;
}

export function StatusBar(props: StatusBarProps) {
  const { status, processingError, clipboardError } = props;
  const { t } = useTranslation();

  if (!processingError && !clipboardError && status === "idle") {
    return null;
  }

  const messages: { id: string; type: "error" | "info"; text: string }[] = [];

  if (status === "processing") {
    messages.push({
      id: "processing",
      type: "info",
      text: t("status.processing"),
    });
  }
  if (processingError) {
    messages.push({
      id: "processing-error",
      type: "error",
      text: processingError,
    });
  }
  if (clipboardError) {
    messages.push({
      id: "clipboard-error",
      type: "error",
      text: clipboardError,
    });
  }

  return (
    <div className="fixed inset-x-0 bottom-4 flex justify-center px-4">
      <div className="flex max-w-xl flex-col gap-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={[
              "alert shadow",
              message.type === "error" ? "alert-error" : "alert-info",
            ].join(" ")}
            role={message.type === "error" ? "alert" : "status"}
            aria-live={message.type === "error" ? "assertive" : "polite"}
          >
            <span className="text-sm">{message.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
