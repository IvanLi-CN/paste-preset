import type { OutputFormat } from "./types.ts";

const HEIC_MIME_PREFIXES = ["image/heic", "image/heif"];
const HEIC_BRAND_ALLOWLIST = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "mif1",
  "msf1",
]);

type HeicDetectedMimeType = "image/heic" | "image/heif";

type GlobalWithHeicOverride = typeof globalThis & {
  __heic2anyOverride?:
    | ((options: { blob: Blob; toType: string }) => Promise<Blob | Blob[]>)
    | "unavailable"
    | null;
  /**
   * Test-only marker used by E2E suites to assert that the preload
   * path was actually triggered in the running app.
   */
  __heicPreloadTriggered?: boolean | null;
};

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
  const normalized = mimeType.trim().toLowerCase();
  return HEIC_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isAmbiguousMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  return normalized === "" || normalized === "application/octet-stream";
}

function inferHeicMimeTypeFromName(
  name: string | undefined,
): HeicDetectedMimeType | null {
  if (!name) {
    return null;
  }

  const lower = name.trim().toLowerCase();
  if (lower.endsWith(".heic")) {
    return "image/heic";
  }
  if (lower.endsWith(".heif")) {
    return "image/heif";
  }
  return null;
}

function decodeAscii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

async function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    try {
      return await blob.arrayBuffer();
    } catch {
      // Fall back to FileReader/Response-based decoding below.
    }
  }

  if (typeof FileReaderSync !== "undefined") {
    try {
      return new FileReaderSync().readAsArrayBuffer(blob);
    } catch {
      // Fall back to async FileReader below.
    }
  }

  if (typeof FileReader !== "undefined") {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error("Blob.arrayBuffer unavailable"));
      reader.readAsArrayBuffer(blob);
    });
  }

  if (typeof Response !== "undefined") {
    try {
      return await new Response(blob).arrayBuffer();
    } catch {
      // Ignore and throw a clearer error below.
    }
  }

  throw new Error("Blob.arrayBuffer unavailable");
}

function sniffIsoBmffMajorBrand(bytes: Uint8Array): string | null {
  if (bytes.length < 12) {
    return null;
  }

  // ISO-BMFF starts with a box header: size (4 bytes) + type (4 bytes).
  // We only accept `ftyp` at the expected offset to keep sniffing fast.
  if (decodeAscii(bytes, 4, 8) !== "ftyp") {
    return null;
  }

  return decodeAscii(bytes, 8, 12);
}

async function detectHeicMimeType(
  blob: Blob,
  sourceName?: string,
  headerBytes?: Uint8Array,
): Promise<HeicDetectedMimeType | null> {
  const declared = blob.type;

  if (declared && isHeicMimeType(declared)) {
    return declared.trim().toLowerCase().startsWith("image/heif")
      ? "image/heif"
      : "image/heic";
  }

  const effectiveName =
    sourceName ??
    (typeof File !== "undefined" && blob instanceof File
      ? blob.name
      : undefined);

  if (isAmbiguousMimeType(declared || "")) {
    const byName = inferHeicMimeTypeFromName(effectiveName);
    if (byName) {
      return byName;
    }

    try {
      const bytes =
        headerBytes ??
        new Uint8Array(await readBlobAsArrayBuffer(blob.slice(0, 32)));
      const brand = sniffIsoBmffMajorBrand(bytes);
      if (!brand) {
        return null;
      }

      const normalizedBrand = brand.toLowerCase();
      if (!HEIC_BRAND_ALLOWLIST.has(normalizedBrand)) {
        return null;
      }

      if (normalizedBrand === "mif1" || normalizedBrand === "msf1") {
        return "image/heif";
      }

      return "image/heic";
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Determine a stable MIME type to use for routing/worker handoff.
 *
 * - Preserves a non-ambiguous `Blob.type`
 * - Detects HEIC/HEIF via name and ISO-BMFF `ftyp` brands when type is missing/ambiguous
 * - Falls back to `application/octet-stream` when unknown
 */
export async function getEffectiveMimeType(
  blob: Blob,
  sourceName?: string,
  headerBytes?: Uint8Array,
): Promise<string> {
  const declared = blob.type?.trim();

  if (declared && !isAmbiguousMimeType(declared)) {
    return declared;
  }

  const detectedHeic = await detectHeicMimeType(blob, sourceName, headerBytes);
  if (detectedHeic) {
    return detectedHeic;
  }

  if (declared && isAmbiguousMimeType(declared)) {
    return declared;
  }

  return "application/octet-stream";
}

let heicPreloadPromise: Promise<void> | null = null;

/**
 * Best-effort preloader for the HEIC conversion library.
 *
 * This is intentionally fire-and-forget: failures are swallowed here and
 * surfaced from the main `normalizeImageBlobForCanvas` path instead so
 * user-facing error handling stays in one place.
 */
export function preloadHeicConverter(): Promise<void> {
  if (heicPreloadPromise) {
    return heicPreloadPromise;
  }

  const globalWithOverride = globalThis as GlobalWithHeicOverride;

  // Mark the fact that we attempted to preload the converter so E2E tests
  // can assert behavior without relying on network-level heuristics.
  globalWithOverride.__heicPreloadTriggered = true;

  // Respect the special test hook: if the library is marked as unavailable,
  // do not attempt to import it here.
  if (globalWithOverride.__heic2anyOverride === "unavailable") {
    heicPreloadPromise = Promise.resolve();
    return heicPreloadPromise;
  }

  heicPreloadPromise = (async () => {
    try {
      if (typeof globalWithOverride.__heic2anyOverride === "function") {
        // Test-only path: an injected implementation will be used, no need
        // to import the real module ahead of time.
        return;
      }

      const module = await import("heic2any");
      // If the default export is missing we simply let the main conversion
      // flow surface a friendlier error when actually needed.
      if (!module.default) {
        return;
      }
    } catch {
      // Silently ignore preload failures – the main conversion code will
      // still attempt to import and translate any errors to user-friendly
      // messages.
    }
  })();

  return heicPreloadPromise;
}

/**
 * Convert HEIC/HEIF blobs to a canvas-friendly format (JPEG),
 * leaving other formats untouched.
 */
export async function normalizeImageBlobForCanvas(
  blob: Blob,
  sourceName?: string,
  _preferredOutputFormat: OutputFormat = "image/jpeg",
): Promise<NormalizedImageBlob> {
  const mimeType = await getEffectiveMimeType(blob, sourceName);

  // Optional test-only override hook:
  // Playwright E2E tests can inject `window.__heic2anyOverride` before the
  // app loads to simulate successful or failing HEIC conversions without
  // changing the default runtime behavior. When the property is not set,
  // the implementation behaves exactly as before.
  const globalWithOverride = globalThis as GlobalWithHeicOverride;

  if (!isHeicMimeType(mimeType)) {
    return {
      blob,
      originalMimeType: mimeType,
      wasConverted: false,
    };
  }

  // Special test hook: allow E2E tests to force the "library missing" path
  // without relying on module resolution failures inside the browser bundle.
  if (globalWithOverride.__heic2anyOverride === "unavailable") {
    throw new Error("heic.unavailable");
  }

  // Lazy-load the converter only when we actually see a HEIC/HEIF image.
  let heic2anyModule: typeof import("heic2any");
  try {
    if (typeof globalWithOverride.__heic2anyOverride === "function") {
      // Test-only path: use an injected converter implementation instead of
      // importing the real `heic2any` module.
      heic2anyModule = {
        default: globalWithOverride.__heic2anyOverride,
      } as unknown as typeof import("heic2any");
    } else {
      heic2anyModule = await import("heic2any");
    }
  } catch (_error) {
    // Library failed to load – surface a clear, user-friendly error.
    throw new Error("heic.unavailable");
  }

  const heic2any = heic2anyModule.default;

  if (!heic2any) {
    throw new Error("heic.libraryFailed");
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
    throw new Error("heic.convertFailed");
  }

  const convertedBlob = Array.isArray(result) ? result[0] : result;

  if (!(convertedBlob instanceof Blob)) {
    throw new Error("heic.unexpectedResult");
  }

  return {
    blob: convertedBlob,
    originalMimeType: mimeType,
    wasConverted: true,
  };
}
