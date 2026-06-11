import { describe, expect, it } from "vitest";
import {
  OPTIONAL_WARM_GLOB_IGNORES,
  splitManifestEntries,
} from "./build-sw.mjs";

describe("build-sw", () => {
  it("keeps heavy optional codec assets out of the core precache list", () => {
    const { coreEntries, optionalEntries } = splitManifestEntries([
      { url: "index.html", revision: "a" },
      { url: "assets/index-main.js", revision: "b" },
      { url: "assets/heic2any-abc123.js", revision: "c" },
      { url: "assets/webp-wasm-def456.wasm", revision: "d" },
      { url: "assets/UPNG-ghi789.js", revision: "e" },
      { url: "assets/gifenc.esm-jkl000.js", revision: "f" },
    ]);

    expect(coreEntries.map((entry) => entry.url)).toEqual([
      "index.html",
      "assets/index-main.js",
    ]);
    expect(optionalEntries.map((entry) => entry.url)).toEqual([
      "assets/heic2any-abc123.js",
      "assets/webp-wasm-def456.wasm",
      "assets/UPNG-ghi789.js",
      "assets/gifenc.esm-jkl000.js",
    ]);
  });

  it("pins the optional warmup split to explicit asset globs", () => {
    expect(OPTIONAL_WARM_GLOB_IGNORES).toEqual([
      "assets/heic2any-*.js",
      "assets/webp-wasm-*.js",
      "assets/webp-wasm-*.wasm",
      "assets/UPNG-*.js",
      "assets/gifenc*.js",
    ]);
  });
});
