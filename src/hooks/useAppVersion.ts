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

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    version,
    loading,
    error,
  };
}
