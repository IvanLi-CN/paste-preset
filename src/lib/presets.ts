import type { OutputFormat, PresetId, ProcessingOptions } from "./types.ts";

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
  /**
   * Optional preset-specific override for the output format. When omitted,
   * the default configuration's outputFormat is used.
   */
  outputFormat?: OutputFormat;
  /**
   * Optional preset-specific override for metadata behaviour. When omitted,
   * the default configuration's stripMetadata is used.
   */
  stripMetadata?: boolean;
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
    outputFormat: "image/png",
    stripMetadata: true,
  },
  {
    id: "medium",
    label: "Medium",
    labelKey: "settings.presets.medium",
    maxLongSide: 1280,
    defaultQuality: 0.8,
    outputFormat: "image/png",
    stripMetadata: true,
  },
  {
    id: "small",
    label: "Small",
    labelKey: "settings.presets.small",
    maxLongSide: 800,
    defaultQuality: 0.8,
    outputFormat: "image/png",
    stripMetadata: true,
  },
];

export const DEFAULT_OPTIONS: ProcessingOptions = {
  // Default configuration represents the "Original" behaviour:
  // keep source resolution, auto output format, and preserve metadata.
  presetId: "original",
  targetWidth: null,
  targetHeight: null,
  lockAspectRatio: true,
  resizeMode: "fit",
  outputFormat: "auto",
  quality: 0.8,
  stripMetadata: false,
};
