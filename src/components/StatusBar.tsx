import { useTranslation } from "../i18n";
import type { AppStatus } from "../lib/types.ts";
import type { OfflineReadiness, PwaUpdateStatus } from "../pwa/pwaRuntime.ts";

interface StatusBarProps {
  status: AppStatus;
  processingError: string | null;
  clipboardError: string | null;
  isOffline: boolean;
  offlineReadiness: OfflineReadiness;
  updateStatus: PwaUpdateStatus;
  onReloadNow: () => void;
  onLater: () => void;
}

export function StatusBar(props: StatusBarProps) {
  const {
    status,
    processingError,
    clipboardError,
    isOffline,
    offlineReadiness,
    updateStatus,
    onReloadNow,
    onLater,
  } = props;
  const { t } = useTranslation();

  const messages: {
    id: string;
    type: "error" | "info" | "warning";
    text: string;
    actions?: {
      id: string;
      label: string;
      onClick: () => void;
      tone: "primary" | "ghost";
    }[];
  }[] = [];

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
  if (isOffline) {
    const offlineText = (() => {
      switch (offlineReadiness) {
        case "full-ready":
          return t("pwa.offline.fullReady");
        case "warming":
          return t("pwa.offline.warming");
        case "warmup-failed":
          return t("pwa.offline.warmupFailed");
        case "unsupported":
          return t("pwa.offline.notice");
        default:
          return t("pwa.offline.shellReady");
      }
    })();

    messages.push({
      id: "offline",
      type: "warning",
      text: offlineText,
    });
  } else if (offlineReadiness === "warmup-failed") {
    messages.push({
      id: "offline-warmup-failed",
      type: "info",
      text: t("pwa.warmup.failed"),
    });
  }
  if (updateStatus === "available") {
    messages.push({
      id: "update-available",
      type: "warning",
      text: t("pwa.update.available"),
      actions: [
        {
          id: "reload-now",
          label: t("pwa.update.reloadNow"),
          onClick: onReloadNow,
          tone: "primary",
        },
        {
          id: "later",
          label: t("pwa.update.later"),
          onClick: onLater,
          tone: "ghost",
        },
      ],
    });
  }
  if (updateStatus === "activating") {
    messages.push({
      id: "update-activating",
      type: "info",
      text: t("pwa.update.activating"),
    });
  }

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-4 flex justify-center px-4">
      <div className="flex max-w-xl flex-col gap-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={[
              "alert shadow",
              message.type === "error"
                ? "alert-error"
                : message.type === "warning"
                  ? "alert-warning"
                  : "alert-info",
            ].join(" ")}
            role={message.type === "error" ? "alert" : "status"}
            aria-live={message.type === "error" ? "assertive" : "polite"}
          >
            <div className="flex w-full items-center justify-between gap-3">
              <span className="text-sm">{message.text}</span>
              {message.actions && message.actions.length > 0 ? (
                <div className="flex shrink-0 items-center gap-2">
                  {message.actions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className={[
                        "btn btn-xs",
                        action.tone === "primary" ? "btn-primary" : "btn-ghost",
                      ].join(" ")}
                      onClick={action.onClick}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
