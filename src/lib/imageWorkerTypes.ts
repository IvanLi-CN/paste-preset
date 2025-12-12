import type { ImageMetadataSummary, ProcessingOptions } from "./types.ts";

export interface ProcessRequest {
  type: "process";
  id: string;
  buffer: ArrayBuffer;
  mimeType: string;
  sourceName?: string;
  options: ProcessingOptions;
}

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
