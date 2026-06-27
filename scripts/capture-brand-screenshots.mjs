import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { chromium, devices } from "playwright";

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();
const appUrl = process.env.APP_URL ?? "http://127.0.0.1:25119/";
const screenshotFixtureSource = path.join(
  repoRoot,
  "public",
  "storybook",
  "sample-800x600.jpg",
);
const screenshotFixture = path.join(
  repoRoot,
  "tmp",
  "brand-screenshot-source.jpg",
);
const desktopOut = path.join(repoRoot, "docs", "assets", "app-screenshot.png");
const pwaDesktopOut = path.join(
  repoRoot,
  "public",
  "pwa",
  "screenshots",
  "desktop-wide.jpg",
);
const pwaMobileOut = path.join(
  repoRoot,
  "public",
  "pwa",
  "screenshots",
  "mobile-narrow.jpg",
);

async function waitForProcessingToFinish(page) {
  const processing = page.getByRole("status").filter({
    hasText: "Processing image…",
  });

  await processing
    .waitFor({ state: "visible", timeout: 10_000 })
    .catch(() => {});
  await processing.waitFor({ state: "hidden", timeout: 30_000 });
}

async function ensureFixture() {
  await fs.mkdir(path.dirname(screenshotFixture), { recursive: true });
  await execFileAsync("sips", [
    "-z",
    "2400",
    "3200",
    screenshotFixtureSource,
    "--out",
    screenshotFixture,
  ]);
}

async function uploadFixture(page) {
  await page.getByRole("button", { name: "Medium" }).click();
  await page.locator('input[type="file"]').setInputFiles(screenshotFixture);
  await waitForProcessingToFinish(page);
}

async function captureDesktop(browser) {
  const context = await browser.newContext({
    viewport: { width: 1536, height: 1436 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await uploadFixture(page);
  await page.screenshot({ path: desktopOut, type: "png", fullPage: true });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({
    path: pwaDesktopOut,
    type: "jpeg",
    quality: 92,
    fullPage: false,
  });
  await context.close();
}

async function captureMobile(browser) {
  const context = await browser.newContext({
    ...devices["iPhone 13"],
  });
  const page = await context.newPage();
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await uploadFixture(page);
  await page.screenshot({
    path: pwaMobileOut,
    type: "jpeg",
    quality: 92,
    fullPage: false,
  });
  await context.close();
}

async function main() {
  await ensureFixture();
  await fs.mkdir(path.dirname(desktopOut), { recursive: true });
  await fs.mkdir(path.dirname(pwaDesktopOut), { recursive: true });
  await fs.mkdir(path.dirname(pwaMobileOut), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    await captureDesktop(browser);
    await captureMobile(browser);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
