import { afterEach, describe, expect, it, vi } from "vitest";
import { getEffectiveMimeType, normalizeImageBlobForCanvas } from "./heic.ts";

type GlobalWithHeicOverride = typeof globalThis & {
  __heic2anyOverride?:
    | ((options: { blob: Blob; toType: string }) => Promise<Blob | Blob[]>)
    | "unavailable"
    | null;
};

function makeIsoBmffFtypHeader(majorBrand: string): Uint8Array<ArrayBuffer> {
  const brand = majorBrand.slice(0, 4);
  const buffer = new ArrayBuffer(16);
  const bytes = new Uint8Array(buffer);
  // Box size (16 bytes) + type ("ftyp") + major brand + minor version.
  bytes.set([0x00, 0x00, 0x00, 0x10], 0);
  bytes.set([0x66, 0x74, 0x79, 0x70], 4);
  for (let i = 0; i < 4; i += 1) {
    bytes[8 + i] = brand.charCodeAt(i) || 0x00;
  }
  bytes.set([0x00, 0x00, 0x00, 0x00], 12);
  return bytes;
}

afterEach(() => {
  const globalWithOverride = globalThis as GlobalWithHeicOverride;
  delete globalWithOverride.__heic2anyOverride;
  // Restore any native decode stubs installed by tests.
  const globalWithDecode = globalThis as unknown as {
    createImageBitmap?: typeof createImageBitmap;
  };
  delete globalWithDecode.createImageBitmap;
});

describe("getEffectiveMimeType", () => {
  it("detects HEIC via ISO-BMFF ftyp signature when Blob.type is empty", async () => {
    const blob = new Blob([makeIsoBmffFtypHeader("heic")], { type: "" });
    await expect(getEffectiveMimeType(blob)).resolves.toBe("image/heic");
  });

  it("detects HEIC/HEIF via file extension when Blob.type is empty", async () => {
    const heicFile = new File([new Uint8Array([1, 2, 3])], "photo.HEIC", {
      type: "",
    });
    const heifFile = new File([new Uint8Array([1, 2, 3])], "photo.heif", {
      type: "",
    });

    await expect(getEffectiveMimeType(heicFile)).resolves.toBe("image/heic");
    await expect(getEffectiveMimeType(heifFile)).resolves.toBe("image/heif");
  });
});

describe("normalizeImageBlobForCanvas", () => {
  it("converts HEIC detected from signature even when Blob.type is empty", async () => {
    const globalWithOverride = globalThis as GlobalWithHeicOverride;
    globalWithOverride.__heic2anyOverride = async ({ toType }) =>
      new Blob([new Uint8Array([9, 9, 9])], { type: toType });

    const blob = new Blob([makeIsoBmffFtypHeader("heic")], { type: "" });
    const normalized = await normalizeImageBlobForCanvas(blob);

    expect(normalized.wasConverted).toBe(true);
    expect(normalized.originalMimeType).toBe("image/heic");
    expect(normalized.blob.type).toBe("image/png");
  });

  it("falls back to JPEG when PNG conversion throws", async () => {
    const globalWithOverride = globalThis as GlobalWithHeicOverride;
    const calls: string[] = [];
    globalWithOverride.__heic2anyOverride = async ({ toType }) => {
      calls.push(toType);
      if (toType === "image/png") {
        throw new Error("png fail");
      }
      return new Blob([new Uint8Array([1, 2, 3])], { type: toType });
    };

    const blob = new Blob([makeIsoBmffFtypHeader("heic")], { type: "" });
    const normalized = await normalizeImageBlobForCanvas(blob);

    expect(normalized.wasConverted).toBe(true);
    expect(normalized.blob.type).toBe("image/jpeg");
    expect(calls).toEqual(["image/png", "image/jpeg"]);
  });

  it("prefers native decode when available and skips heic2any", async () => {
    // Stub native decode to succeed so the converter is never called.
    const globalWithDecode = globalThis as unknown as {
      createImageBitmap?: typeof createImageBitmap;
    };
    globalWithDecode.createImageBitmap = vi
      .fn()
      .mockResolvedValue({ width: 8, height: 6 } as unknown as ImageBitmap);

    const globalWithOverride = globalThis as GlobalWithHeicOverride;
    const converterSpy = vi.fn(async ({ toType }) => {
      return new Blob([new Uint8Array([9, 9, 9])], { type: toType });
    });
    globalWithOverride.__heic2anyOverride = converterSpy;

    const blob = new Blob([makeIsoBmffFtypHeader("heic")], { type: "" });
    const normalized = await normalizeImageBlobForCanvas(blob);

    expect(normalized.wasConverted).toBe(false);
    expect(normalized.decoded).toBeTruthy();
    expect(converterSpy).not.toHaveBeenCalled();
  });

  it("surfaces heic.convertFailed when conversion throws for type-missing HEIC", async () => {
    const globalWithOverride = globalThis as GlobalWithHeicOverride;
    globalWithOverride.__heic2anyOverride = async () => {
      throw new Error("boom");
    };

    const blob = new Blob([makeIsoBmffFtypHeader("heic")], { type: "" });
    await expect(normalizeImageBlobForCanvas(blob)).rejects.toThrow(
      "heic.convertFailed",
    );
  });

  it("surfaces heic.unavailable when library is unavailable for type-missing HEIC", async () => {
    const globalWithOverride = globalThis as GlobalWithHeicOverride;
    globalWithOverride.__heic2anyOverride = "unavailable";

    const blob = new Blob([makeIsoBmffFtypHeader("heic")], { type: "" });
    await expect(normalizeImageBlobForCanvas(blob)).rejects.toThrow(
      "heic.unavailable",
    );
  });
});
