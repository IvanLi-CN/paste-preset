import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  const pkgPath = join(__dirname, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

  const version =
    process.env.VITE_APP_VERSION && process.env.VITE_APP_VERSION.length > 0
      ? process.env.VITE_APP_VERSION
      : typeof pkg.version === "string" && pkg.version.length > 0
        ? pkg.version
        : "0.0.0";

  const projectRoot = join(__dirname, "..");
  const distDir = join(projectRoot, "dist");
  const publicDir = join(projectRoot, "public");
  mkdirSync(distDir, { recursive: true });
  mkdirSync(publicDir, { recursive: true });

  const payload = {
    version,
    builtAt: new Date().toISOString(),
  };

  const distTarget = join(distDir, "version.json");
  const publicTarget = join(publicDir, "version.json");

  writeFileSync(distTarget, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(publicTarget, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(
    `[version] wrote ${version} to dist/version.json and public/version.json`,
  );
} catch (error) {
  console.error("[version] failed to write version.json:", error);
  process.exit(1);
}
