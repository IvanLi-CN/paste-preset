import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
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

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function encodePng({ data, width, height }) {
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    scanlines[rowStart] = 0;
    data.copy(scanlines, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function cropToAlpha({ data, width, height }) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return { data, width, height };
  const croppedWidth = maxX - minX + 1;
  const croppedHeight = maxY - minY + 1;
  const cropped = Buffer.alloc(croppedWidth * croppedHeight * 4);
  for (let y = 0; y < croppedHeight; y += 1) {
    data.copy(
      cropped,
      y * croppedWidth * 4,
      ((minY + y) * width + minX) * 4,
      ((minY + y) * width + minX + croppedWidth) * 4,
    );
  }
  return { data: cropped, width: croppedWidth, height: croppedHeight };
}

function resizeRgba(source, width, height, targetWidth, targetHeight) {
  const target = Buffer.alloc(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = ((y + 0.5) * height) / targetHeight - 0.5;
    const y0 = Math.max(0, Math.floor(sourceY));
    const y1 = Math.min(height - 1, y0 + 1);
    const yWeight = Math.max(0, Math.min(1, sourceY - y0));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = ((x + 0.5) * width) / targetWidth - 0.5;
      const x0 = Math.max(0, Math.floor(sourceX));
      const x1 = Math.min(width - 1, x0 + 1);
      const xWeight = Math.max(0, Math.min(1, sourceX - x0));
      const outputOffset = (y * targetWidth + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        const topLeft = source[(y0 * width + x0) * 4 + channel];
        const topRight = source[(y0 * width + x1) * 4 + channel];
        const bottomLeft = source[(y1 * width + x0) * 4 + channel];
        const bottomRight = source[(y1 * width + x1) * 4 + channel];
        const top = topLeft + (topRight - topLeft) * xWeight;
        const bottom = bottomLeft + (bottomRight - bottomLeft) * xWeight;
        target[outputOffset + channel] = Math.round(
          top + (bottom - top) * yWeight,
        );
      }
    }
  }
  return target;
}

async function writeRegular(size, name) {
  await sharp(canonicalSource)
    .resize(size, size, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png(png())
    .toFile(resolve(pwaDir, name));
}

async function writeMaskable(markSource, size, name) {
  const markEdge = Math.round(size * 0.6);
  const scale = Math.min(
    markEdge / markSource.width,
    markEdge / markSource.height,
  );
  const markWidth = Math.max(1, Math.round(markSource.width * scale));
  const markHeight = Math.max(1, Math.round(markSource.height * scale));
  const mark = resizeRgba(
    markSource.data,
    markSource.width,
    markSource.height,
    markWidth,
    markHeight,
  );
  const output = Buffer.alloc(size * size * 4);
  for (let index = 0; index < size * size; index += 1) {
    output[index * 4] = background.r;
    output[index * 4 + 1] = background.g;
    output[index * 4 + 2] = background.b;
    output[index * 4 + 3] = 255;
  }
  const offsetX = Math.floor((size - markWidth) / 2);
  const offsetY = Math.floor((size - markHeight) / 2);
  for (let y = 0; y < markHeight; y += 1) {
    for (let x = 0; x < markWidth; x += 1) {
      const sourceOffset = (y * markWidth + x) * 4;
      const outputOffset = ((offsetY + y) * size + offsetX + x) * 4;
      const alpha = mark[sourceOffset + 3] / 255;
      output[outputOffset] = Math.round(
        mark[sourceOffset] * alpha + background.r * (1 - alpha),
      );
      output[outputOffset + 1] = Math.round(
        mark[sourceOffset + 1] * alpha + background.g * (1 - alpha),
      );
      output[outputOffset + 2] = Math.round(
        mark[sourceOffset + 2] * alpha + background.b * (1 - alpha),
      );
      output[outputOffset + 3] = 255;
    }
  }
  await writeFile(
    resolve(pwaDir, name),
    encodePng({ data: output, width: size, height: size }),
  );
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
  const source = await sharp(canonicalSource)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const trimmedMark = cropToAlpha({
    data: source.data,
    width: source.info.width,
    height: source.info.height,
  });
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
