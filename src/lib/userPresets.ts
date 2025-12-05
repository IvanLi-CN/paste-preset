import type { TranslationKey } from "../i18n";
import { DEFAULT_OPTIONS, PRESETS } from "./presets.ts";
import type { UserSettings } from "./types.ts";
import { defaultUserSettings, normalizeUserSettings } from "./userSettings.ts";

export type PresetStorageMode = "normal" | "fallback";

export type SystemPresetId = "original" | "large" | "medium" | "small";

export interface UserPresetRecord {
  id: string; // globally unique identifier, including system preset ids
  systemPresetId: SystemPresetId | null;
  name: string | null; // display name; system presets use the current English labels
  kind: "system" | "user";
  settings: UserSettings; // snapshot compatible with docs/presets.md semantics
}

interface StoredUserPresetsV1 {
  version: typeof USER_PRESETS_STORAGE_VERSION;
  presets: UserPresetRecord[];
}

const USER_PRESETS_STORAGE_KEY = "paste-preset:user-presets:v1" as const;
const USER_PRESETS_STORAGE_VERSION = 1 as const;

let storageMode: PresetStorageMode = "normal";

function hasLocalStorage(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return "localStorage" in window && !!window.localStorage;
  } catch {
    return false;
  }
}

/**
 * Build the canonical four system presets as UserPresetRecord entries.
 *
 * This applies each preset's patch relative to DEFAULT_OPTIONS as defined in
 * docs/presets.md, producing a normalized UserSettings snapshot.
 */
function buildSystemUserPresets(): UserPresetRecord[] {
  const systemIds: SystemPresetId[] = ["original", "large", "medium", "small"];

  const base: UserSettings = {
    ...DEFAULT_OPTIONS,
  };

  return PRESETS.map((preset) => {
    const settings: UserSettings = {
      ...base,
      presetId: preset.id,
      // Clear explicit dimensions so maxLongSide behaviour is driven purely by
      // the preset configuration when no manual dimensions are set.
      targetWidth: null,
      targetHeight: null,
    };

    if (preset.defaultQuality != null) {
      settings.quality = preset.defaultQuality;
    }

    if (preset.outputFormat) {
      settings.outputFormat = preset.outputFormat;
    }

    if (typeof preset.stripMetadata === "boolean") {
      settings.stripMetadata = preset.stripMetadata;
    }

    return {
      id: preset.id,
      systemPresetId: systemIds.includes(preset.id as SystemPresetId)
        ? (preset.id as SystemPresetId)
        : null,
      name: preset.label,
      kind: "system",
      settings: normalizeUserSettings(settings),
    };
  });
}

function readRawUserPresets(): StoredUserPresetsV1 | null {
  if (!hasLocalStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(USER_PRESETS_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredUserPresetsV1>;
    if (!parsed || typeof parsed !== "object") {
      console.error(
        "[PastePreset] Invalid user presets payload in storage (not an object)",
      );
      return null;
    }

    if (
      parsed.version !== USER_PRESETS_STORAGE_VERSION ||
      !Array.isArray(parsed.presets)
    ) {
      console.error(
        "[PastePreset] Invalid user presets payload in storage (schema mismatch)",
      );
      return null;
    }

    return {
      version: USER_PRESETS_STORAGE_VERSION,
      presets: parsed.presets as UserPresetRecord[],
    };
  } catch (error) {
    // Persistence is best-effort only; storage issues must not break the app.
    console.error(
      "[PastePreset] Failed to read user presets from storage:",
      error,
    );
    return null;
  }
}

function writeRawUserPresets(payload: StoredUserPresetsV1 | null): void {
  if (storageMode === "fallback") {
    // Once we've detected a storage failure, future writes are ignored for the
    // remainder of the session.
    return;
  }

  if (!hasLocalStorage()) {
    return;
  }

  try {
    if (!payload) {
      window.localStorage.removeItem(USER_PRESETS_STORAGE_KEY);
      return;
    }

    const serialized = JSON.stringify(payload);
    window.localStorage.setItem(USER_PRESETS_STORAGE_KEY, serialized);
  } catch (error) {
    // Swallow storage errors; the app should continue to function without
    // persistence. Record fallback mode for higher-level callers.
    storageMode = "fallback";
    console.error(
      "[PastePreset] Failed to write user presets to storage:",
      error,
    );
  }
}

function normalizeStoredPreset(value: unknown): UserPresetRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<UserPresetRecord>;

  if (!candidate.id || typeof candidate.id !== "string") {
    return null;
  }

  const id = candidate.id.trim();
  if (!id) {
    return null;
  }

  const kind =
    candidate.kind === "system" || candidate.kind === "user"
      ? candidate.kind
      : "user";

  const rawSystemPresetId = (
    candidate as {
      systemPresetId?: unknown;
    }
  ).systemPresetId;

  const systemPresetId: SystemPresetId | null =
    rawSystemPresetId === "original" ||
    rawSystemPresetId === "large" ||
    rawSystemPresetId === "medium" ||
    rawSystemPresetId === "small"
      ? rawSystemPresetId
      : kind === "system" &&
          (id === "original" ||
            id === "large" ||
            id === "medium" ||
            id === "small")
        ? (id as SystemPresetId)
        : null;

  const name = typeof candidate.name === "string" ? candidate.name : null;

  const normalizedSettings = normalizeUserSettings(candidate.settings);

  return {
    id,
    systemPresetId,
    name,
    kind,
    settings: normalizedSettings,
  };
}

export function getNextCustomPresetName(presets: UserPresetRecord[]): string {
  const prefix = "自定义";
  const usedNumbers: number[] = [];

  for (const preset of presets) {
    if (typeof preset.name !== "string") continue;
    if (!preset.name.startsWith(prefix)) continue;

    const suffix = preset.name.slice(prefix.length);
    const n = Number.parseInt(suffix, 10);
    if (!Number.isNaN(n) && n > 0) {
      usedNumbers.push(n);
    }
  }

  if (usedNumbers.length === 0) {
    return "自定义1";
  }

  const maxN = Math.max(...usedNumbers);
  return `${prefix}${maxN + 1}`;
}

export function getPresetDisplayName(
  preset: UserPresetRecord,
  t: (key: TranslationKey) => string,
): string {
  const raw = preset.name?.trim();
  if (raw) {
    return raw;
  }

  if (preset.systemPresetId) {
    const key = `settings.presets.${preset.systemPresetId}` as TranslationKey;
    return t(key);
  }

  return t("settings.presets.custom" as TranslationKey);
}

export interface PresetDiffToken {
  kind: "size" | "format" | "quality" | "metadata";
  short: string;
}

export function getPresetDiffTokens(
  settings: UserSettings,
  t: (key: TranslationKey) => string,
): PresetDiffToken[] {
  const width = settings.targetWidth;
  const height = settings.targetHeight;

  const widthChanged =
    width !== null && width !== defaultUserSettings.targetWidth;
  const heightChanged =
    height !== null && height !== defaultUserSettings.targetHeight;

  const tokens: PresetDiffToken[] = [];

  if (widthChanged || heightChanged) {
    const widthLabel = widthChanged && width !== null ? String(width) : "auto";
    const heightLabel =
      heightChanged && height !== null ? String(height) : "auto";

    tokens.push({
      kind: "size",
      short: `${widthLabel}×${heightLabel}`,
    });
  }

  if (settings.outputFormat !== defaultUserSettings.outputFormat) {
    const formatLabelKey =
      settings.outputFormat === "image/jpeg"
        ? "settings.output.format.jpeg"
        : settings.outputFormat === "image/png"
          ? "settings.output.format.png"
          : settings.outputFormat === "image/webp"
            ? "settings.output.format.webp"
            : "settings.output.format.auto";
    const formatLabel = t(formatLabelKey as TranslationKey);
    tokens.push({
      kind: "format",
      short: formatLabel,
    });
  }

  if (
    settings.quality != null &&
    settings.quality !== defaultUserSettings.quality
  ) {
    const percent = Math.round(settings.quality * 100);
    tokens.push({
      kind: "quality",
      short: `${percent}%`,
    });
  }

  if (settings.stripMetadata && !defaultUserSettings.stripMetadata) {
    tokens.push({
      kind: "metadata",
      short: t("settings.presets.diff.stripMetadata.short" as TranslationKey),
    });
  }

  return tokens;
}

export function describePresetDiff(
  settings: UserSettings,
  t: (key: TranslationKey) => string,
): string {
  const tokens = getPresetDiffTokens(settings, t);
  if (!tokens.length) {
    return "";
  }

  const parts: string[] = [];

  for (const token of tokens) {
    switch (token.kind) {
      case "size":
        parts.push(
          t("settings.presets.diff.size" as TranslationKey).replace(
            "{value}",
            token.short,
          ),
        );
        break;
      case "format":
        parts.push(
          t("settings.presets.diff.format" as TranslationKey).replace(
            "{value}",
            token.short,
          ),
        );
        break;
      case "quality":
        parts.push(
          t("settings.presets.diff.quality" as TranslationKey).replace(
            "{value}",
            token.short,
          ),
        );
        break;
      case "metadata":
        parts.push(t("settings.presets.diff.stripMetadata" as TranslationKey));
        break;
    }
  }

  return parts.join(", ");
}

export const userPresetsStorage = {
  load(): { mode: PresetStorageMode; presets: UserPresetRecord[] } {
    const raw = readRawUserPresets();

    if (!raw) {
      const systemPresets = buildSystemUserPresets();

      writeRawUserPresets({
        version: USER_PRESETS_STORAGE_VERSION,
        presets: systemPresets,
      });

      return {
        mode: storageMode,
        presets: systemPresets,
      };
    }

    const normalized: UserPresetRecord[] = [];

    for (const entry of raw.presets) {
      const record = normalizeStoredPreset(entry);
      if (record) {
        normalized.push(record);
      }
    }

    return {
      mode: storageMode,
      presets: normalized.length > 0 ? normalized : buildSystemUserPresets(),
    };
  },

  save(presets: UserPresetRecord[]): {
    mode: PresetStorageMode;
    presets: UserPresetRecord[];
  } {
    writeRawUserPresets({
      version: USER_PRESETS_STORAGE_VERSION,
      presets,
    });

    return {
      mode: storageMode,
      presets,
    };
  },

  reset(): { mode: PresetStorageMode; presets: UserPresetRecord[] } {
    writeRawUserPresets(null);

    const systemPresets = buildSystemUserPresets();

    writeRawUserPresets({
      version: USER_PRESETS_STORAGE_VERSION,
      presets: systemPresets,
    });

    return {
      mode: storageMode,
      presets: systemPresets,
    };
  },
};

let initialUserPresetsState: {
  mode: PresetStorageMode;
  presets: UserPresetRecord[];
} | null = null;

export function getInitialUserPresetsState(): {
  mode: PresetStorageMode;
  presets: UserPresetRecord[];
} {
  if (!initialUserPresetsState) {
    initialUserPresetsState = userPresetsStorage.load();
  }
  return initialUserPresetsState;
}
