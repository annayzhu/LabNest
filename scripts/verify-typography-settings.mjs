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
  await page.addInitScript(() => {
    Object.defineProperty(window, "queryLocalFonts", {
      configurable: true,
      value: async () => [
        { family: "Device Sans", fullName: "Device Sans Regular", postscriptName: "DeviceSans-Regular", style: "Regular" },
        { family: "Device Sans", fullName: "Device Sans Bold", postscriptName: "DeviceSans-Bold", style: "Bold" },
      ],
    });
  });
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

  const presetValues = async (role) => {
    await selector(role).click();
    const values = await page.locator('.typography-font-menu [data-font-option^="preset:"]').evaluateAll((options) => options.map((option) => option.getAttribute("data-font-option")).sort());
    await page.keyboard.press("Escape");
    return values;
  };
  const latinRolePresets = [];
  for (const role of ["latinUi", "latinDocumentBody", "latinDocumentHeading"]) latinRolePresets.push(await presetValues(role));
  if (latinRolePresets.some((values) => JSON.stringify(values) !== JSON.stringify(latinRolePresets[0])) || !latinRolePresets[0].includes("preset:arial") || !latinRolePresets[0].includes("preset:times-new-roman") || latinRolePresets[0].length < 8) {
    throw new Error(`Every English role must expose the complete shared font catalog: ${JSON.stringify(latinRolePresets)}`);
  }
  const cjkRolePresets = [];
  for (const role of ["cjkUi", "cjkDocumentBody", "cjkDocumentHeading"]) cjkRolePresets.push(await presetValues(role));
  if (cjkRolePresets.some((values) => JSON.stringify(values) !== JSON.stringify(cjkRolePresets[0])) || !cjkRolePresets[0].includes("preset:pingfang") || cjkRolePresets[0].length < 8) {
    throw new Error(`Every Chinese role must expose the complete shared font catalog: ${JSON.stringify(cjkRolePresets)}`);
  }
  const cjkFontFaceIsolation = await page.evaluate(() => Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .filter((rule) => rule instanceof CSSFontFaceRule && rule.style.fontFamily.includes("LabNest CJK"))
    .map((rule) => ({ family: rule.style.fontFamily, unicodeRange: rule.style.unicodeRange })));
  if (cjkFontFaceIsolation.length < 6 || cjkFontFaceIsolation.some((face) => !face.unicodeRange.includes("U+4E00-9FFF") || face.unicodeRange.includes("U+0000"))) {
    throw new Error(`Built-in Chinese fonts are not isolated from Latin glyphs: ${JSON.stringify(cjkFontFaceIsolation)}`);
  }
  await page.waitForFunction(() => !document.querySelector('[data-typography-role="cjkUi"]')?.disabled);

  await page.getByRole("button", { name: /Find device fonts|扫描本机字体/ }).click();
  await page.getByText(/Found 1 device font famil(?:y|ies)|已发现 1 个本机字体族/).waitFor();
  for (const role of ["cjkUi", "cjkDocumentBody", "cjkDocumentHeading", "latinUi", "latinDocumentBody", "latinDocumentHeading"]) {
    await selector(role).click();
    if (await page.locator('.typography-font-menu [data-font-option^="local:"]', { hasText: "Device Sans" }).count() !== 1) throw new Error(`${role} does not expose discovered device fonts.`);
    await page.keyboard.press("Escape");
  }
  await selector("latinDocumentHeading").click();
  const deviceFontValue = await page.locator('.typography-font-menu [data-font-option^="local:"]', { hasText: "Device Sans" }).getAttribute("data-font-option");
  await page.keyboard.press("Escape");
  await selectFont("latinDocumentHeading", deviceFontValue);
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('[data-typography-role="latinDocumentHeading"]')?.disabled);
  if ((await selector("latinDocumentHeading").getAttribute("data-font-value")) !== deviceFontValue) throw new Error("A discovered device font did not persist after reload.");

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
  const submitFontFiles = async (files) => {
    await fontInput.setInputFiles(files);
    const familyDialog = page.getByRole("dialog");
    await familyDialog.getByRole("button", { name: /Continue|继续/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Import family|导入字体族/ }).click();
  };
  const transientFonts = [
    { path: woff2Fixture, name: "Geist-Latin.woff2", mimeType: "application/x-font-woff2" },
    // ponytail: keep licensed font binaries out of git; release checks supply these two paths when approved fixtures are available.
    variableTtfFixture ? { path: variableTtfFixture, name: "Variable-Font.ttf", mimeType: "application/x-font-sfnt" } : null,
    otfFixture ? { path: otfFixture, name: "OpenType-Font.otf", mimeType: "application/x-apple-font" } : null,
  ].filter(Boolean);
  for (const font of transientFonts) {
    await submitFontFiles({ name: font.name, mimeType: font.mimeType, buffer: await readFile(font.path) });
    await page.getByText(/was imported|已导入/).waitFor();
    await page.locator(".typography-custom-font-list button").last().click();
    await page.getByRole("dialog").getByRole("button", { name: /Delete font|删除字体/ }).click();
    await page.getByText(/was removed|已从当前浏览器删除/).waitFor();
  }

  const regularBuffer = await readFile(woff2Fixture);
  await submitFontFiles([
    { name: "Geist-Grouped-Regular.woff2", mimeType: "application/x-font-woff2", buffer: regularBuffer },
    { name: "Geist-Grouped-Bold.woff2", mimeType: "application/x-font-woff2", buffer: regularBuffer },
  ]);
  await page.getByText(/2 faces.*was imported|2 个字形.*已导入/).waitFor();
  if (!await page.locator(".typography-custom-font-list li", { hasText: "2 faces" }).count()) throw new Error("Regular and Bold files were not grouped into one family entry.");
  await page.locator(".typography-custom-font-list button").last().click();
  await page.getByRole("dialog").getByRole("button", { name: /Delete font|删除字体/ }).click();
  await page.getByText(/was removed|已从当前浏览器删除/).waitFor();

  await submitFontFiles({ name: "broken.otf", mimeType: "application/x-apple-font", buffer: Buffer.from("not a font") });
  await page.getByText(/could not parse the font|无法解析这个字体/).waitFor();
  if (await page.locator(".typography-custom-font-list li").count()) throw new Error("A font that failed browser parsing was persisted.");

  await submitFontFiles({ name: "Geist-Regular.ttf", mimeType: "application/x-font-sfnt", buffer: await readFile(ttfFixture) });
  await page.getByText(/was imported|已导入/).waitFor();
  await selector("latinDocumentBody").click();
  const customOption = page.locator('.typography-font-menu [data-font-option^="custom:"]').last();
  const customValue = await customOption.getAttribute("data-font-option");
  if (!customValue?.startsWith("custom:")) throw new Error("Imported font was not added to the role selectors.");
  await page.keyboard.press("Escape");

  await selectFont("latinDocumentBody", customValue);
  await page.reload();
  const documentFamily = await page.locator('[data-typography-preview="latin"] .typography-preview-body').evaluate((element) => getComputedStyle(element).fontFamily);
  if (!documentFamily.includes("labnest-custom-") || !documentFamily.includes("Times New Roman")) throw new Error(`Script-scoped custom font did not persist: ${documentFamily}`);

  await page.locator(".typography-custom-font-list button").last().click();
  await page.getByRole("dialog").getByRole("button", { name: /Delete font|删除字体/ }).click();
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
