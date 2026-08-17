import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { installIconVersion, versionedPwaIcon } from "./pwa-icon-contract.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = resolve(projectRoot, "public");
const pwaDir = resolve(publicDir, "pwa");
const canonicalSource = resolve(
  publicDir,
  "brand",
  "paste-preset-icon-v2-master.png",
);
const background = { r: 0xee, g: 0xf4, b: 0xff, alpha: 1 };
const regularAssets = [
  [192, "icon-192.png"],
  [512, "icon-512.png"],
];
const maskableAssets = [
  [192, "icon-192-maskable.png"],
  [512, "icon-512-maskable.png"],
  [180, "apple-touch-icon.png"],
];

function png() {
  return { compressionLevel: 9, adaptiveFiltering: false, palette: false };
}

async function writeRegular(size, name) {
  await sharp(canonicalSource)
    .resize(size, size, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png(png())
    .toFile(resolve(pwaDir, name));
}

async function writeMaskable(trimmedMark, size, name) {
  const markEdge = Math.round(size * 0.6);
  const mark = await sharp(trimmedMark)
    .resize(markEdge, markEdge, {
      fit: "inside",
      kernel: sharp.kernel.lanczos3,
    })
    .png(png())
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png(png())
    .toFile(resolve(pwaDir, name));
}

async function writeManifest(version) {
  const manifestPath = resolve(publicDir, "manifest.webmanifest");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.icons = [
    {
      src: versionedPwaIcon("icon-192.png", version),
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: versionedPwaIcon("icon-512.png", version),
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: versionedPwaIcon("icon-192-maskable.png", version),
      sizes: "192x192",
      type: "image/png",
      purpose: "maskable",
    },
    {
      src: versionedPwaIcon("icon-512-maskable.png", version),
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  await mkdir(pwaDir, { recursive: true });
  const trimmedMark = await sharp(canonicalSource)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png(png())
    .toBuffer();
  await Promise.all(
    regularAssets.map(([size, name]) => writeRegular(size, name)),
  );
  await Promise.all(
    maskableAssets.map(([size, name]) =>
      writeMaskable(trimmedMark, size, name),
    ),
  );
  await writeManifest(installIconVersion(projectRoot));
}

await main();
