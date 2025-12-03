import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ProcessingOptions, UserSettings } from "../lib/types.ts";
import {
  defaultUserSettings,
  normalizeUserSettings,
  userSettingsStorage,
  userSettingsToProcessingOptions,
} from "../lib/userSettings.ts";

interface UserSettingsContextValue {
  /**
   * Current persisted settings, representing the user's preferences.
   */
  settings: UserSettings;
  /**
   * ProcessingOptions view derived from settings, used by the image pipeline.
   */
  processingOptions: ProcessingOptions;
  /**
   * Shallow-merge update helper for settings. The update is normalized and
   * written back to storage.
   */
  updateSettings: (partial: Partial<UserSettings>) => void;
  /**
   * Reset settings to defaults and clear persisted storage.
   */
  resetSettings: () => void;
}

const UserSettingsContext = createContext<UserSettingsContextValue | undefined>(
  undefined,
);

export function UserSettingsProvider(props: { children: ReactNode }) {
  const { children } = props;

  const [settings, setSettings] = useState<UserSettings>(() => {
    // Initial load happens synchronously so the first paint reflects persisted
    // preferences when possible.
    const loaded = userSettingsStorage.load();
    return normalizeUserSettings(loaded ?? defaultUserSettings);
  });

  const updateSettings = useCallback((partial: Partial<UserSettings>) => {
    setSettings((previous) => {
      const merged = {
        ...previous,
        ...partial,
      };
      const normalized = normalizeUserSettings(merged);
      userSettingsStorage.save(normalized);
      return normalized;
    });
  }, []);

  const resetSettings = useCallback(() => {
    const next = userSettingsStorage.reset();
    setSettings(next);
  }, []);

  const processingOptions = useMemo(
    () => userSettingsToProcessingOptions(settings),
    [settings],
  );

  const value = useMemo<UserSettingsContextValue>(
    () => ({
      settings,
      processingOptions,
      updateSettings,
      resetSettings,
    }),
    [settings, processingOptions, updateSettings, resetSettings],
  );

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings(): UserSettingsContextValue {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error(
      "useUserSettings must be used within a UserSettingsProvider",
    );
  }
  return context;
}
