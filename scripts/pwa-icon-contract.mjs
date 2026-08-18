import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const INSTALL_ICON_FILES = [
  "pwa/apple-touch-icon.png",
  "pwa/icon-192.png",
  "pwa/icon-512.png",
  "pwa/icon-192-maskable.png",
  "pwa/icon-512-maskable.png",
];

export function installIconVersion(projectRoot) {
  const hash = createHash("sha256");
  for (const asset of INSTALL_ICON_FILES) {
    hash.update(readFileSync(resolve(projectRoot, "public", asset)));
  }
  return hash.digest("hex").slice(0, 12);
}

export function versionedPwaIcon(asset, version) {
  return `/pwa/${asset}?v=${version}`;
}
