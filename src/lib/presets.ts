import type { PresetId, ProcessingOptions } from "./types.ts";

export interface PresetConfig {
  id: Exclude<PresetId, null>;
  label: string;
  /**
   * Translation key for the preset label. The English label value is kept
   * for backwards compatibility and as a fallback.
   */
  labelKey: string;
  /**
   * Longest side in pixels; null means keep the original size.
   */
  maxLongSide: number | null;
  /**
   * Default quality when this preset is selected, in [0.1, 1.0].
   */
  defaultQuality: number | null;
}

export const PRESETS: PresetConfig[] = [
  {
    id: "original",
    label: "Original",
    labelKey: "settings.presets.original",
    maxLongSide: null,
    defaultQuality: null,
  },
  {
    id: "large",
    label: "Large",
    labelKey: "settings.presets.large",
    maxLongSide: 2048,
    defaultQuality: 0.85,
  },
  {
    id: "medium",
    label: "Medium",
    labelKey: "settings.presets.medium",
    maxLongSide: 1280,
    defaultQuality: 0.8,
  },
  {
    id: "small",
    label: "Small",
    labelKey: "settings.presets.small",
    maxLongSide: 800,
    defaultQuality: 0.8,
  },
];

export const DEFAULT_OPTIONS: ProcessingOptions = {
  presetId: "medium",
  targetWidth: null,
  targetHeight: null,
  lockAspectRatio: true,
  resizeMode: "fit",
  outputFormat: "auto",
  quality: 0.8,
  stripMetadata: true,
};
