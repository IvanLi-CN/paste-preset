import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as workboxBuild from "workbox-build";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distDir = join(__dirname, "..", "dist");
const swSrc = join(__dirname, "sw-template.js");

if (!existsSync(distDir)) {
  console.error(`[sw] dist directory not found at ${distDir}`);
  process.exit(1);
}

const { count, size, warnings } = await workboxBuild.injectManifest({
  globDirectory: distDir,
  swSrc,
  swDest: join(distDir, "sw.js"),
  globPatterns: [
    "**/*.{css,html,ico,js,json,png,svg,txt,webmanifest,woff,woff2,ttf,eot,wasm}",
  ],
  globIgnores: ["**/*.map"],

  // Ensure large WASM/worker assets can be precached (e.g. HEIC pipeline).
  maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
});

console.log(
  `[sw] generated dist/sw.js (precache ${count} files, ${size} bytes)`,
);
if (warnings.length > 0) {
  console.warn(`[sw] warnings:\\n${warnings.map((w) => `- ${w}`).join("\\n")}`);
}
