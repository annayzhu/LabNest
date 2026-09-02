import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3100";
const ttfFixture = "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf";
const woff2Fixture = "node_modules/next/dist/next-devtools/server/font/geist-latin.woff2";
const fullMatrixRequired = process.env.LABNEST_E2E_REQUIRE_FULL_FONT_MATRIX === "1";
const variableTtfFixture = process.env.LABNEST_E2E_VARIABLE_TTF;
const otfFixture = process.env.LABNEST_E2E_OTF;
// Release checks fail closed unless approved local fixtures cover variable TTF and OTF.
if (fullMatrixRequired && (!variableTtfFixture || !otfFixture)) {
  throw new Error("Full font matrix requires LABNEST_E2E_VARIABLE_TTF and LABNEST_E2E_OTF.");
}
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${baseUrl}/settings`);
  let navigationRequests = 0;
  page.on("request", (request) => { if (request.isNavigationRequest()) navigationRequests += 1; });
  await page.getByRole("button", { name: "中文" }).click();
  await page.waitForFunction(() => document.documentElement.lang === "zh-CN" && document.documentElement.dataset.locale === "zh");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.waitForFunction(() => document.documentElement.lang === "en" && document.documentElement.dataset.locale === "en");
  if (navigationRequests !== 0) throw new Error(`Language switching should not refresh the page; observed ${navigationRequests} navigation requests.`);
  const selector = (role) => page.locator(`[data-typography-role="${role}"]`);
  const selectors = page.locator(".typography-role-select");
  if (await selectors.count() !== 6) throw new Error(`Expected six independent Chinese/English selectors, found ${await selectors.count()}.`);
  const selectFont = async (role, value) => {
    await selector(role).click();
    await page.locator(`[data-font-option="${value}"]`).click();
  };

  await selector("latinDocumentBody").click();
  const latinPresetValues = await page.locator('.typography-font-menu [data-font-option^="preset:"]').evaluateAll((options) => options.map((option) => option.getAttribute("data-font-option")).sort());
  if (JSON.stringify(latinPresetValues) !== JSON.stringify(["preset:arial", "preset:times-new-roman"])) {
    throw new Error(`English presets must be limited to Arial and Times New Roman: ${latinPresetValues.join(", ")}`);
  }
  await page.keyboard.press("Escape");
  const cjkFontFaceIsolation = await page.evaluate(() => Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .filter((rule) => rule instanceof CSSFontFaceRule && rule.style.fontFamily.includes("LabNest CJK"))
    .map((rule) => ({ family: rule.style.fontFamily, unicodeRange: rule.style.unicodeRange })));
  if (cjkFontFaceIsolation.length < 6 || cjkFontFaceIsolation.some((face) => !face.unicodeRange.includes("U+4E00-9FFF") || face.unicodeRange.includes("U+0000"))) {
    throw new Error(`Built-in Chinese fonts are not isolated from Latin glyphs: ${JSON.stringify(cjkFontFaceIsolation)}`);
  }
  await page.waitForFunction(() => !document.querySelector('[data-typography-role="cjkUi"]')?.disabled);

  await selectFont("cjkUi", "preset:pingfang");
  await selectFont("cjkDocumentBody", "preset:songti");
  await selectFont("latinDocumentBody", "preset:arial");
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

  const fontInput = page.locator("input[type=file][accept*=woff2]");
  const transientFonts = [
    { path: woff2Fixture, name: "Geist-Latin.woff2", mimeType: "application/x-font-woff2" },
    // ponytail: keep licensed font binaries out of git; release checks supply these two paths when approved fixtures are available.
    variableTtfFixture ? { path: variableTtfFixture, name: "Variable-Font.ttf", mimeType: "application/x-font-sfnt" } : null,
    otfFixture ? { path: otfFixture, name: "OpenType-Font.otf", mimeType: "application/x-apple-font" } : null,
  ].filter(Boolean);
  for (const font of transientFonts) {
    await fontInput.setInputFiles({ name: font.name, mimeType: font.mimeType, buffer: await readFile(font.path) });
    await page.getByText(/was imported|已导入/).waitFor();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.locator(".typography-custom-font-list button").last().click();
    await page.getByText(/was removed|已从当前浏览器删除/).waitFor();
  }

  await fontInput.setInputFiles({ name: "broken.otf", mimeType: "application/x-apple-font", buffer: Buffer.from("not a font") });
  await page.getByText(/could not parse the font|无法解析这个字体/).waitFor();
  if (await page.locator(".typography-custom-font-list li").count()) throw new Error("A font that failed browser parsing was persisted.");

  await fontInput.setInputFiles({ name: "Geist-Regular.ttf", mimeType: "application/x-font-sfnt", buffer: await readFile(ttfFixture) });
  await page.getByText(/was imported|已导入/).waitFor();
  await selector("latinDocumentBody").click();
  const customOption = page.locator('.typography-font-menu [data-font-option^="custom:"]').last();
  const customValue = await customOption.getAttribute("data-font-option");
  if (!customValue?.startsWith("custom:")) throw new Error("Imported font was not added to the role selectors.");
  await page.keyboard.press("Escape");

  await selectFont("latinDocumentBody", customValue);
  await page.reload();
  const documentFamily = await page.locator('[data-typography-preview="latin"] .typography-preview-body').evaluate((element) => getComputedStyle(element).fontFamily);
  if (!documentFamily.includes("LabNest Custom") || !documentFamily.includes("Latin")) throw new Error(`Script-scoped custom font did not persist: ${documentFamily}`);

  page.once("dialog", (dialog) => void dialog.accept());
  await page.locator(".typography-custom-font-list button").last().click();
  await page.getByText(/was removed|已从当前浏览器删除/).waitFor();
  if ((await selector("latinDocumentBody").getAttribute("data-font-value"))?.startsWith("custom:")) throw new Error("Deleting a selected font did not restore the default English role.");

  await selector("cjkUi").click();
  await page.locator(".typography-font-search input").fill("PingFang");
  if (await page.locator('.typography-font-menu [data-font-option="preset:pingfang"]').count() !== 1) throw new Error("Font search did not retain the matching preset.");
  await page.screenshot({ path: ".impeccable/review/typography-searchable-menu.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await selector("cjkUi").click();
  const mobileMenu = await page.locator(".typography-font-menu").evaluate((menu) => {
    const rect = menu.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: rect.width };
  });
  if (mobileMenu.left < 0 || mobileMenu.right > 390 || mobileMenu.width <= 0) throw new Error(`Font menu escaped the mobile viewport: ${JSON.stringify(mobileMenu)}`);
  await page.keyboard.press("Escape");
  if (await page.locator(".typography-font-menu").count()) throw new Error("Escape did not close the font menu.");
  const mobileWidths = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  if (mobileWidths.scroll > mobileWidths.client + 1) throw new Error(`Typography settings overflow on mobile: ${JSON.stringify(mobileWidths)}`);

  console.log(`Typography settings ${fullMatrixRequired ? "release matrix" : "browser seam"} passed: independent CJK/Latin presets, import, apply, reload, delete, and fallback.`);
} finally {
  await browser.close();
}
