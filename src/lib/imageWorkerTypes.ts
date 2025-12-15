import type { ExifEmbeddingData } from "./imageProcessingCommon.ts";
import type { ImageMetadataSummary, ProcessingOptions } from "./types.ts";

export interface ProcessBufferRequest {
  type: "process";
  id: string;
  buffer: ArrayBuffer;
  mimeType: string;
  sourceName?: string;
  options: ProcessingOptions;
}

export interface ProcessBitmapRequest {
  type: "processBitmap";
  id: string;
  bitmap: ImageBitmap;
  sourceMimeType: string;
  metadata?: ImageMetadataSummary;
  exifEmbedding?: ExifEmbeddingData;
  sourceName?: string;
  options: ProcessingOptions;
}

export type ProcessRequest = ProcessBufferRequest | ProcessBitmapRequest;

export interface ProcessSuccess {
  type: "success";
  id: string;
  resultBuffer: ArrayBuffer;
  resultMimeType: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  metadata?: ImageMetadataSummary;
  metadataStripped: boolean;
  /**
   * Optional preview-friendly copy of the decoded source when the
   * original format is not natively displayable (e.g. HEIC).
   */
  normalizedBuffer?: ArrayBuffer;
  normalizedMimeType?: string;
}

export interface ProcessFailure {
  type: "failure";
  id: string;
  errorMessage: string;
}

export type ProcessResponse = ProcessSuccess | ProcessFailure;
