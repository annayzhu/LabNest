import { chromium } from "playwright";

const baseUrl = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3100";
const fontFixture = "node_modules/next/dist/next-devtools/server/font/geist-latin.woff2";
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${baseUrl}/settings`);
  const selectors = page.locator(".typography-role-select");

  await selectors.nth(0).selectOption("preset:pingfang");
  await page.reload();
  const interfaceFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  if (!interfaceFamily.includes("PingFang SC")) throw new Error(`Preset font did not persist: ${interfaceFamily}`);
  const interfaceWeight = await page.evaluate(() => getComputedStyle(document.body).fontWeight);
  if (interfaceWeight !== "350") throw new Error(`Interface Normal weight was not applied: ${interfaceWeight}`);

  await page.locator("input[type=file][accept*=woff2]").setInputFiles(fontFixture);
  await page.getByText(/was imported|已导入/).waitFor();
  const customOption = selectors.nth(1).locator("optgroup:last-of-type option").last();
  const customValue = await customOption.getAttribute("value");
  if (!customValue?.startsWith("custom:")) throw new Error("Imported font was not added to the role selectors.");

  await selectors.nth(1).selectOption(customValue);
  await page.reload();
  const documentFamily = await page.locator(".typography-preview-body").evaluate((element) => getComputedStyle(element).fontFamily);
  if (!documentFamily.includes("LabNest Custom")) throw new Error(`Custom font did not persist: ${documentFamily}`);

  page.once("dialog", (dialog) => void dialog.accept());
  await page.locator(".typography-custom-font-list button").last().click();
  await page.getByText(/was removed|已从当前浏览器删除/).waitFor();
  if ((await selectors.nth(1).inputValue()).startsWith("custom:")) throw new Error("Deleting a selected font did not restore the default role.");

  console.log("Typography settings browser seam passed: preset, import, apply, reload, delete, and fallback.");
} finally {
  await browser.close();
}
