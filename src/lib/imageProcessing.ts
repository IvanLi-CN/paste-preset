import exifr from "exifr";
import piexif from "piexifjs";
import { normalizeImageBlobForCanvas } from "./heic.ts";
import { PRESETS } from "./presets.ts";
import type {
  ImageInfo,
  ImageMetadataSummary,
  OutputFormat,
  ProcessingOptions,
  ResizeMode,
} from "./types.ts";

export interface ProcessResult {
  source: ImageInfo;
  result: ImageInfo;
}

interface DecodeResult {
  bitmap: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  mimeType: string;
}

interface ExifEmbeddingData {
  make?: string;
  model?: string;
  lensModel?: string;
  dateTime?: Date | string;
  iso?: number;
  exposureTime?: number;
  fNumber?: number;
  focalLength?: number;
  latitude?: number;
  longitude?: number;
}

function formatExposureTime(seconds: number): string | undefined {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }

  if (seconds >= 1) {
    const rounded =
      seconds >= 10 ? Math.round(seconds) : Number(seconds.toFixed(1));
    return `${rounded} s`;
  }

  const denominator = Math.round(1 / seconds);
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return undefined;
  }
  return `1/${denominator} s`;
}

async function extractImageMetadata(
  blob: Blob,
): Promise<
  { summary?: ImageMetadataSummary; exif?: ExifEmbeddingData } | undefined
> {
  try {
    const data = await exifr.parse(blob, {
      // Keep the scope narrow: we only need core EXIF/TIFF + GPS.
      tiff: true,
      exif: true,
      gps: true,
      translateKeys: true,
      mergeOutput: true,
    });

    if (!data) {
      return undefined;
    }

    const make = (data.Make as string | undefined) ?? undefined;
    const model = (data.Model as string | undefined) ?? undefined;
    const deviceManufacturer =
      (data.DeviceManufacturer as string | undefined) ?? undefined;
    const deviceModel = (data.DeviceModel as string | undefined) ?? undefined;

    const camera =
      [make, model].filter(Boolean).join(" ") ||
      [deviceManufacturer, deviceModel].filter(Boolean).join(" ") ||
      undefined;

    const lens = (data.LensModel as string | undefined) ?? undefined;

    const dateTime =
      (data.DateTimeOriginal as Date | string | undefined) ??
      (data.CreateDate as Date | string | undefined) ??
      undefined;

    let capturedAt: string | undefined;
    if (dateTime instanceof Date) {
      capturedAt = dateTime.toLocaleString();
    } else if (typeof dateTime === "string" && dateTime.trim()) {
      capturedAt = dateTime;
    }

    const isoValue = data.ISO as number | undefined;
    const exposureSeconds =
      (data.ExposureTime as number | undefined) ??
      (typeof data.ShutterSpeedValue === "number"
        ? // ShutterSpeedValue is in APEX units; 2 ** -value ≈ exposure time.
          2 ** -(data.ShutterSpeedValue as number)
        : undefined);

    const fNumber = data.FNumber as number | undefined;
    const focalLength = data.FocalLength as number | undefined;

    const latitude = data.latitude as number | undefined;
    const longitude = data.longitude as number | undefined;

    const summary: ImageMetadataSummary = {};
    const exifEmbedding: ExifEmbeddingData = {};

    if (camera) summary.camera = camera;
    if (make) exifEmbedding.make = make;
    if (model) exifEmbedding.model = model;
    if (!exifEmbedding.make && deviceManufacturer) {
      exifEmbedding.make = deviceManufacturer;
    }
    if (!exifEmbedding.model && deviceModel) {
      exifEmbedding.model = deviceModel;
    }

    if (lens) summary.lens = lens;
    if (lens) exifEmbedding.lensModel = lens;

    if (capturedAt) summary.capturedAt = capturedAt;
    if (dateTime) exifEmbedding.dateTime = dateTime;

    const exposureText = exposureSeconds
      ? formatExposureTime(exposureSeconds)
      : undefined;
    if (exposureText) summary.exposure = exposureText;

    if (
      typeof fNumber === "number" &&
      Number.isFinite(fNumber) &&
      fNumber > 0
    ) {
      summary.aperture = `f/${fNumber.toFixed(1).replace(/\\.0$/, "")}`;
    }

    if (
      typeof isoValue === "number" &&
      Number.isFinite(isoValue) &&
      isoValue > 0
    ) {
      const isoRounded = Math.round(isoValue);
      summary.iso = isoRounded;
      exifEmbedding.iso = isoRounded;
    }

    if (
      typeof focalLength === "number" &&
      Number.isFinite(focalLength) &&
      focalLength > 0
    ) {
      summary.focalLength = `${focalLength.toFixed(1).replace(/\\.0$/, "")} mm`;
    }

    if (
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      summary.location = { latitude, longitude };
      exifEmbedding.latitude = latitude;
      exifEmbedding.longitude = longitude;
    }

    const hasSummary = Object.keys(summary).length > 0;
    const hasExif = Object.keys(exifEmbedding).length > 0;

    if (!hasSummary && !hasExif) {
      return undefined;
    }

    return {
      summary: hasSummary ? summary : undefined,
      exif: hasExif ? exifEmbedding : undefined,
    };
  } catch {
    // Metadata parsing is best-effort only; failures should not break processing.
    return undefined;
  }
}

function formatExifDateTime(
  value: Date | string | undefined,
): string | undefined {
  if (!value) {
    return undefined;
  }
  const date =
    value instanceof Date
      ? value
      : Number.isNaN(Date.parse(value))
        ? undefined
        : new Date(value);
  if (!date) {
    return undefined;
  }
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  // Standard EXIF datetime format.
  return `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;
}

function toExifRationalFromSeconds(
  seconds: number,
): [number, number] | undefined {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }
  if (seconds >= 1) {
    const denominator = 1_000_000;
    const numerator = Math.round(seconds * denominator);
    return [numerator, denominator];
  }
  const denominator = Math.round(1 / seconds);
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return undefined;
  }
  return [1, denominator];
}

function toExifRationalFromFloat(
  value: number | undefined,
  precision: number,
): [number, number] | undefined {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    precision <= 0
  ) {
    return undefined;
  }
  const denominator = precision;
  const numerator = Math.round(value * denominator);
  return [numerator, denominator];
}

function buildExifFromEmbedding(
  data: ExifEmbeddingData | undefined,
): string | undefined {
  if (!data) {
    return undefined;
  }

  const zeroth: Record<number, unknown> = {};
  const exif: Record<number, unknown> = {};
  const gps: Record<number, unknown> = {};

  if (data.make) {
    zeroth[piexif.ImageIFD.Make] = data.make;
  }
  if (data.model) {
    zeroth[piexif.ImageIFD.Model] = data.model;
  }

  const exifDate = formatExifDateTime(data.dateTime);
  if (exifDate) {
    zeroth[piexif.ImageIFD.DateTime] = exifDate;
    exif[piexif.ExifIFD.DateTimeOriginal] = exifDate;
    exif[piexif.ExifIFD.DateTimeDigitized] = exifDate;
  }

  if (data.lensModel) {
    exif[piexif.ExifIFD.LensModel] = data.lensModel;
  }

  const exposureRational = toExifRationalFromSeconds(
    data.exposureTime ?? Number.NaN,
  );
  if (exposureRational) {
    exif[piexif.ExifIFD.ExposureTime] = exposureRational;
  }

  const fNumberRational = toExifRationalFromFloat(data.fNumber, 100);
  if (fNumberRational) {
    exif[piexif.ExifIFD.FNumber] = fNumberRational;
  }

  if (
    typeof data.iso === "number" &&
    Number.isFinite(data.iso) &&
    data.iso > 0
  ) {
    const isoShort = Math.round(data.iso);
    exif[piexif.ExifIFD.ISOSpeedRatings] = [isoShort];
  }

  const focalLengthRational = toExifRationalFromFloat(data.focalLength, 100);
  if (focalLengthRational) {
    exif[piexif.ExifIFD.FocalLength] = focalLengthRational;
  }

  if (
    typeof data.latitude === "number" &&
    typeof data.longitude === "number" &&
    Number.isFinite(data.latitude) &&
    Number.isFinite(data.longitude)
  ) {
    const lat = data.latitude;
    const lng = data.longitude;
    const latRef = lat >= 0 ? "N" : "S";
    const lngRef = lng >= 0 ? "E" : "W";
    gps[piexif.GPSIFD.GPSLatitudeRef] = latRef;
    gps[piexif.GPSIFD.GPSLatitude] = piexif.GPSHelper.degToDmsRational(
      Math.abs(lat),
    );
    gps[piexif.GPSIFD.GPSLongitudeRef] = lngRef;
    gps[piexif.GPSIFD.GPSLongitude] = piexif.GPSHelper.degToDmsRational(
      Math.abs(lng),
    );
  }

  const exifObj: {
    "0th": Record<number, unknown>;
    Exif: Record<number, unknown>;
    GPS: Record<number, unknown>;
  } = {
    "0th": zeroth,
    Exif: exif,
    GPS: gps,
  };

  if (
    Object.keys(exifObj["0th"]).length === 0 &&
    Object.keys(exifObj.Exif).length === 0 &&
    Object.keys(exifObj.GPS).length === 0
  ) {
    return undefined;
  }

  return piexif.dump(exifObj);
}

function dataUrlToBlob(dataUrl: string, mimeType: string): Blob {
  const [, base64] = dataUrl.split(",", 2);
  if (!base64) {
    throw new Error("image.invalidDataUrl");
  }
  const binary = atob(base64);
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function stringToUint8Array(value: string): Uint8Array {
  const length = value.length;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    // piexifjs returns a binary string where each charCode is a byte.
    bytes[index] = value.charCodeAt(index) & 0xff;
  }
  return bytes;
}

function exifDumpToRawBytes(exifDump: string): Uint8Array {
  const full = stringToUint8Array(exifDump);
  // piexifjs.dump() returns the Exif APP1 payload including the
  // ASCII "Exif\0\0" header. Container formats like PNG (eXIf)
  // and WebP (EXIF chunk) expect only the TIFF header and IFD
  // structures, without this 6-byte prefix, so we strip it when present.
  if (
    full.length > 6 &&
    full[0] === 0x45 && // E
    full[1] === 0x78 && // x
    full[2] === 0x69 && // i
    full[3] === 0x66 && // f
    full[4] === 0x00 &&
    full[5] === 0x00
  ) {
    return full.subarray(6);
  }
  return full;
}

function readUint32BE(buffer: Uint8Array, offset: number): number {
  return (
    ((buffer[offset] << 24) |
      (buffer[offset + 1] << 16) |
      (buffer[offset + 2] << 8) |
      buffer[offset + 3]) >>>
    0
  );
}

function writeUint32BE(
  buffer: Uint8Array,
  offset: number,
  value: number,
): void {
  buffer[offset] = (value >>> 24) & 0xff;
  buffer[offset + 1] = (value >>> 16) & 0xff;
  buffer[offset + 2] = (value >>> 8) & 0xff;
  buffer[offset + 3] = value & 0xff;
}

function writeUint32LE(
  buffer: Uint8Array,
  offset: number,
  value: number,
): void {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
  buffer[offset + 3] = (value >>> 24) & 0xff;
}

// Precomputed CRC32 table for PNG chunk checksums.
const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 1) !== 0) {
        crc = 0xedb88320 ^ (crc >>> 1);
      } else {
        crc >>>= 1;
      }
    }
    table[index] = crc >>> 0;
  }
  return table;
})();

function crc32(buffer: Uint8Array, offset: number, length: number): number {
  let crc = 0xffffffff;
  const end = offset + length;
  for (let index = offset; index < end; index += 1) {
    crc = CRC32_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildPngChunk(type: string, data: Uint8Array): Uint8Array {
  if (type.length !== 4) {
    throw new Error("image.png.invalidChunkType");
  }

  const dataLength = data.length;
  const chunk = new Uint8Array(4 + 4 + dataLength + 4);

  // Length (big-endian)
  writeUint32BE(chunk, 0, dataLength);

  // Type
  for (let index = 0; index < 4; index += 1) {
    chunk[4 + index] = type.charCodeAt(index) & 0xff;
  }

  // Data
  chunk.set(data, 8);

  // CRC over type + data
  const crc = crc32(chunk, 4, 4 + dataLength);
  const crcOffset = 8 + dataLength;
  writeUint32BE(chunk, crcOffset, crc);

  return chunk;
}

function insertExifIntoPng(
  pngBytes: Uint8Array,
  exifBytes: Uint8Array,
): Uint8Array | null {
  // PNG signature: 137 80 78 71 13 10 26 10
  if (pngBytes.length < 8) {
    return null;
  }
  const signature = pngBytes.subarray(0, 8);
  if (
    signature[0] !== 0x89 ||
    signature[1] !== 0x50 ||
    signature[2] !== 0x4e ||
    signature[3] !== 0x47 ||
    signature[4] !== 0x0d ||
    signature[5] !== 0x0a ||
    signature[6] !== 0x1a ||
    signature[7] !== 0x0a
  ) {
    return null;
  }

  const chunks: Uint8Array[] = [];
  chunks.push(signature);

  let offset = 8;
  let inserted = false;

  while (offset + 8 <= pngBytes.length) {
    const length = readUint32BE(pngBytes, offset);
    const typeStart = offset + 4;
    const typeEnd = typeStart + 4;
    const dataStart = typeEnd;
    const dataEnd = dataStart + length;
    const crcStart = dataEnd;
    const crcEnd = crcStart + 4;

    if (
      typeEnd > pngBytes.length ||
      dataEnd > pngBytes.length ||
      crcEnd > pngBytes.length
    ) {
      return null;
    }

    const type0 = pngBytes[typeStart];
    const type1 = pngBytes[typeStart + 1];
    const type2 = pngBytes[typeStart + 2];
    const type3 = pngBytes[typeStart + 3];
    const type =
      String.fromCharCode(type0) +
      String.fromCharCode(type1) +
      String.fromCharCode(type2) +
      String.fromCharCode(type3);

    const chunk = pngBytes.subarray(offset, crcEnd);
    chunks.push(chunk);

    if (!inserted && type === "IHDR") {
      // Insert EXIF chunk right after IHDR so metadata stays near the header.
      const exifChunk = buildPngChunk("eXIf", exifBytes);
      chunks.push(exifChunk);
      inserted = true;
    }

    offset = crcEnd;

    if (type === "IEND") {
      break;
    }
  }

  if (!inserted) {
    const exifChunk = buildPngChunk("eXIf", exifBytes);
    // Append just before the final IEND chunk if possible.
    if (chunks.length >= 2) {
      const last = chunks[chunks.length - 1];
      chunks.splice(chunks.length - 1, 0, exifChunk);
      chunks.push(last);
    } else {
      chunks.push(exifChunk);
    }
  }

  let totalLength = 0;
  for (const chunk of chunks) {
    totalLength += chunk.length;
  }
  const result = new Uint8Array(totalLength);
  let writeOffset = 0;
  for (const chunk of chunks) {
    result.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }
  return result;
}

function buildWebpChunk(fourCC: string, data: Uint8Array): Uint8Array {
  if (fourCC.length !== 4) {
    throw new Error("image.webp.invalidChunkType");
  }

  const dataLength = data.length;
  const padding = dataLength % 2 === 1 ? 1 : 0;
  const chunk = new Uint8Array(4 + 4 + dataLength + padding);

  // Tag
  for (let index = 0; index < 4; index += 1) {
    chunk[index] = fourCC.charCodeAt(index) & 0xff;
  }

  // Size (little-endian, without padding)
  writeUint32LE(chunk, 4, dataLength);

  // Data
  chunk.set(data, 8);

  // Padding byte is left as 0 if present.
  return chunk;
}

function insertExifIntoWebp(
  webpBytes: Uint8Array,
  exifBytes: Uint8Array,
): Uint8Array | null {
  if (webpBytes.length < 12) {
    return null;
  }

  // RIFF header: "RIFF" <size> "WEBP"
  if (
    webpBytes[0] !== 0x52 || // R
    webpBytes[1] !== 0x49 || // I
    webpBytes[2] !== 0x46 || // F
    webpBytes[3] !== 0x46 || // F
    webpBytes[8] !== 0x57 || // W
    webpBytes[9] !== 0x45 || // E
    webpBytes[10] !== 0x42 || // B
    webpBytes[11] !== 0x50 // P
  ) {
    return null;
  }

  const existingPayload = webpBytes.subarray(12);
  const exifChunk = buildWebpChunk("EXIF", exifBytes);

  // New RIFF size is size of "WEBP" + payload + new chunk.
  const newFileSize = 4 + existingPayload.length + exifChunk.length;

  const result = new Uint8Array(12 + existingPayload.length + exifChunk.length);

  // Copy "RIFF"
  result.set(webpBytes.subarray(0, 4), 0);
  // Update size
  writeUint32LE(result, 4, newFileSize);
  // Copy "WEBP"
  result.set(webpBytes.subarray(8, 12), 8);
  // Copy existing payload and append EXIF chunk.
  result.set(existingPayload, 12);
  result.set(exifChunk, 12 + existingPayload.length);

  return result;
}

async function embedExifIntoImageBlob(
  blob: Blob,
  mimeType: string,
  exifString: string | undefined,
): Promise<Blob | null> {
  if (!exifString) {
    return null;
  }

  if (mimeType !== "image/png" && mimeType !== "image/webp") {
    return null;
  }

  const exifBytes = exifDumpToRawBytes(exifString);
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (mimeType === "image/png") {
    const patched = insertExifIntoPng(bytes, exifBytes);
    if (!patched) {
      return null;
    }
    return new Blob([patched.buffer as ArrayBuffer], { type: mimeType });
  }

  const patched = insertExifIntoWebp(bytes, exifBytes);
  if (!patched) {
    return null;
  }
  return new Blob([patched.buffer as ArrayBuffer], { type: mimeType });
}

function getOutputMimeType(
  sourceMime: string,
  format: OutputFormat,
): OutputFormat | "image/jpeg" | "image/png" | "image/webp" {
  if (format !== "auto") {
    return format;
  }

  if (
    sourceMime === "image/jpeg" ||
    sourceMime === "image/png" ||
    sourceMime === "image/webp"
  ) {
    return sourceMime;
  }

  // Fallback for other formats (including HEIC once supported): use JPEG.
  return "image/jpeg";
}

function computeTargetSize(
  sourceWidth: number,
  sourceHeight: number,
  options: ProcessingOptions,
): { width: number; height: number } {
  const explicitWidth = options.targetWidth;
  const explicitHeight = options.targetHeight;

  const hasExplicitWidth = explicitWidth != null;
  const hasExplicitHeight = explicitHeight != null;

  // 1) If both dimensions are explicitly specified, respect them as-is.
  if (hasExplicitWidth && hasExplicitHeight) {
    return { width: explicitWidth, height: explicitHeight };
  }

  // 2) Only width is set: derive height from source aspect ratio.
  if (hasExplicitWidth && !hasExplicitHeight) {
    const ratio = sourceHeight / sourceWidth;
    return { width: explicitWidth, height: Math.round(explicitWidth * ratio) };
  }

  // 3) Only height is set: derive width from source aspect ratio.
  if (!hasExplicitWidth && hasExplicitHeight) {
    const ratio = sourceWidth / sourceHeight;
    return {
      width: Math.round(explicitHeight * ratio),
      height: explicitHeight,
    };
  }

  // 4) No explicit dimensions: fall back to preset-based longest-side rules
  // if a preset is selected, otherwise keep the original size.
  const preset = options.presetId
    ? PRESETS.find((item) => item.id === options.presetId)
    : null;
  const maxLongSide = preset?.maxLongSide ?? null;

  if (maxLongSide && maxLongSide > 0) {
    const longSide = Math.max(sourceWidth, sourceHeight);
    if (longSide > maxLongSide) {
      const scale = maxLongSide / longSide;
      return {
        width: Math.round(sourceWidth * scale),
        height: Math.round(sourceHeight * scale),
      };
    }
  }

  // 5) Default: keep original resolution.
  return { width: sourceWidth, height: sourceHeight };
}

const MAX_TARGET_SIDE = 8_000;
const MAX_TARGET_PIXELS = 40_000_000;

function drawToCanvas(
  image: ImageBitmap | HTMLImageElement,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  resizeMode: ResizeMode,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("image.canvasContext");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (resizeMode === "stretch") {
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    return canvas;
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;

  if (resizeMode === "fit") {
    let drawWidth = targetWidth;
    let drawHeight = Math.round(targetWidth / sourceRatio);

    if (drawHeight > targetHeight) {
      drawHeight = targetHeight;
      drawWidth = Math.round(targetHeight * sourceRatio);
    }

    const dx = Math.round((targetWidth - drawWidth) / 2);
    const dy = Math.round((targetHeight - drawHeight) / 2);

    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
    return canvas;
  }

  if (resizeMode === "fill") {
    let sx = 0;
    let sy = 0;
    let sWidth = sourceWidth;
    let sHeight = sourceHeight;

    if (sourceRatio > targetRatio) {
      const newWidth = sourceHeight * targetRatio;
      sx = Math.round((sourceWidth - newWidth) / 2);
      sWidth = Math.round(newWidth);
    } else {
      const newHeight = sourceWidth / targetRatio;
      sy = Math.round((sourceHeight - newHeight) / 2);
      sHeight = Math.round(newHeight);
    }

    ctx.drawImage(
      image,
      sx,
      sy,
      sWidth,
      sHeight,
      0,
      0,
      targetWidth,
      targetHeight,
    );
    return canvas;
  }

  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
  return canvas;
}

async function decodeImage(blob: Blob): Promise<DecodeResult> {
  const mimeType = blob.type || "image/png";

  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(blob);
    return {
      bitmap,
      width: bitmap.width,
      height: bitmap.height,
      mimeType,
    };
  }

  const img = new Image();
  const url = URL.createObjectURL(blob);

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image.decodeFailed"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }

  return {
    bitmap: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    mimeType,
  };
}

function createImageInfo(
  blob: Blob,
  width: number,
  height: number,
  sourceName?: string,
  overrideUrlBlob?: Blob,
): ImageInfo {
  const urlBlob = overrideUrlBlob ?? blob;

  return {
    blob,
    url: URL.createObjectURL(urlBlob),
    width,
    height,
    mimeType: blob.type || "image/png",
    fileSize: blob.size,
    sourceName,
  };
}

export async function processImageBlob(
  blob: Blob,
  options: ProcessingOptions,
  sourceName?: string,
): Promise<ProcessResult> {
  const [normalized, parsedMetadata] = await Promise.all([
    normalizeImageBlobForCanvas(blob),
    extractImageMetadata(blob),
  ]);

  const metadata = parsedMetadata?.summary;
  const exifEmbedding = parsedMetadata?.exif;

  const {
    bitmap,
    width: sourceWidth,
    height: sourceHeight,
  } = await decodeImage(normalized.blob);

  const target = computeTargetSize(sourceWidth, sourceHeight, options);

  if (
    target.width <= 0 ||
    target.height <= 0 ||
    target.width > MAX_TARGET_SIDE ||
    target.height > MAX_TARGET_SIDE ||
    target.width * target.height > MAX_TARGET_PIXELS
  ) {
    throw new Error("image.tooLarge");
  }

  const mime = getOutputMimeType(
    normalized.originalMimeType,
    options.outputFormat,
  );

  const canPassThrough =
    !normalized.wasConverted &&
    !options.stripMetadata &&
    target.width === sourceWidth &&
    target.height === sourceHeight &&
    mime === normalized.originalMimeType;

  let resultBlob: Blob;
  let didEmbedMetadata = false;

  if (canPassThrough) {
    resultBlob = blob;
  } else {
    const canvas = drawToCanvas(
      bitmap,
      sourceWidth,
      sourceHeight,
      target.width,
      target.height,
      options.resizeMode,
    );

    const exifString = buildExifFromEmbedding(exifEmbedding);

    const quality =
      mime === "image/jpeg" || mime === "image/webp"
        ? (options.quality ?? 0.8)
        : undefined;

    if (mime === "image/jpeg" && !options.stripMetadata) {
      const dataUrl = canvas.toDataURL(
        mime,
        typeof quality === "number" ? quality : undefined,
      );
      const finalDataUrl =
        exifString != null ? piexif.insert(exifString, dataUrl) : dataUrl;
      resultBlob = dataUrlToBlob(finalDataUrl, mime);
      didEmbedMetadata = exifString != null;
    } else {
      resultBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (!b) {
              reject(new Error("image.exportFailed"));
              return;
            }
            resolve(b);
          },
          mime,
          quality,
        );
      }).then(async (exportedBlob) => {
        if (
          !options.stripMetadata &&
          (mime === "image/png" || mime === "image/webp") &&
          exifString
        ) {
          try {
            const patched = await embedExifIntoImageBlob(
              exportedBlob,
              mime,
              exifString,
            );
            if (patched) {
              didEmbedMetadata = true;
              return patched;
            }
          } catch (error) {
            // Metadata embedding is best-effort only; failures must not break export.
            console.error(
              "[PastePreset] Failed to embed metadata into result image:",
              error,
            );
          }
        }
        return exportedBlob;
      });
    }
  }

  // If we can pass the original blob through untouched, we consider metadata
  // preserved. When we have to re-encode the image, metadata is treated as
  // stripped unless we explicitly re-insert a best-effort EXIF payload.
  const metadataStripped = canPassThrough ? false : !didEmbedMetadata;

  const sourceInfo: ImageInfo = normalized.wasConverted
    ? // For formats like HEIC/HEIF we keep the original blob for
      // metadata/size, but use the converted blob for preview so
      // the browser can display the image without errors. The original
      // file's metadata is never modified by the pipeline.
      {
        ...createImageInfo(
          blob,
          sourceWidth,
          sourceHeight,
          sourceName,
          normalized.blob,
        ),
        metadataStripped: false,
        metadata,
      }
    : {
        // For the source image we always keep the original blob untouched,
        // so from the pipeline's perspective its metadata is preserved.
        ...createImageInfo(blob, sourceWidth, sourceHeight, sourceName),
        metadataStripped: false,
        metadata,
      };
  const resultInfo: ImageInfo = {
    ...createImageInfo(resultBlob, target.width, target.height, sourceName),
    metadataStripped,
    // Only surface metadata details when we believe the exported file
    // actually carries EXIF/GPS information.
    metadata: metadataStripped ? undefined : metadata,
  };

  return {
    source: sourceInfo,
    result: resultInfo,
  };
}
