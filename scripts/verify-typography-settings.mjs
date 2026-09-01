import { chromium } from "playwright";

const baseUrl = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3100";
const fontFixture = "node_modules/next/dist/next-devtools/server/font/geist-latin.woff2";
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${baseUrl}/settings`);
  const selector = (role) => page.locator(`[data-typography-role="${role}"]`);
  const selectors = page.locator(".typography-role-select");
  if (await selectors.count() !== 6) throw new Error(`Expected six independent Chinese/English selectors, found ${await selectors.count()}.`);

  const latinPresetValues = await selector("latinDocumentBody").locator("optgroup:first-of-type option").evaluateAll((options) => options.map((option) => option.value).sort());
  if (JSON.stringify(latinPresetValues) !== JSON.stringify(["preset:arial", "preset:times-new-roman"])) {
    throw new Error(`English presets must be limited to Arial and Times New Roman: ${latinPresetValues.join(", ")}`);
  }
  const cjkFontFaceIsolation = await page.evaluate(() => Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .filter((rule) => rule instanceof CSSFontFaceRule && rule.style.fontFamily.includes("LabNest CJK"))
    .map((rule) => ({ family: rule.style.fontFamily, unicodeRange: rule.style.unicodeRange })));
  if (cjkFontFaceIsolation.length < 6 || cjkFontFaceIsolation.some((face) => !face.unicodeRange.includes("U+4E00-9FFF") || face.unicodeRange.includes("U+0000"))) {
    throw new Error(`Built-in Chinese fonts are not isolated from Latin glyphs: ${JSON.stringify(cjkFontFaceIsolation)}`);
  }
  await page.waitForFunction(() => !document.querySelector('[data-typography-role="cjkUi"]')?.disabled);

  await selector("cjkUi").selectOption("preset:pingfang");
  await selector("cjkDocumentBody").selectOption("preset:songti");
  await selector("latinDocumentBody").selectOption("preset:arial");
  await page.waitForFunction(() => {
    const style = getComputedStyle(document.documentElement);
    return style.getPropertyValue("--font-cjk-ui").includes("LabNest CJK PingFang")
      && style.getPropertyValue("--font-cjk-document-body").includes("LabNest CJK Songti")
      && style.getPropertyValue("--font-latin-document-body").includes("Arial");
  });
  await page.reload();
  const interfaceFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  if (!interfaceFamily.includes("Arial") || !interfaceFamily.includes("LabNest CJK PingFang")) throw new Error(`Independent UI fonts did not persist: ${interfaceFamily}`);
  const interfaceWeight = await page.evaluate(() => getComputedStyle(document.body).fontWeight);
  if (interfaceWeight !== "350") throw new Error(`Interface Normal weight was not applied: ${interfaceWeight}`);
  const documentVariables = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      cjk: style.getPropertyValue("--font-cjk-document-body"),
      latin: style.getPropertyValue("--font-latin-document-body"),
    };
  });
  if (!documentVariables.cjk.includes("LabNest CJK Songti")) throw new Error(`Chinese document font did not persist: ${documentVariables.cjk}`);
  if (!documentVariables.latin.includes("Arial")) throw new Error(`English document font did not persist: ${documentVariables.latin}`);

  await page.locator("input[type=file][accept*=woff2]").setInputFiles(fontFixture);
  await page.getByText(/was imported|已导入/).waitFor();
  const customOption = selector("latinDocumentBody").locator("optgroup:last-of-type option").last();
  const customValue = await customOption.getAttribute("value");
  if (!customValue?.startsWith("custom:")) throw new Error("Imported font was not added to the role selectors.");

  await selector("latinDocumentBody").selectOption(customValue);
  await page.reload();
  const documentFamily = await page.locator('[data-typography-preview="latin"] .typography-preview-body').evaluate((element) => getComputedStyle(element).fontFamily);
  if (!documentFamily.includes("LabNest Custom") || !documentFamily.includes("Latin")) throw new Error(`Script-scoped custom font did not persist: ${documentFamily}`);

  page.once("dialog", (dialog) => void dialog.accept());
  await page.locator(".typography-custom-font-list button").last().click();
  await page.getByText(/was removed|已从当前浏览器删除/).waitFor();
  if ((await selector("latinDocumentBody").inputValue()).startsWith("custom:")) throw new Error("Deleting a selected font did not restore the default English role.");

  console.log("Typography settings browser seam passed: independent CJK/Latin presets, import, apply, reload, delete, and fallback.");
} finally {
  await browser.close();
}
