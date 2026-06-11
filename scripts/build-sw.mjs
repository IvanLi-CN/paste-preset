import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as workboxBuild from "workbox-build";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distDir = join(__dirname, "..", "dist");
const swSrc = join(__dirname, "sw-template.js");
export const OFFLINE_WARM_MANIFEST_FILE = "offline-warm-manifest.json";
export const SW_GLOB_PATTERNS = [
  "**/*.{css,html,ico,js,json,png,svg,txt,webmanifest,woff,woff2,ttf,eot,wasm}",
];
export const SW_GLOB_IGNORES = ["**/*.map", OFFLINE_WARM_MANIFEST_FILE];
export const OPTIONAL_WARM_GLOB_IGNORES = [
  "assets/heic2any-*.js",
  "assets/webp-wasm-*.js",
  "assets/webp-wasm-*.wasm",
  "assets/UPNG-*.js",
  "assets/gifenc*.js",
];
const OPTIONAL_WARM_REGEXES = [
  /^assets\/heic2any-.*\.js$/,
  /^assets\/webp-wasm-.*\.(?:js|wasm)$/,
  /^assets\/UPNG-.*\.js$/,
  /^assets\/gifenc.*\.js$/,
];
const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024;

export function isOptionalWarmAssetUrl(url) {
  return OPTIONAL_WARM_REGEXES.some((pattern) => pattern.test(url));
}

export function splitManifestEntries(entries) {
  const coreEntries = [];
  const optionalEntries = [];

  for (const entry of entries) {
    if (isOptionalWarmAssetUrl(entry.url)) {
      optionalEntries.push(entry);
    } else {
      coreEntries.push(entry);
    }
  }

  return {
    coreEntries,
    optionalEntries,
  };
}

export async function collectManifestEntries(globDirectory = distDir) {
  const { manifestEntries, warnings } = await workboxBuild.getManifest({
    globDirectory,
    globPatterns: SW_GLOB_PATTERNS,
    globIgnores: SW_GLOB_IGNORES,
    maximumFileSizeToCacheInBytes: MAX_CACHE_SIZE_BYTES,
  });

  return { manifestEntries, warnings };
}

export async function generateServiceWorkerAssets(params = {}) {
  const globDirectory = params.globDirectory ?? distDir;
  const serviceWorkerSource = params.swSrc ?? swSrc;
  const serviceWorkerDestination =
    params.swDest ?? join(globDirectory, "sw.js");

  if (!existsSync(globDirectory)) {
    throw new Error(`[sw] dist directory not found at ${globDirectory}`);
  }

  const { manifestEntries, warnings: manifestWarnings } =
    await collectManifestEntries(globDirectory);
  const { coreEntries, optionalEntries } =
    splitManifestEntries(manifestEntries);
  const warmManifestPath = join(globDirectory, OFFLINE_WARM_MANIFEST_FILE);

  writeFileSync(
    warmManifestPath,
    `${JSON.stringify(optionalEntries, null, 2)}\n`,
    "utf8",
  );

  const {
    count,
    size,
    warnings: injectWarnings,
  } = await workboxBuild.injectManifest({
    globDirectory,
    swSrc: serviceWorkerSource,
    swDest: serviceWorkerDestination,
    globPatterns: SW_GLOB_PATTERNS,
    globIgnores: [...SW_GLOB_IGNORES, ...OPTIONAL_WARM_GLOB_IGNORES],
    maximumFileSizeToCacheInBytes: MAX_CACHE_SIZE_BYTES,
  });

  return {
    count,
    size,
    coreEntries,
    optionalEntries,
    warnings: [...manifestWarnings, ...injectWarnings],
  };
}

async function main() {
  try {
    const { count, size, coreEntries, optionalEntries, warnings } =
      await generateServiceWorkerAssets();

    console.log(
      `[sw] generated dist/sw.js (core precache ${count} files, ${size} bytes)`,
    );
    console.log(
      `[sw] wrote dist/${OFFLINE_WARM_MANIFEST_FILE} (${optionalEntries.length} optional assets, ${coreEntries.length} core assets)`,
    );
    if (warnings.length > 0) {
      console.warn(
        `[sw] warnings:\n${warnings.map((warning) => `- ${warning}`).join("\n")}`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
