import { DEFAULT_OPTIONS } from "./presets.ts";
import type {
  OutputFormat,
  PresetId,
  ProcessingOptions,
  ResizeMode,
  UserSettings,
} from "./types.ts";

const STORAGE_KEY = "paste-preset:user-settings:v1";
const STORAGE_VERSION = 1 as const;

interface StoredUserSettingsV1 {
  version: typeof STORAGE_VERSION;
  settings: UserSettings;
}

export const defaultUserSettings: UserSettings = {
  ...DEFAULT_OPTIONS,
};

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeDimension(value: unknown): number | null {
  if (!isNumber(value)) {
    return null;
  }
  if (value <= 0) {
    return null;
  }
  return Math.round(value);
}

function normalizePresetId(value: unknown): PresetId {
  if (
    value === "original" ||
    value === "large" ||
    value === "medium" ||
    value === "small" ||
    value === null
  ) {
    return value;
  }
  return defaultUserSettings.presetId;
}

function normalizeResizeMode(value: unknown): ResizeMode {
  if (value === "fit" || value === "fill" || value === "stretch") {
    return value;
  }
  return defaultUserSettings.resizeMode;
}

function normalizeOutputFormat(value: unknown): OutputFormat {
  if (
    value === "auto" ||
    value === "image/jpeg" ||
    value === "image/png" ||
    value === "image/webp" ||
    value === "image/gif" ||
    value === "image/apng"
  ) {
    return value;
  }
  return defaultUserSettings.outputFormat;
}

function normalizeQuality(value: unknown): number | null {
  if (!isNumber(value)) {
    return defaultUserSettings.quality;
  }
  const clamped = Math.min(1, Math.max(0.1, value));
  const rounded = Math.round(clamped * 100) / 100;
  return rounded;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Normalizes an arbitrary value into a sane UserSettings object, falling back
 * to defaults when fields are missing or invalid.
 */
export function normalizeUserSettings(value: unknown): UserSettings {
  if (!value || typeof value !== "object") {
    return defaultUserSettings;
  }

  const candidate = value as Partial<UserSettings>;

  return {
    presetId: normalizePresetId(candidate.presetId),
    targetWidth: normalizeDimension(candidate.targetWidth),
    targetHeight: normalizeDimension(candidate.targetHeight),
    lockAspectRatio: normalizeBoolean(
      candidate.lockAspectRatio,
      defaultUserSettings.lockAspectRatio,
    ),
    resizeMode: normalizeResizeMode(candidate.resizeMode),
    outputFormat: normalizeOutputFormat(candidate.outputFormat),
    quality: normalizeQuality(candidate.quality),
    stripMetadata: normalizeBoolean(
      candidate.stripMetadata,
      defaultUserSettings.stripMetadata,
    ),
  };
}

function readRawFromStorage(): StoredUserSettingsV1 | null {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredUserSettingsV1>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (parsed.version !== STORAGE_VERSION || !parsed.settings) {
      return null;
    }
    return {
      version: STORAGE_VERSION,
      settings: parsed.settings as UserSettings,
    };
  } catch (error) {
    // Persistence is best-effort only; storage issues must not break the app.
    console.error(
      "[PastePreset] Failed to read user settings from storage:",
      error,
    );
    return null;
  }
}

function writeRawToStorage(settings: UserSettings | null): void {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return;
  }

  try {
    if (!settings) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const payload: StoredUserSettingsV1 = {
      version: STORAGE_VERSION,
      settings,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // Swallow storage errors; the app should continue to function without
    // persistence.
    console.error(
      "[PastePreset] Failed to write user settings to storage:",
      error,
    );
  }
}

export const userSettingsStorage = {
  /**
   * Loads persisted settings from storage, merged with defaults. If anything
   * goes wrong, defaults are returned.
   */
  load(): UserSettings {
    const raw = readRawFromStorage();
    if (!raw) {
      return defaultUserSettings;
    }
    return normalizeUserSettings(raw.settings);
  },

  /**
   * Persists the given settings. Errors are logged and otherwise ignored.
   */
  save(settings: UserSettings): void {
    writeRawToStorage(settings);
  },

  /**
   * Clears persisted settings and returns the in-memory defaults.
   */
  reset(): UserSettings {
    writeRawToStorage(null);
    return defaultUserSettings;
  },
};

export function userSettingsToProcessingOptions(
  settings: UserSettings,
): ProcessingOptions {
  return {
    presetId: settings.presetId,
    targetWidth: settings.targetWidth,
    targetHeight: settings.targetHeight,
    lockAspectRatio: settings.lockAspectRatio,
    resizeMode: settings.resizeMode,
    outputFormat: settings.outputFormat,
    quality: settings.quality,
    stripMetadata: settings.stripMetadata,
  };
}
