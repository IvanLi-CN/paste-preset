export type PresetId = "original" | "large" | "medium" | "small" | null;

export type ResizeMode = "fit" | "fill" | "stretch";

export type OutputFormat = "auto" | "image/jpeg" | "image/png" | "image/webp";

export interface ProcessingOptions {
  presetId: PresetId;
  targetWidth: number | null;
  targetHeight: number | null;
  lockAspectRatio: boolean;
  resizeMode: ResizeMode;
  outputFormat: OutputFormat;
  /**
   * Quality in the range [0.1, 1.0] for lossy formats.
   * When null, a sensible default is derived from the preset.
   */
  quality: number | null;
  stripMetadata: boolean;
}

export interface ImageInfo {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  mimeType: string;
  fileSize: number;
  sourceName?: string;
  /**
   * Whether metadata (EXIF/IPTC/XMP) was stripped as part of the processing
   * pipeline. This is best-effort and may remain true even when the user
   * asked to preserve metadata but the pipeline could not (e.g. HEIC
   * conversion or format changes that require re-encoding).
   */
  metadataStripped?: boolean;
}

export type AppStatus = "idle" | "processing" | "error";
