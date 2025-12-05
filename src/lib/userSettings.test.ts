import { describe, expect, test } from "vitest";
import type { UserSettings } from "./types.ts";
import { defaultUserSettings, normalizeUserSettings } from "./userSettings.ts";

describe("normalizeUserSettings", () => {
  test("falls back to defaults when value is not an object", () => {
    expect(normalizeUserSettings(null)).toEqual(defaultUserSettings);
    expect(normalizeUserSettings(undefined)).toEqual(defaultUserSettings);
    expect(normalizeUserSettings("foo")).toEqual(defaultUserSettings);
  });

  test("normalizes invalid presetId back to default", () => {
    const input = {
      ...defaultUserSettings,
      presetId: "not-a-preset" as unknown as UserSettings["presetId"],
    } satisfies Partial<UserSettings>;

    const result = normalizeUserSettings(input);

    expect(result.presetId).toBe(defaultUserSettings.presetId);
  });

  test("normalizes non-positive dimensions to null", () => {
    const input = {
      ...defaultUserSettings,
      targetWidth: -100,
      targetHeight: 0,
    } satisfies Partial<UserSettings>;

    const result = normalizeUserSettings(input);

    expect(result.targetWidth).toBeNull();
    expect(result.targetHeight).toBeNull();
  });

  test("clamps and rounds quality into [0.1, 1.0]", () => {
    const tooLow = normalizeUserSettings({
      ...defaultUserSettings,
      quality: -1,
    });
    expect(tooLow.quality).toBe(0.1);

    const tooHigh = normalizeUserSettings({
      ...defaultUserSettings,
      quality: 2,
    });
    expect(tooHigh.quality).toBe(1);

    const withRounding = normalizeUserSettings({
      ...defaultUserSettings,
      quality: 0.834,
    });
    expect(withRounding.quality).toBe(0.83);
  });

  test("normalizes resizeMode and outputFormat back to defaults when invalid", () => {
    const input = {
      ...defaultUserSettings,
      resizeMode: "invalid" as unknown as UserSettings["resizeMode"],
      outputFormat: "image/unknown" as unknown as UserSettings["outputFormat"],
    } satisfies Partial<UserSettings>;

    const result = normalizeUserSettings(input);

    expect(result.resizeMode).toBe(defaultUserSettings.resizeMode);
    expect(result.outputFormat).toBe(defaultUserSettings.outputFormat);
  });

  test("normalizes booleans for lockAspectRatio and stripMetadata", () => {
    const input = {
      ...defaultUserSettings,
      lockAspectRatio: "yes" as unknown as UserSettings["lockAspectRatio"],
      stripMetadata: "no" as unknown as UserSettings["stripMetadata"],
    } satisfies Partial<UserSettings>;

    const result = normalizeUserSettings(input);

    expect(result.lockAspectRatio).toBe(defaultUserSettings.lockAspectRatio);
    expect(result.stripMetadata).toBe(defaultUserSettings.stripMetadata);
  });
});
