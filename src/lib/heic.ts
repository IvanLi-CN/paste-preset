import type { OutputFormat } from "./types.ts";

const HEIC_MIME_PREFIXES = ["image/heic", "image/heif"];

export interface NormalizedImageBlob {
  /**
   * Blob that is safe to decode with browser canvas APIs.
   * For HEIC/HEIF inputs this is a converted JPEG; otherwise
   * it is the original blob.
   */
  blob: Blob;
  /**
   * Original MIME type reported by the input blob. This is
   * used to decide the final output format when the user
   * selects Auto (same as source).
   */
  originalMimeType: string;
  /**
   * Whether a HEIC/HEIF conversion actually took place.
   */
  wasConverted: boolean;
}

export function isHeicMimeType(mimeType: string): boolean {
  return HEIC_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

/**
 * Convert HEIC/HEIF blobs to a canvas-friendly format (JPEG),
 * leaving other formats untouched.
 */
export async function normalizeImageBlobForCanvas(
  blob: Blob,
  _preferredOutputFormat: OutputFormat = "image/jpeg",
): Promise<NormalizedImageBlob> {
  const mimeType = blob.type || "application/octet-stream";

  if (!isHeicMimeType(mimeType)) {
    return {
      blob,
      originalMimeType: mimeType,
      wasConverted: false,
    };
  }

  // Lazy-load the converter only when we actually see a HEIC/HEIF image.
  let heic2anyModule: typeof import("heic2any");
  try {
    heic2anyModule = await import("heic2any");
  } catch (_error) {
    // Library failed to load – surface a clear, user-friendly error.
    throw new Error(
      "HEIC/HEIF conversion is not available in this environment. Please convert the image to JPEG or PNG and try again.",
    );
  }

  const heic2any = heic2anyModule.default;

  if (!heic2any) {
    throw new Error(
      "HEIC/HEIF conversion library failed to load correctly. Please convert the image to JPEG or PNG and try again.",
    );
  }

  let result: Blob | Blob[];
  try {
    result = await heic2any({
      blob,
      // Use PNG as an intermediate format so we avoid introducing
      // an extra lossy compression step before our own export.
      toType: "image/png",
    });
  } catch (_error) {
    throw new Error(
      "Failed to convert HEIC/HEIF image. Please convert it to JPEG or PNG and try again.",
    );
  }

  const convertedBlob = Array.isArray(result) ? result[0] : result;

  if (!(convertedBlob instanceof Blob)) {
    throw new Error("Unexpected HEIC conversion result.");
  }

  return {
    blob: convertedBlob,
    originalMimeType: mimeType,
    wasConverted: true,
  };
}
