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
   * Parsed metadata summary extracted from the original file.
   * This intentionally exposes only a small set of commonly
   * useful fields for display in the UI.
   */
  metadata?: ImageMetadataSummary;
  /**
   * Whether metadata (EXIF/IPTC/XMP) was stripped as part of the processing
   * pipeline. This is best-effort and may remain true even when the user
   * asked to preserve metadata but the pipeline could not (e.g. HEIC
   * conversion or format changes that require re-encoding).
   */
  metadataStripped?: boolean;
}

export interface ImageMetadataSummary {
  camera?: string;
  lens?: string;
  capturedAt?: string;
  exposure?: string;
  aperture?: string;
  iso?: number;
  focalLength?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export type AppStatus = "idle" | "processing" | "error";
