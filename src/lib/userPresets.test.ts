import { describe, expect, test } from "vitest";
import type { UserPresetRecord } from "./userPresets.ts";
import { getNextCustomPresetName } from "./userPresets.ts";

describe("getNextCustomPresetName", () => {
  test("returns 自定义1 when there are no existing custom presets", () => {
    const presets: UserPresetRecord[] = [
      {
        id: "original",
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
        name: "自定义1",
        kind: "user",
        settings: {} as UserPresetRecord["settings"],
      },
      {
        id: "user-2",
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
        name: "自定2",
        kind: "user",
        settings: {} as UserPresetRecord["settings"],
      },
      {
        id: "user-b",
        name: "自定义1",
        kind: "user",
        settings: {} as UserPresetRecord["settings"],
      },
      {
        id: "user-c",
        name: "自定义7",
        kind: "user",
        settings: {} as UserPresetRecord["settings"],
      },
      {
        id: "user-d",
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
        name: "自定义1",
        kind: "user",
        settings: {} as UserPresetRecord["settings"],
      },
      {
        id: "user-3",
        name: "自定义3",
        kind: "user",
        settings: {} as UserPresetRecord["settings"],
      },
    ];

    expect(getNextCustomPresetName(presets)).toBe("自定义4");
  });
});
