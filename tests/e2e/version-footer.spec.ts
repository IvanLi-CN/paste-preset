import fs from "node:fs";
import path from "node:path";
import { expect, test } from "./_helpers";

function readPackageVersion(): string {
  const pkgPath = path.resolve(process.cwd(), "package.json");
  const raw = fs.readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(raw) as { version?: unknown };
  const version = typeof pkg.version === "string" ? pkg.version.trim() : "";
  if (!version) {
    throw new Error("package.json.version is missing or invalid");
  }
  return version;
}

test("E2E-013 footer shows app version derived from package.json", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name !== "desktop") {
    test.skip();
  }

  await page.goto("/");

  const baseVersion = readPackageVersion();

  const footer = page.getByRole("contentinfo");
  const versionLabel = footer.getByText(/^v/);

  const text = (await versionLabel.textContent())?.trim() ?? "";
  expect(text).not.toBe("");

  const pattern = new RegExp(`^v${baseVersion}(?:-dev)?$`);
  expect(text).toMatch(pattern);
});
