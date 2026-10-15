import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3100";

async function findReportEditor(page) {
  await page.goto(`${baseUrl}/reports`, { waitUntil: "networkidle" });
  const href = await page.locator('a[href^="/reports/"]').evaluateAll((links) => links
    .map((link) => link.getAttribute("href"))
    .find((value) => value && /^\/reports\/[^/]+$/.test(value) && !["/reports/new", "/reports/import"].includes(value)));
  if (!href) return null;
  await page.goto(`${baseUrl}${href}`, { waitUntil: "networkidle" });
  const editLink = page.locator('a[href^="/reports/"][href$="/edit"]').first();
  return await editLink.count() ? editLink.getAttribute("href") : null;
}

/** Notion-style writing in every editor: no formatting toolbar; a bubble over selected text; ⋮⋮ beside the block; "/" to insert. */
async function assertWritingSurface(page, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  const surface = page.locator(".ln-editor-surface").first();
  await surface.waitFor();
  // SSR shows the page before React attaches the editor's handlers.
  await page.waitForLoadState("networkidle");
  assert.equal(await page.getByRole("toolbar", { name: /formatting/i }).count(), 0, `${route}: a formatting toolbar is still shown.`);

  const editorParagraph = surface.locator(".ProseMirror p").first();
  if (!(await editorParagraph.textContent())?.trim()) {
    await editorParagraph.click();
    await page.keyboard.type("Regression check");
  }
  await editorParagraph.selectText();
  const bubble = page.locator(".ln-selection-bubble");
  await bubble.waitFor({ state: "visible" });
  await bubble.getByRole("button", { name: /^加粗/ }).click();
  await page.waitForFunction((element) => Boolean(element?.querySelector("strong")), await editorParagraph.elementHandle(), { timeout: 2_000 }).catch(() => undefined);
  assert(await editorParagraph.locator("strong").count(), `${route}: Bold from the selection bubble did not apply.`);
  const boldWeight = Number.parseInt(await editorParagraph.locator("strong").first().evaluate((element) => getComputedStyle(element).fontWeight), 10);
  assert(boldWeight >= 700, `${route}: Bold markup exists but is not visibly rendered: ${boldWeight}.`);

  // ⋮⋮ beside the block: 格式 → 行距.
  await editorParagraph.hover();
  const grip = page.locator(".ln-block-handle button[aria-haspopup='menu']");
  await grip.waitFor({ state: "visible" });
  await grip.click();
  const blockMenu = page.getByRole("menu", { name: "块操作" });
  await blockMenu.waitFor();
  await blockMenu.locator("label", { hasText: "行距" }).locator("select").selectOption("1.3");
  const paragraphLineHeight = await editorParagraph.evaluate((element) => {
    const style = getComputedStyle(element);
    return Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize);
  });
  assert(paragraphLineHeight > 1.25 && paragraphLineHeight < 1.36, `${route}: 1.3× line spacing did not change the paragraph box: ${paragraphLineHeight}.`);

  // "/" on a new line offers the editor's inserts, a table among them.
  await editorParagraph.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");
  const insert = page.locator(".ln-insert-menu");
  await insert.waitFor({ state: "visible" });
  assert(await insert.getByRole("option", { name: /表格/ }).count(), `${route}: "/" does not offer a table.`);
  await page.keyboard.press("Escape");
}

async function assertZoom(page, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  // A new record opens with its metadata drawer; close it to reach the page's zoom.
  const backToDocument = page.getByRole("button", { name: "返回主界面继续填写或保存" });
  if (await backToDocument.isVisible().catch(() => false)) await backToDocument.click();
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
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  await page.waitForLoadState("networkidle");
  const shell = page.locator(".document-editor-layout").first();
  await shell.getByRole("tab", { name: "Document", exact: true }).waitFor();
  assert.equal(await shell.getByRole("tab", { name: "Metadata", exact: true }).count(), 1, `${route}: Metadata tab is missing.`);
  assert.equal(await shell.getByRole("textbox", { name: titleName, exact: true }).count(), 1, `${route}: title is not directly editable in the document.`);
  await shell.getByRole("tab", { name: "Metadata", exact: true }).click();
  await page.getByRole("complementary", {name:"Metadata",exact:true}).waitFor({state:"visible"});
  assert.equal(await shell.getByRole("tab", {name:"Metadata",exact:true}).getAttribute("aria-selected"), "true", `${route}: Metadata tab did not activate.`);
  await shell.getByRole("tab", { name: "Document", exact: true }).click();
}

async function assertMetadataIsTheOnlyRecordPropertiesPath(page) {
  await page.goto(`${baseUrl}/experiments/new`, { waitUntil: "networkidle" });
  await page.waitForLoadState("networkidle");
  const shell = page.locator(".document-editor-layout").first();
  assert.equal(await shell.getByRole("button", { name: /information/i }).count(), 0, "The duplicate record-information drawer toggle remains.");
  assert.equal(await shell.getByRole("complementary", { name: /information/i }).count(), 0, "The duplicate record-information drawer remains.");
  await shell.getByRole("tab", { name: "Metadata", exact: true }).click();
  await page.getByRole("complementary", {name:"Metadata",exact:true}).waitFor({state:"visible"});
  assert.equal(await page.getByRole("complementary", {name:"Metadata",exact:true}).locator('[data-document-metadata="true"]').count(), 1, "Experiment properties do not have exactly one Metadata region.");
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  const protocolEditor = "/protocols/new";
  await assertWritingSurface(page, protocolEditor);

  await page.goto(`${baseUrl}${protocolEditor}`, { waitUntil: "networkidle" });

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
    await assertWritingSurface(page, route);
  }
  await assertWritingSurface(page, "/entries/new");
  const reportEditor = await findReportEditor(page);
  if (reportEditor) await assertWritingSurface(page, reportEditor);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/results/new`, { waitUntil: "networkidle" });
  await page.locator(".ln-editor-surface").first().waitFor();
  const widths = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert(widths.scroll <= widths.client + 1, `Document editor overflows on mobile: ${JSON.stringify(widths)}`);

  await page.goto(`${baseUrl}/results/new`, { waitUntil: "networkidle" });
  await page.locator(".ln-editor-surface .ProseMirror p").first().click();
  await page.keyboard.type("/");
  const resultInsertMenu = page.locator(".ln-insert-menu");
  await resultInsertMenu.waitFor({ state: "visible" });
  for (const label of ["表格", "指标", "提示", "图片", "数据集"]) {
    assert.equal(await resultInsertMenu.getByRole("option").filter({ has: page.getByText(label, { exact: true }) }).count(), 1, `Result "/" is missing ${label}.`);
  }
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 1440, height: 980 });
  for (const route of [protocolEditor, "/research-plans/new", "/experiments/new", "/results/new", "/entries/new", ...(reportEditor ? [reportEditor] : [])]) await assertZoom(page, route);
  await assertSharedDocumentShell(page, "/research-plans/new", "Research Plan title");
  await assertSharedDocumentShell(page, "/experiments/new", "Experiment title");
  await assertSharedDocumentShell(page, "/results/new", "Result title");
  await assertSharedDocumentShell(page, "/entries/new", "Entry title");
  if (reportEditor) await assertSharedDocumentShell(page, reportEditor, "Report title");
  await assertMetadataIsTheOnlyRecordPropertiesPath(page);

  await page.goto(`${baseUrl}/research-plans`, { waitUntil: "networkidle" });
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
  await page.goto(`${baseUrl}/results/new`, { waitUntil: "networkidle" });
  await page.getByRole("group", { name: "Document view zoom" }).getByRole("button", { name: "Fit" }).click();
  const tabletPaper = page.locator(".document-a4-paper").first();
  const tabletFit = await page.locator(".document-editor-document-panel").first().evaluate((element) => ({ width: element.getBoundingClientRect().width, overflow: getComputedStyle(element).overflowX }));
  const tabletPaperWidth = (await tabletPaper.boundingBox())?.width ?? 0;
  assert(tabletFit.overflow === "hidden" && Math.abs(tabletPaperWidth - tabletFit.width) < 5, `Fit does not align and clip its tablet viewport: ${JSON.stringify({ ...tabletFit, paper: tabletPaperWidth })}`);
  console.log(`Document editor hardening passed across Protocol, Research Plan, Experiment, Result, and Entry${reportEditor ? ", plus Report" : " (Report shares the same scientific adapter; no saved Report fixture was available)"}; available linked-record dialogs passed.`);
} finally {
  await browser.close();
}
