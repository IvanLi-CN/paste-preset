import { useEffect, useState } from "react";

export interface AppVersionState {
  version: string | null;
  loading: boolean;
  error: string | null;
}

export function useAppVersion(): AppVersionState {
  const [version, setVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let fallbackTimer: number | null = null;

    const load = async () => {
      try {
        const baseUrl = (import.meta.env.BASE_URL ?? "/") as string;
        const url = `${baseUrl}version.json`;
        const response = await fetch(url, { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as {
          version?: unknown;
        };

        const nextVersion =
          typeof data.version === "string" && data.version.trim().length > 0
            ? data.version.trim()
            : null;

        if (cancelled) {
          return;
        }

        setVersion(nextVersion);
        setError(null);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load version.json";

        console.error("[version] failed to load version.json:", caughtError);
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const scheduleLoad = () => {
      void load();
    };

    if (typeof window !== "undefined") {
      type IdleWindow = typeof window & {
        requestIdleCallback?: (callback: IdleRequestCallback) => number;
      };

      const idleWindow = window as IdleWindow;
      if (typeof idleWindow.requestIdleCallback === "function") {
        idleWindow.requestIdleCallback(() => {
          if (!cancelled) {
            scheduleLoad();
          }
        });
      } else {
        fallbackTimer = window.setTimeout(() => {
          fallbackTimer = null;
          if (!cancelled) {
            scheduleLoad();
          }
        }, 1000);
      }
    } else {
      scheduleLoad();
    }

    return () => {
      cancelled = true;
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
      }
    };
  }, []);

  return {
    version,
    loading,
    error,
  };
}
