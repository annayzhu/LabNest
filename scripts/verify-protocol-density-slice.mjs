import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3000";
const screenshotDir = process.env.LABNEST_DENSITY_SCREENSHOT_DIR;
const browser = await chromium.launch({ headless: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function discoverProtocolRoutes(page) {
  await page.goto(`${baseUrl}/protocols`, { waitUntil: "domcontentloaded" });
  const detailHref = await page.locator('main a[href^="/protocols/"]')
    .evaluateAll((links) => links
      .map((link) => link.getAttribute("href"))
      .find((href) => /^\/protocols\/(?!new(?:[/?#]|$)|import(?:[/?#]|$)|export(?:[/?#]|$))[^/?#]+(?:\?.*)?$/.test(href ?? "")) ?? null);
  assert(detailHref, "No seeded Protocol detail route was found from /protocols.");

  await page.goto(`${baseUrl}${detailHref}`, { waitUntil: "domcontentloaded" });
  const editHref = await page.locator('main a[href*="/versions/"][href$="/edit"]')
    .first()
    .getAttribute("href");
  assert(editHref, `No edit route was found from ${detailHref}.`);
  return { detailHref, editHref };
}

async function assertNoPageOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${label} overflows horizontally: ${JSON.stringify(dimensions)}`);
}

async function assertDesktopSlice(page, routes) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}${routes.detailHref}`, { waitUntil: "domcontentloaded" });

  const detailRoot = page.locator('[data-density-slice="protocol"]');
  await detailRoot.waitFor();
  const detailMetrics = await detailRoot.evaluate((root) => {
    const header = root.querySelector(":scope > header");
    const actions = header?.querySelector(".page-actions");
    const paper = root.querySelector(".document-a4-paper");
    const title = header?.querySelector("h1");
    const primaryAction = header?.querySelector(".protocol-density-primary-action");
    const documentCopy = root.querySelector(".document-copy");
    const headerRect = header?.getBoundingClientRect();
    const actionsRect = actions?.getBoundingClientRect();
    const paperRect = paper?.getBoundingClientRect();
    return {
      titleSize: title ? Number.parseFloat(getComputedStyle(title).fontSize) : 0,
      headerHeight: headerRect?.height ?? 0,
      actionsHeight: actionsRect?.height ?? 0,
      documentGap: headerRect && paperRect ? paperRect.top - headerRect.bottom : Infinity,
      paperWidth: paperRect?.width ?? 0,
      primaryActionHeight: primaryAction?.getBoundingClientRect().height ?? 0,
      copyLineHeightRatio: documentCopy ? Number.parseFloat(getComputedStyle(documentCopy).lineHeight) / Number.parseFloat(getComputedStyle(documentCopy).fontSize) : 0,
    };
  });
  assert(detailMetrics.titleSize >= 17 && detailMetrics.titleSize <= 20, `Protocol title is outside the 17–20px slice target: ${detailMetrics.titleSize}px.`);
  assert(detailMetrics.actionsHeight <= 40, `Protocol actions wrapped or became too tall: ${detailMetrics.actionsHeight}px.`);
  assert(detailMetrics.primaryActionHeight >= 36 && detailMetrics.primaryActionHeight <= 40, `Primary Protocol action must remain 36–40px: ${detailMetrics.primaryActionHeight}px.`);
  assert(detailMetrics.documentGap <= 48, `Protocol shell leaves too much space before the A4 page: ${detailMetrics.documentGap}px.`);
  assert(detailMetrics.paperWidth >= 790 && detailMetrics.paperWidth <= 798, `The 100% A4 width changed: ${detailMetrics.paperWidth}px.`);
  assert(detailMetrics.copyLineHeightRatio >= 1.58 && detailMetrics.copyLineHeightRatio <= 1.62, `Protocol detail copy should use the requested 1.6 line-height ratio: ${detailMetrics.copyLineHeightRatio}.`);
  const sectionHeaders = page.locator(".document-section > header");
  assert(await sectionHeaders.count() > 0, "The Protocol document needs at least one visible section heading for the heading seam.");
  assert(await sectionHeaders.locator("svg").count() === 0, "Protocol section headings should not include decorative icons.");
  await page.locator(".protocol-export-menu > summary").click();
  assert(await page.locator(".protocol-export-menu-popover a").count() === 2, "The compact Export menu must expose both DOCX and JSON.");
  await assertNoPageOverflow(page, "Protocol detail desktop");

  if (screenshotDir) {
    await mkdir(screenshotDir, { recursive: true });
    await page.locator(".protocol-export-menu > summary").click();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(screenshotDir, "protocol-density-slice-detail-desktop.png"), fullPage: true });
  }

  await page.goto(`${baseUrl}${routes.editHref}`, { waitUntil: "domcontentloaded" });
  const editRoot = page.locator('[data-density-slice="protocol"]');
  await editRoot.waitFor();
  await page.locator(".ln-wysiwyg-toolbar select").first().waitFor();
  const editMetrics = await editRoot.evaluate((root) => {
    const header = root.querySelector(":scope > header");
    const viewbar = root.querySelector(".document-editor-viewbar");
    const toolbar = root.querySelector(".document-canvas-toolbar");
    const paper = root.querySelector(".document-a4-paper");
    const saveBar = root.querySelector(".protocol-density-actionbar");
    const toolbarControl = root.querySelector(".ln-wysiwyg-toolbar select");
    const contextRail = root.querySelector(".document-editor-context-rail");
    const editableBody = root.querySelector('.document-a4-paper [contenteditable="true"]');
    return {
      headerHeight: header?.getBoundingClientRect().height ?? 0,
      viewbarHeight: viewbar?.getBoundingClientRect().height ?? 0,
      toolbarHeight: toolbar?.getBoundingClientRect().height ?? 0,
      paperWidth: paper?.getBoundingClientRect().width ?? 0,
      saveBarHeight: saveBar?.getBoundingClientRect().height ?? 0,
      saveActionHeight: saveBar?.querySelector("button")?.getBoundingClientRect().height ?? 0,
      toolbarFontSize: toolbarControl ? Number.parseFloat(getComputedStyle(toolbarControl).fontSize) : 0,
      outlineVisible: Boolean(root.querySelector(".document-editor-outline")) && getComputedStyle(root.querySelector(".document-editor-outline")).display !== "none",
      contextHidden: Boolean(contextRail) && getComputedStyle(contextRail).display === "none",
      copyLineHeightRatio: editableBody ? Number.parseFloat(getComputedStyle(editableBody).lineHeight) / Number.parseFloat(getComputedStyle(editableBody).fontSize) : 0,
    };
  });
  assert(editMetrics.headerHeight <= 34, `Editor page header is too tall: ${editMetrics.headerHeight}px.`);
  assert(editMetrics.viewbarHeight <= 34, `Editor view tabs are too tall: ${editMetrics.viewbarHeight}px.`);
  assert(editMetrics.toolbarHeight <= 42, `Editor toolbar is too tall: ${editMetrics.toolbarHeight}px.`);
  assert(editMetrics.paperWidth >= 790 && editMetrics.paperWidth <= 798, `Editor A4 width changed: ${editMetrics.paperWidth}px.`);
  assert(editMetrics.saveBarHeight > 0 && editMetrics.saveBarHeight <= 48, `Editor save action bar is missing or too tall: ${editMetrics.saveBarHeight}px.`);
  assert(editMetrics.saveActionHeight >= 36 && editMetrics.saveActionHeight <= 40, `Primary save action must remain 36–40px: ${editMetrics.saveActionHeight}px.`);
  assert(editMetrics.toolbarFontSize >= 12 && editMetrics.toolbarFontSize <= 14, `Editor toolbar text is outside the readable 12–14px range: ${editMetrics.toolbarFontSize}px.`);
  assert(editMetrics.outlineVisible, "The desktop document outline is not visible.");
  assert(editMetrics.contextHidden, "The desktop contextual inspector must stay hidden before a supported block is selected.");
  assert(editMetrics.copyLineHeightRatio >= 1.58 && editMetrics.copyLineHeightRatio <= 1.62, `Protocol editor copy should use the requested 1.6 line-height ratio: ${editMetrics.copyLineHeightRatio}.`);
  const documentTab = page.getByRole("tab", { name: "Document" });
  await documentTab.focus();
  await documentTab.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.includes("Metadata"));
  await documentTab.click();
  const editableTableCell = page.locator(".ProseMirror table :is(th, td)").first();
  await editableTableCell.click();
  await page.locator('.document-editor-context-card[aria-label="Table settings"]').waitFor();
  assert(await page.locator(".document-editor-context-rail").evaluate((rail) => getComputedStyle(rail).display === "block"), "Selecting an editable table did not reveal the desktop contextual inspector.");
  await page.getByRole("button", { name: "Close selected block settings" }).click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".document-editor-context-rail")).display === "none");
  await assertNoPageOverflow(page, "Protocol editor desktop");

  if (screenshotDir) {
    await mkdir(screenshotDir, { recursive: true });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(screenshotDir, "protocol-density-slice-desktop.png"), fullPage: true });
  }

  await page.emulateMedia({ media: "print" });
  const printContract = await editRoot.evaluate((root) => ({
    hiddenChrome: [...root.querySelectorAll("[data-print-hidden]")].every((element) => {
      const style = getComputedStyle(element);
      return style.display === "none" || style.visibility === "hidden" || element.getClientRects().length === 0;
    }),
    viewScale: getComputedStyle(root.querySelector(".document-editor-document-stage")).zoom,
  }));
  assert(printContract.hiddenChrome, "Editor chrome marked data-print-hidden is still visible in print media.");
  assert(["1", "normal"].includes(printContract.viewScale), `Print media did not reset the editor scale: ${printContract.viewScale}.`);
  const pdfBuffer = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const mediaBox = pdfBuffer.toString("latin1").match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
  assert(mediaBox, "The printed Protocol PDF did not expose a page MediaBox.");
  const [, pdfWidth, pdfHeight] = mediaBox.map(Number);
  assert(Math.abs(pdfWidth - 595.28) < 2 && Math.abs(pdfHeight - 841.89) < 2, `Printed page is not A4: ${pdfWidth} × ${pdfHeight} pt.`);
  await page.emulateMedia({ media: "screen" });
}

async function assertMobileSlice(page, routes) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${routes.detailHref}`, { waitUntil: "domcontentloaded" });
  const detailRoot = page.locator('[data-density-slice="protocol"]');
  await detailRoot.waitFor();
  const mobileDetailState = await detailRoot.evaluate((slice) => {
    const title = slice.querySelector(":scope > header .page-header-title");
    const identifier = slice.querySelector(":scope > header .page-header-identifier");
    const copy = slice.querySelector(".document-copy");
    const header = slice.querySelector(":scope > header");
    const titleRect = title.getBoundingClientRect();
    const identifierRect = identifier.getBoundingClientRect();
    return {
      actionOverflow: getComputedStyle(slice.querySelector(".page-actions")).overflowX,
      primaryActionHeight: slice.querySelector(".protocol-density-primary-action")?.getBoundingClientRect().height ?? 0,
      titleFontSize: Number.parseFloat(getComputedStyle(title).fontSize),
      actionFontSize: Number.parseFloat(getComputedStyle(slice.querySelector(".page-actions a, .page-actions button")).fontSize),
      titleBeforeIdentifier: titleRect.top < identifierRect.top,
      titleIdentifierGap: identifierRect.top - titleRect.bottom,
      headerHeight: header.getBoundingClientRect().height,
      identifierFontSize: Number.parseFloat(getComputedStyle(identifier).fontSize),
      copyFontSize: Number.parseFloat(getComputedStyle(copy).fontSize),
      copyLineHeightRatio: Number.parseFloat(getComputedStyle(copy).lineHeight) / Number.parseFloat(getComputedStyle(copy).fontSize),
    };
  });
  assert(["auto", "scroll"].includes(mobileDetailState.actionOverflow), `Mobile detail actions must scroll safely, got ${mobileDetailState.actionOverflow}.`);
  assert(mobileDetailState.primaryActionHeight >= 36 && mobileDetailState.primaryActionHeight <= 40, `Mobile primary Protocol action must remain touch-friendly: ${mobileDetailState.primaryActionHeight}px.`);
  assert(mobileDetailState.titleFontSize >= 14 && mobileDetailState.titleFontSize <= 16, `Mobile Protocol title should stay within the compact 14–16px range: ${mobileDetailState.titleFontSize}px.`);
  assert(mobileDetailState.actionFontSize >= 10.5 && mobileDetailState.actionFontSize <= 11.5, `Mobile Protocol action labels should stay within the compact 10.5–11.5px range: ${mobileDetailState.actionFontSize}px.`);
  assert(mobileDetailState.titleBeforeIdentifier, "Mobile Protocol header should place the title above the identifier and version.");
  assert(mobileDetailState.titleIdentifierGap >= 0 && mobileDetailState.titleIdentifierGap <= 8, `Mobile title and identifier should stay visually grouped: ${mobileDetailState.titleIdentifierGap}px.`);
  assert(mobileDetailState.headerHeight <= 96, `Mobile Protocol header should not contain a large empty height: ${mobileDetailState.headerHeight}px.`);
  assert(mobileDetailState.identifierFontSize >= 8.5 && mobileDetailState.identifierFontSize <= 9.5, `Mobile Protocol identifier should be small supporting text: ${mobileDetailState.identifierFontSize}px.`);
  assert(mobileDetailState.copyFontSize >= 11.5 && mobileDetailState.copyFontSize <= 12.5, `Mobile Protocol body should use the compact 12px reading size: ${mobileDetailState.copyFontSize}px.`);
  assert(mobileDetailState.copyLineHeightRatio >= 1.58 && mobileDetailState.copyLineHeightRatio <= 1.62, `Mobile Protocol body should preserve the requested 1.6 line-height ratio: ${mobileDetailState.copyLineHeightRatio}.`);
  await assertNoPageOverflow(page, "Protocol detail mobile");

  if (screenshotDir) {
    await mkdir(screenshotDir, { recursive: true });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(screenshotDir, "protocol-density-slice-detail-mobile.png"), fullPage: true });
  }

  await page.goto(`${baseUrl}${routes.editHref}`, { waitUntil: "domcontentloaded" });
  const root = page.locator('[data-density-slice="protocol"]');
  await root.waitFor();
  await page.locator(".ln-wysiwyg-toolbar select").first().waitFor();
  const mobileState = await root.evaluate((slice) => ({
    outlineDisplay: getComputedStyle(slice.querySelector(".document-editor-outline")).display,
    contextDisplay: getComputedStyle(slice.querySelector(".document-editor-context-rail")).display,
    toolbarOverflow: getComputedStyle(slice.querySelector(".document-canvas-toolbar")).overflowX,
    toolbarFontSize: Number.parseFloat(getComputedStyle(slice.querySelector(".ln-wysiwyg-toolbar select")).fontSize),
    tabCount: slice.querySelectorAll('[role="tab"]').length,
  }));
  assert(mobileState.outlineDisplay === "none", `Mobile outline should be hidden, got ${mobileState.outlineDisplay}.`);
  assert(mobileState.contextDisplay === "none", `Mobile inspector should be hidden, got ${mobileState.contextDisplay}.`);
  assert(["auto", "scroll"].includes(mobileState.toolbarOverflow), `Mobile toolbar must scroll instead of clipping, got ${mobileState.toolbarOverflow}.`);
  assert(mobileState.toolbarFontSize >= 11 && mobileState.toolbarFontSize <= 12, `Mobile editor toolbar labels should stay within the compact 11–12px range: ${mobileState.toolbarFontSize}px.`);
  assert(mobileState.tabCount === 3, `Expected three accessible editor tabs, found ${mobileState.tabCount}.`);
  await assertNoPageOverflow(page, "Protocol editor mobile");

  if (screenshotDir) {
    await mkdir(screenshotDir, { recursive: true });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(screenshotDir, "protocol-density-slice-mobile.png"), fullPage: true });
  }
}

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const routes = await discoverProtocolRoutes(page);
  await assertDesktopSlice(page, routes);
  await assertMobileSlice(page, routes);
  console.log(`Protocol density slice browser seam passed for ${routes.detailHref} and ${routes.editHref}.`);
} finally {
  await browser.close();
}
