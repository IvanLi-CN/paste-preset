import { expect, test } from "./_helpers";

test("app loads and shows title", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "PastePreset", level: 1 }),
  ).toBeVisible();
});
