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
  assert(await editorParagraph.locator("strong").count(), `${route}: Bold did not apply to the selected text.`);
  await editorParagraph.selectText();
  await toolbar.getByRole("button", { name: "Font", exact: true }).click();
  const fontMenu = page.locator('[data-toolbar-menu="font"]');
  await fontMenu.getByRole("menuitem", { name: "Arial", exact: true }).click();
  assert(await editorParagraph.locator('span[style*="font-family: arial"]').count(), `${route}: Font choice did not apply to the selected text.`);

  for (const name of ["Paragraph style", "Font", "Font size", "Line spacing", "More", "Insert"]) {
    const trigger = toolbar.getByRole("button", { name, exact: true });
    if (!await trigger.count()) continue;
    await trigger.focus();
    await page.keyboard.press("Enter");
    assert.equal(await trigger.getAttribute("aria-expanded"), "true", `${name} did not open from the keyboard.`);
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

async function assertZoom(page, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  const paper = page.locator(".document-a4-paper").first();
  const view = page.getByRole("group", { name: "Document view zoom" }).first();
  await view.waitFor();
  await page.waitForTimeout(250);
  await view.getByRole("button", { name: "100%" }).click();
  const width100 = (await paper.boundingBox())?.width ?? 0;
  await view.getByRole("button", { name: "110%" }).click();
  const width110 = (await paper.boundingBox())?.width ?? 0;
  assert(width110 > width100 * 1.07, `${route}: 110% does not enlarge the paper: ${width100} -> ${width110}`);
  await view.getByRole("button", { name: "Fit" }).click();
  const fitWidth = (await paper.boundingBox())?.width ?? 0;
  const panelWidth = (await page.locator(".document-editor-document-panel").first().boundingBox())?.width ?? 0;
  assert(Math.abs(fitWidth - panelWidth) < 5, `${route}: Fit does not align paper to its panel: paper ${fitWidth}, panel ${panelWidth}`);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  const protocolEditor = "/protocols/new";
  await assertToolbar(page, protocolEditor, "Protocol formatting");

  await page.getByRole("tab", { name: "Metadata" }).click();
  const metadata = page.getByRole("region", { name: "Protocol metadata" });
  await metadata.waitFor();
  assert.equal(await metadata.locator('h2:has-text("Identity")').count(), 0, "Metadata renders a redundant Identity heading.");
  const metadataSave = metadata.locator('button[type="submit"]');
  assert.equal(await metadataSave.count(), 1, "Metadata needs one contextual save action.");

  await page.getByRole("tab", { name: /Links|Relevant items/ }).click();
  const related = page.getByLabel("Protocol related records");
  await related.waitFor();
  assert.equal(await related.locator('button[type="submit"]').count(), 1, "Relevant items need one contextual save action.");

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
