import type { SniffResult } from "./animatedTypes";

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function readFourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );
}

function isGif(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false;
  const header = String.fromCharCode(
    bytes[0],
    bytes[1],
    bytes[2],
    bytes[3],
    bytes[4],
    bytes[5],
  );
  return header === "GIF87a" || header === "GIF89a";
}

function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  return (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function isApng(bytes: Uint8Array): boolean {
  if (!isPng(bytes)) return false;

  // Scan chunk headers for the animation control chunk (acTL).
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32BE(bytes, offset);
    const type = readFourCC(bytes, offset + 4);

    if (type === "acTL") {
      return true;
    }
    if (type === "IEND") {
      return false;
    }

    const next = offset + 12 + length;
    if (next <= offset || next > bytes.length) {
      return false;
    }
    offset = next;
  }

  return false;
}

function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  return readFourCC(bytes, 0) === "RIFF" && readFourCC(bytes, 8) === "WEBP";
}

function isAnimatedWebp(bytes: Uint8Array): boolean {
  if (!isWebp(bytes)) return false;

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = readFourCC(bytes, offset);
    const size = readUint32LE(bytes, offset + 4);

    if (type === "ANIM" || type === "ANMF") {
      return true;
    }

    const paddedSize = size + (size % 2);
    const next = offset + 8 + paddedSize;
    if (next <= offset || next > bytes.length) {
      break;
    }
    offset = next;
  }

  return false;
}

export function sniffImage(
  bytes: Uint8Array,
  declaredMimeType: string,
): SniffResult {
  const declared = declaredMimeType.trim().toLowerCase();

  if (isGif(bytes)) {
    return { effectiveMimeType: "image/gif", isAnimated: true };
  }

  if (isApng(bytes)) {
    return { effectiveMimeType: "image/apng", isAnimated: true };
  }

  if (isWebp(bytes)) {
    return {
      effectiveMimeType: "image/webp",
      isAnimated: isAnimatedWebp(bytes),
    };
  }

  if (isPng(bytes)) {
    return { effectiveMimeType: "image/png", isAnimated: false };
  }

  // Fallback: trust the declared type if it is a known image type.
  if (
    declared === "image/jpeg" ||
    declared === "image/png" ||
    declared === "image/webp" ||
    declared === "image/gif" ||
    declared === "image/apng"
  ) {
    return {
      effectiveMimeType: declared,
      isAnimated: declared === "image/gif" || declared === "image/apng",
    };
  }

  return {
    effectiveMimeType: declared || "application/octet-stream",
    isAnimated: false,
  };
}
