import { describe, expect, test } from "vitest";
import type { TranslationKey } from "../i18n";
import type { UserPresetRecord } from "./userPresets.ts";
import {
  describePresetDiff,
  getNextCustomPresetName,
  getPresetDisplayName,
} from "./userPresets.ts";
import { defaultUserSettings } from "./userSettings.ts";

describe("getNextCustomPresetName", () => {
  test("returns 自定义1 when there are no existing custom presets", () => {
    const presets: UserPresetRecord[] = [
      {
        id: "original",
        systemPresetId: "original",
        name: "Original",
        kind: "system",
        settings: {} as UserPresetRecord["settings"],
      },
    ];

    expect(getNextCustomPresetName(presets)).toBe("自定义1");
  });

  test("increments from the highest existing 自定义N", () => {
    const presets: UserPresetRecord[] = [
      {
        id: "user-1",
        systemPresetId: null,
        name: "自定义1",
        kind: "user",
        settings: {} as UserPresetRecord["settings"],
      },
      {
        id: "user-2",
        systemPresetId: null,
        name: "自定义2",
        kind: "user",
        settings: {} as UserPresetRecord["settings"],
      },
    ];

    expect(getNextCustomPresetName(presets)).toBe("自定义3");
  });

  test("ignores non-matching names and uses max N + 1", () => {
    const presets: UserPresetRecord[] = [
      {
        id: "user-a",
        systemPresetId: null,
        name: "自定2",
        kind: "user",
        settings: {} as UserPresetRecord["settings"],
      },
      {
        id: "user-b",
        systemPresetId: null,
        name: "自定义1",
        kind: "user",
        settings: {} as UserPresetRecord["settings"],
      },
      {
        id: "user-c",
        systemPresetId: null,
        name: "自定义7",
        kind: "user",
        settings: {} as UserPresetRecord["settings"],
      },
      {
        id: "user-d",
        systemPresetId: null,
        name: "Custom",
        kind: "user",
        settings: {} as UserPresetRecord["settings"],
      },
    ];

    expect(getNextCustomPresetName(presets)).toBe("自定义8");
  });

  test("does not fill holes and always uses max N + 1", () => {
    const presets: UserPresetRecord[] = [
      {
        id: "user-1",
        systemPresetId: null,
        name: "自定义1",
        kind: "user",
        settings: {} as UserPresetRecord["settings"],
      },
      {
        id: "user-3",
        systemPresetId: null,
        name: "自定义3",
        kind: "user",
        settings: {} as UserPresetRecord["settings"],
      },
    ];

    expect(getNextCustomPresetName(presets)).toBe("自定义4");
  });
});

describe("getPresetDisplayName", () => {
  const baseSettings = {} as UserPresetRecord["settings"];

  test("uses trimmed name when non-empty", () => {
    const preset: UserPresetRecord = {
      id: "user-1",
      systemPresetId: null,
      name: "  Custom Name  ",
      kind: "user",
      settings: baseSettings,
    };

    const t: (key: TranslationKey) => string = (key) => key;

    expect(getPresetDisplayName(preset, t)).toBe("Custom Name");
  });

  test("uses system preset translation when name is null", () => {
    const preset: UserPresetRecord = {
      id: "original",
      systemPresetId: "original",
      name: null,
      kind: "system",
      settings: baseSettings,
    };

    const t: (key: TranslationKey) => string = (key) => key;

    expect(getPresetDisplayName(preset, t)).toBe("settings.presets.original");
  });

  test("falls back to custom translation when name is empty and not a system preset", () => {
    const preset: UserPresetRecord = {
      id: "user-1",
      systemPresetId: null,
      name: null,
      kind: "user",
      settings: baseSettings,
    };

    const t: (key: TranslationKey) => string = (key) => key;

    expect(getPresetDisplayName(preset, t)).toBe("settings.presets.custom");
  });
});

describe("describePresetDiff", () => {
  test("returns empty string when there are no differences", () => {
    const t: (key: TranslationKey) => string = (key) => {
      if (key === "settings.presets.diff.size") return "Size: {value}";
      if (key === "settings.presets.diff.format") return "Format: {value}";
      if (key === "settings.presets.diff.quality") return "Quality: {value}";
      if (key === "settings.presets.diff.stripMetadata")
        return "Strip metadata";
      if (key === "settings.presets.diff.stripMetadata.short") {
        return "Strip meta";
      }
      return key;
    };

    const summary = describePresetDiff(defaultUserSettings, t);
    expect(summary).toBe("");
  });

  test("describes size when only dimensions change", () => {
    const summary = describePresetDiff(
      {
        ...defaultUserSettings,
        targetWidth: 800,
        targetHeight: 600,
      },
      (key) =>
        key === "settings.presets.diff.size"
          ? "Size: {value}"
          : (key as string),
    );
    expect(summary).toBe("Size: 800×600");
  });

  test("describes width-only override as width×auto", () => {
    const summary = describePresetDiff(
      {
        ...defaultUserSettings,
        targetWidth: 1024,
        targetHeight: null,
      },
      (key) =>
        key === "settings.presets.diff.size"
          ? "Size: {value}"
          : (key as string),
    );
    expect(summary).toBe("Size: 1024×auto");
  });

  test("describes format override", () => {
    const summary = describePresetDiff(
      {
        ...defaultUserSettings,
        outputFormat: "image/png",
      },
      (key) =>
        key === "settings.presets.diff.format"
          ? "Format: {value}"
          : key === "settings.output.format.png"
            ? "PNG"
            : (key as string),
    );
    expect(summary).toBe("Format: PNG");
  });

  test("describes stripMetadata override when enabled", () => {
    const summary = describePresetDiff(
      {
        ...defaultUserSettings,
        stripMetadata: true,
      },
      (key) => {
        if (key === "settings.presets.diff.stripMetadata") {
          return "Strip metadata";
        }
        if (key === "settings.presets.diff.stripMetadata.short") {
          return "Strip meta";
        }
        return key as string;
      },
    );
    expect(summary).toBe("Strip metadata");
  });
});
