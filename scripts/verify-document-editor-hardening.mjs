import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3100";

async function findReportEditor(page) {
  await page.goto(`${baseUrl}/reports`, { waitUntil: "domcontentloaded" });
  const href = await page.locator('a[href^="/reports/"]').evaluateAll((links) => links
    .map((link) => link.getAttribute("href"))
    .find((value) => value && /^\/reports\/[^/]+$/.test(value)));
  if (!href) return null;
  await page.goto(`${baseUrl}${href}`, { waitUntil: "domcontentloaded" });
  const editLink = page.locator('a[href^="/reports/"][href$="/edit"]').first();
  return await editLink.count() ? editLink.getAttribute("href") : null;
}

async function assertToolbar(page, route, ariaLabel) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  const toolbar = page.getByRole("toolbar", { name: ariaLabel }).first();
  await toolbar.waitFor();
  // SSR exposes the toolbar before React has attached its menu handlers. Wait
  // for route hydration so this assertion tests the interactive application.
  await page.waitForLoadState("networkidle");

  // Verify selection-preserving formatting before exercising Insert actions,
  // because inserted NodeViews can contain their own non-editable paragraphs.
  const editorParagraph = page.locator(".ProseMirror p").first();
  if (!(await editorParagraph.textContent())?.trim()) {
    await editorParagraph.click();
    await page.keyboard.type("Regression check");
  }
  await editorParagraph.selectText();
  await page.waitForTimeout(120);
  await toolbar.getByRole("button", { name: "Bold", exact: true }).click();
  await page.waitForFunction((element) => Boolean(element?.querySelector("strong")), await editorParagraph.elementHandle(), { timeout: 2_000 })
    .catch(() => undefined);
  assert(await editorParagraph.locator("strong").count(), `${route}: Bold did not apply to the selected text.`);
  const boldWeight = Number.parseInt(await editorParagraph.locator("strong").first().evaluate((element) => getComputedStyle(element).fontWeight), 10);
  assert(boldWeight >= 700, `${route}: Bold markup exists but is not visibly rendered: ${boldWeight}.`);
  await editorParagraph.selectText();
  await toolbar.getByRole("button", { name: "Font", exact: true }).click();
  const fontMenu = page.locator('[data-toolbar-menu="font"]');
  await fontMenu.getByRole("menuitem", { name: "Arial", exact: true }).click();
  assert(await editorParagraph.locator('span[style*="font-family: arial"]').count(), `${route}: Font choice did not apply to the selected text.`);
  await editorParagraph.selectText();
  await toolbar.getByRole("button", { name: "Line spacing", exact: true }).click();
  await page.locator('[data-toolbar-menu="spacing"]').getByRole("menuitem", { name: "1.3×", exact: true }).click();
  const paragraphLineHeight = await editorParagraph.evaluate((element) => {
    const style = getComputedStyle(element);
    return Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize);
  });
  assert(paragraphLineHeight > 1.25 && paragraphLineHeight < 1.36, `${route}: 1.3× line spacing did not change the paragraph box: ${paragraphLineHeight}.`);

  for (const name of ["Paragraph style", "Font", "Font size", "Line spacing", "More", "Insert"]) {
    const trigger = toolbar.getByRole("button", { name, exact: true });
    if (!await trigger.count()) continue;
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction((element) => element?.getAttribute("aria-expanded") === "true", await trigger.elementHandle(), { timeout: 2_000 })
      .catch(() => undefined);
    assert.equal(await trigger.getAttribute("aria-expanded"), "true", `${route}: ${name} did not open from the keyboard.`);
    const menuId = await trigger.getAttribute("aria-controls");
    assert(menuId, `${name} does not identify its menu.`);
    const menu = page.locator(`#${menuId}`);
    await menu.waitFor({ state: "visible" });
    const menuBox = await menu.boundingBox();
    assert(menuBox && menuBox.width > 40 && menuBox.height > 20, `${name} opened but its menu is clipped.`);
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "menuitem");
    const focusedLabel = await page.locator(":focus").textContent();
    assert.equal(await page.locator(":focus").getAttribute("role"), "menuitem", `${name} did not move keyboard focus into its menu.`);
    await page.keyboard.press("ArrowDown");
    assert.notEqual(await page.locator(":focus").textContent(), focusedLabel, `${name} does not support ArrowDown navigation.`);
    await page.keyboard.press("Escape");
    await page.waitForFunction((element) => element?.getAttribute("aria-expanded") === "false", await trigger.elementHandle(), { timeout: 2_000 })
      .catch(() => undefined);
    assert.equal(await trigger.getAttribute("aria-expanded"), "false", `${name} did not close with Escape.`);
    await trigger.click();
    await menu.waitFor({ state: "visible" });
    await menu.getByRole("menuitem").first().waitFor();
    const firstAction = menu.getByRole("menuitem").first();
    assert(await firstAction.count(), `${name} has no actionable menu item.`);
    await firstAction.click();
    assert.equal(await trigger.getAttribute("aria-expanded"), "false", `${name} action did not close the menu.`);
    await trigger.click();
    await menu.waitFor({ state: "visible" });
    await page.mouse.click(8, 8);
    assert.equal(await trigger.getAttribute("aria-expanded"), "false", `${name} did not close after an outside click.`);
  }

  for (const name of ["Paragraph style", "Font", "Font size", "Line spacing"]) {
    const control = toolbar.getByRole("button", { name, exact: true });
    const box = await control.boundingBox();
    assert(box && box.height >= 24, `${name} is clipped.`);
  }

  const toolbarHost = toolbar.locator("xpath=ancestor::*[contains(@class, 'ln-document-toolbar-host')]").first();
  if (await toolbarHost.count() && page.viewportSize()?.width >= 1024) {
    const toolbarOverflow = await toolbarHost.evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
    assert(toolbarOverflow.scroll <= toolbarOverflow.client + 2, `Toolbar scrolls horizontally at desktop width: ${JSON.stringify(toolbarOverflow)}`);
  }

}

async function assertNamedStylesAcrossEditors(page) {
  const styleName = `QC emphasis ${Date.now()}`;
  const renamedStyle = `${styleName} revised`;
  await page.goto(`${baseUrl}/protocols/new`, { waitUntil: "domcontentloaded" });
  const protocolToolbar = page.getByRole("toolbar", { name: "Protocol formatting" }).first();
  const paragraph = page.locator(".ProseMirror p").first();
  await paragraph.click();
  await page.keyboard.type("Named style cross-editor check");
  await paragraph.selectText();
  await protocolToolbar.getByRole("button", { name: "Bold", exact: true }).click();
  await protocolToolbar.getByRole("button", { name: "More", exact: true }).click();
  await page.locator('[data-toolbar-menu="more"]').getByRole("menuitem", { name: "Save selection as style" }).click();
  const saveDialog = page.getByRole("dialog");
  await saveDialog.getByLabel("Style name").fill(styleName);
  await saveDialog.getByRole("button", { name: "Save style" }).click();

  await page.goto(`${baseUrl}/results/new`, { waitUntil: "domcontentloaded" });
  const resultToolbar = page.getByRole("toolbar", { name: "Scientific document formatting" }).first();
  await resultToolbar.getByRole("button", { name: "Paragraph style", exact: true }).click();
  const styleMenu = page.locator('[data-toolbar-menu="style"]');
  assert.equal(await styleMenu.getByRole("menuitem", { name: styleName, exact: true }).count(), 1, "A named style created in Protocol is not available in Result.");
  await styleMenu.getByRole("menuitem", { name: styleName, exact: true }).click();

  await page.reload({ waitUntil: "domcontentloaded" });
  const reloadedToolbar = page.getByRole("toolbar", { name: "Scientific document formatting" }).first();
  await reloadedToolbar.getByRole("button", { name: "More", exact: true }).click();
  await page.locator('[data-toolbar-menu="more"]').getByRole("menuitem", { name: `Rename style: ${styleName}` }).click();
  const renameDialog = page.getByRole("dialog");
  await renameDialog.getByLabel("Style name").fill(renamedStyle);
  await renameDialog.getByRole("button", { name: "Rename style" }).click();
  await reloadedToolbar.getByRole("button", { name: "Paragraph style", exact: true }).click();
  assert.equal(await page.locator('[data-toolbar-menu="style"]').getByRole("menuitem", { name: renamedStyle, exact: true }).count(), 1, "Renamed style was not persisted.");
  await page.keyboard.press("Escape");
  await reloadedToolbar.getByRole("button", { name: "More", exact: true }).click();
  await page.locator('[data-toolbar-menu="more"]').getByRole("menuitem", { name: `Delete style: ${renamedStyle}` }).click();
  await reloadedToolbar.getByRole("button", { name: "Paragraph style", exact: true }).click();
  assert.equal(await page.locator('[data-toolbar-menu="style"]').getByText(renamedStyle, { exact: true }).count(), 0, "Deleted style remained in the shared style catalog.");
  await page.keyboard.press("Escape");
}

async function assertZoom(page, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  const paper = page.locator(".document-a4-paper").first();
  const view = page.getByRole("group", { name: "Document view zoom" }).first();
  await view.waitFor();
  await page.waitForTimeout(250);
  const input = view.getByRole("spinbutton", { name: "Zoom percentage" });
  await input.fill("100");
  await input.press("Enter");
  const width100 = (await paper.boundingBox())?.width ?? 0;
  await input.fill("137");
  await input.press("Enter");
  const width137 = (await paper.boundingBox())?.width ?? 0;
  assert(width137 > width100 * 1.34, `${route}: custom 137% does not enlarge the paper: ${width100} -> ${width137}`);
  assert.equal(await input.inputValue(), "137", `${route}: custom zoom value was not retained.`);
  await view.getByRole("button", { name: "Fit" }).click();
  const fitWidth = (await paper.boundingBox())?.width ?? 0;
  const panelWidth = (await page.locator(".document-editor-document-panel").first().boundingBox())?.width ?? 0;
  assert(Math.abs(fitWidth - panelWidth) < 28, `${route}: Fit does not align paper to its stable viewport: paper ${fitWidth}, panel ${panelWidth}`);
  await page.waitForTimeout(400);
  const stableWidth = (await paper.boundingBox())?.width ?? 0;
  assert(Math.abs(stableWidth - fitWidth) < 0.75, `${route}: Fit geometry is unstable: ${fitWidth} -> ${stableWidth}`);
}

async function assertSharedDocumentShell(page, route, titleName) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  const shell = page.locator(".document-editor-layout").first();
  await shell.getByRole("tab", { name: "Document", exact: true }).waitFor();
  assert.equal(await shell.getByRole("tab", { name: "Metadata", exact: true }).count(), 1, `${route}: Metadata tab is missing.`);
  assert.equal(await shell.getByRole("textbox", { name: titleName, exact: true }).count(), 1, `${route}: title is not directly editable in the document.`);
  await shell.getByRole("tab", { name: "Metadata", exact: true }).click();
  assert.equal(await shell.getAttribute("data-active-view"), "metadata", `${route}: Metadata tab did not activate.`);
  await shell.getByRole("tab", { name: "Document", exact: true }).click();
}

async function assertOverlaySettingsDrawer(page) {
  await page.goto(`${baseUrl}/experiments/new`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  const paper = page.locator(".document-a4-paper").first();
  const zoom = page.getByRole("group", { name: "Document view zoom" });
  await zoom.getByRole("button", { name: "Fit" }).click();
  const before = await paper.boundingBox();
  const toggle = page.getByRole("button", { name: "Show information" });
  await toggle.click();
  const drawer = page.getByRole("complementary", { name: "Experiment information" });
  await drawer.waitFor({ state: "visible" });
  await page.waitForTimeout(220);
  const after = await paper.boundingBox();
  assert(before && after && Math.abs(before.width - after.width) < 0.75 && Math.abs(before.x - after.x) < 0.75,
    `Opening the experiment drawer changed Fit geometry: ${JSON.stringify({ before, after })}`);
  await page.keyboard.press("Escape");
  await page.waitForFunction((element) => element?.getAttribute("aria-expanded") === "false", await toggle.elementHandle());
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  const protocolEditor = "/protocols/new";
  await assertToolbar(page, protocolEditor, "Protocol formatting");
  await assertNamedStylesAcrossEditors(page);

  await page.goto(`${baseUrl}${protocolEditor}`, { waitUntil: "domcontentloaded" });

  await page.getByRole("tab", { name: "Metadata" }).click();
  const metadata = page.getByRole("region", { name: "Protocol metadata" });
  await metadata.waitFor();
  assert.equal(await metadata.locator('h2:has-text("Identity")').count(), 0, "Metadata renders a redundant Identity heading.");
  const metadataSave = metadata.locator('button[type="submit"]');
  assert.equal(await metadataSave.count(), 1, "Metadata needs one contextual save action.");
  const [metadataBox, metadataSaveBox] = await Promise.all([metadata.boundingBox(), metadataSave.boundingBox()]);
  const metadataTopInset = metadataBox && metadataSaveBox ? metadataSaveBox.y - metadataBox.y : Number.NaN;
  const metadataRightInset = metadataBox && metadataSaveBox ? metadataBox.x + metadataBox.width - metadataSaveBox.x - metadataSaveBox.width : Number.NaN;
  assert(metadataBox && metadataSaveBox && Math.abs(metadataTopInset - metadataRightInset) < 5, `Metadata save action does not use equal top/right insets: ${metadataTopInset}/${metadataRightInset}.`);
  const metadataControls = metadata.locator('.protocol-metadata-grid input:not([type="radio"]):not([type="checkbox"]), .protocol-metadata-grid select');
  const controlHeights = await metadataControls.evaluateAll((controls) => controls.map((control) => Math.round(control.getBoundingClientRect().height)));
  assert(new Set(controlHeights).size === 1, `Metadata controls do not share one height: ${controlHeights.join(", ")}`);
  const dividerStyles = await metadata.locator(".protocol-metadata-group + .protocol-metadata-group").evaluateAll((groups) => groups.map((group) => {
    const style = getComputedStyle(group, "::before");
    return `${style.height}|${style.backgroundColor}|${style.left}|${style.right}`;
  }));
  assert(new Set(dividerStyles).size <= 1, `Metadata dividers are inconsistent: ${dividerStyles.join(", ")}`);
  const metadataHeaderBorder = await metadata.locator("header").evaluate((header) => getComputedStyle(header).borderBottomColor);

  await page.getByRole("tab", { name: /Links|Relevant items/ }).click();
  const related = page.getByLabel("Protocol related records");
  await related.waitFor();
  assert.equal(await related.locator('button[type="submit"]').count(), 1, "Relevant items need one contextual save action.");
  const relevantHeaderBorder = await related.locator("header").evaluate((header) => getComputedStyle(header).borderBottomColor);
  assert.equal(relevantHeaderBorder, metadataHeaderBorder, "Metadata and Relevant items use different divider colors.");

  for (const route of ["/research-plans/new", "/experiments/new", "/results/new"]) {
    await assertToolbar(page, route, "Scientific document formatting");
  }
  await assertToolbar(page, "/entries/new", "Rich text formatting");
  const reportEditor = await findReportEditor(page);
  if (reportEditor) await assertToolbar(page, reportEditor, "Scientific document formatting");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/results/new`, { waitUntil: "domcontentloaded" });
  await page.getByRole("toolbar", { name: "Scientific document formatting" }).waitFor();
  const widths = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert(widths.scroll <= widths.client + 1, `Document editor overflows on mobile: ${JSON.stringify(widths)}`);

  await page.goto(`${baseUrl}/results/new`, { waitUntil: "domcontentloaded" });
  const resultToolbar = page.getByRole("toolbar", { name: "Scientific document formatting" }).first();
  await resultToolbar.getByRole("button", { name: "Insert", exact: true }).click();
  const resultInsertMenu = page.locator(`[data-toolbar-menu="insert"]`);
  await resultInsertMenu.waitFor({ state: "visible" });
  for (const label of ["Table", "Metric", "Callout", "Media", "Dataset"]) {
    assert.equal(await resultInsertMenu.getByText(label, { exact: true }).count(), 1, `Result Insert is missing ${label}.`);
  }

  await page.setViewportSize({ width: 1440, height: 980 });
  for (const route of [protocolEditor, "/research-plans/new", "/experiments/new", "/results/new", "/entries/new", ...(reportEditor ? [reportEditor] : [])]) await assertZoom(page, route);
  await assertSharedDocumentShell(page, "/research-plans/new", "Research Plan title");
  await assertSharedDocumentShell(page, "/experiments/new", "Experiment title");
  await assertSharedDocumentShell(page, "/results/new", "Result title");
  await assertSharedDocumentShell(page, "/entries/new", "Entry title");
  if (reportEditor) await assertSharedDocumentShell(page, reportEditor, "Report title");
  await assertOverlaySettingsDrawer(page);

  await page.goto(`${baseUrl}/research-plans`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(350);
  for (const kind of ["protocols", "records"]) {
    const countButton = page.getByRole("button", { name: new RegExp(`View \\d+ linked ${kind}`) }).first();
    if (!await countButton.count()) continue;
    await countButton.click();
    await page.getByRole("dialog").waitFor({ state: "visible" });
    await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto(`${baseUrl}/results/new`, { waitUntil: "domcontentloaded" });
  await page.getByRole("group", { name: "Document view zoom" }).getByRole("button", { name: "Fit" }).click();
  const tabletPaper = page.locator(".document-a4-paper").first();
  const tabletFit = await page.locator(".document-editor-document-panel").first().evaluate((element) => ({ width: element.getBoundingClientRect().width, overflow: getComputedStyle(element).overflowX }));
  const tabletPaperWidth = (await tabletPaper.boundingBox())?.width ?? 0;
  assert(tabletFit.overflow === "hidden" && Math.abs(tabletPaperWidth - tabletFit.width) < 5, `Fit does not align and clip its tablet viewport: ${JSON.stringify({ ...tabletFit, paper: tabletPaperWidth })}`);
  console.log(`Document editor hardening passed across Protocol, Research Plan, Experiment, Result, and Entry${reportEditor ? ", plus Report" : " (Report shares the same scientific adapter; no saved Report fixture was available)"}; available linked-record dialogs passed.`);
} finally {
  await browser.close();
}
