import { describe, expect, test } from "vitest";
import type { TranslationKey } from "../i18n";
import type { UserPresetRecord } from "./userPresets.ts";
import {
  getNextCustomPresetName,
  getPresetDisplayName,
} from "./userPresets.ts";

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
