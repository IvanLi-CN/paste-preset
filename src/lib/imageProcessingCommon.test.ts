import { describe, expect, it } from "vitest";
import {
  buildExifFromEmbedding,
  embedExifIntoImageBlob,
} from "./imageProcessingCommon.ts";

if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function arrayBuffer() {
    if (typeof FileReader !== "undefined") {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () =>
          reject(new Error("Blob.arrayBuffer unavailable"));
        reader.readAsArrayBuffer(this);
      });
    }
    return new Response(this).arrayBuffer();
  };
}

function makeJpegBytes(withApp0: boolean): Uint8Array {
  const bytes: number[] = [0xff, 0xd8]; // SOI

  if (withApp0) {
    // APP0 (JFIF) marker + length (16) + 14 bytes payload.
    bytes.push(0xff, 0xe0, 0x00, 0x10);
    bytes.push(
      0x4a,
      0x46,
      0x49,
      0x46,
      0x00, // "JFIF\0"
      0x01,
      0x01, // version 1.01
      0x00, // density units
      0x00,
      0x01, // X density
      0x00,
      0x01, // Y density
      0x00,
      0x00, // thumbnail
    );
  }

  bytes.push(0xff, 0xd9); // EOI
  return new Uint8Array(bytes);
}

describe("embedExifIntoImageBlob", () => {
  it("inserts an EXIF APP1 segment into JPEG payloads", async () => {
    const exifString = buildExifFromEmbedding({
      make: "TestCam",
      model: "Model42",
    });
    expect(exifString).toBeTruthy();

    const jpeg = makeJpegBytes(true);
    const blob = new Blob([jpeg.buffer as ArrayBuffer], { type: "image/jpeg" });

    const patched = await embedExifIntoImageBlob(
      blob,
      "image/jpeg",
      exifString,
    );
    expect(patched).toBeTruthy();
    if (!patched) {
      throw new Error("expected jpeg to be patched");
    }

    const out = new Uint8Array(await patched.arrayBuffer());

    // After SOI + APP0 segment, we should see the APP1 marker.
    const insertOffset = 2 + 2 + 0x0010;
    expect(out[insertOffset]).toBe(0xff);
    expect(out[insertOffset + 1]).toBe(0xe1);

    // Payload should start with "Exif\0\0".
    const payloadOffset = insertOffset + 4;
    const header = out.slice(payloadOffset, payloadOffset + 6);
    expect(Array.from(header)).toEqual([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
  });

  it("returns null when given non-JPEG bytes", async () => {
    const exifString = buildExifFromEmbedding({ make: "TestCam" });
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });

    await expect(
      embedExifIntoImageBlob(blob, "image/jpeg", exifString),
    ).resolves.toBeNull();
  });
});
