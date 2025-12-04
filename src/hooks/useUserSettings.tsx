import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
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
import { useUserPresets } from "./useUserPresets.tsx";

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

  const {
    mode: presetsMode,
    presets,
    activePresetId,
    editingPresetId,
    unsavedSlot,
    setActivePresetId,
  } = useUserPresets();

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

  useEffect(() => {
    if (!settings.presetId) {
      return;
    }

    if (presetsMode === "normal") {
      // When editing a saved preset or working with an unsaved slot in normal
      // mode, the preset lifecycle context owns the active preset id and we
      // intentionally avoid overwriting it from user settings.
      if (editingPresetId || unsavedSlot) {
        return;
      }

      const activePreset = presets.find(
        (preset) => preset.id === activePresetId,
      );
      if (activePreset && activePreset.kind === "user") {
        // When a user preset is active, keep it as the primary source of
        // truth for selection instead of falling back to the underlying
        // system preset id from UserSettings.
        return;
      }
    }

    setActivePresetId(settings.presetId);
  }, [
    settings.presetId,
    presetsMode,
    presets,
    activePresetId,
    editingPresetId,
    unsavedSlot,
    setActivePresetId,
  ]);

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
