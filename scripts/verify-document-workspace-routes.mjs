import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3000";

async function firstRecordHref(page, collection, detailPattern) {
  await page.goto(`${baseUrl}${collection}`, { waitUntil: "networkidle" });
  return page.locator(`a[href^="${collection}/"]`).evaluateAll((links, patternSource) => {
    const pattern = new RegExp(patternSource);
    const reserved = new Set(["new", "import", "export"]);
    return links.map((link) => link.getAttribute("href")).find((href) => {
      const tail = href?.split("/").filter(Boolean).at(-1);
      return href && tail && !reserved.has(tail) && pattern.test(href);
    }) ?? null;
  }, detailPattern.source);
}

async function assertSingleMetadataPath(page, route, titleName) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  const shell = page.locator(".document-editor-layout").first();
  await shell.getByRole("tab", { name: "Document", exact: true }).waitFor();
  assert.equal(await shell.getByRole("tab", { name: "Metadata", exact: true }).count(), 1, `${route}: Metadata tab missing.`);
  assert.equal(await shell.getByRole("textbox", { name: titleName, exact: true }).count(), 1, `${route}: title is not directly editable.`);
  assert.equal(await shell.getByRole("button", { name: /information/i }).count(), 0, `${route}: duplicate record-information drawer remains.`);
  await shell.getByRole("tab", { name: "Metadata", exact: true }).click();
  assert.equal(await shell.getAttribute("data-active-view"), "metadata", `${route}: Metadata view did not activate.`);
  const metadataRegion = shell.locator('[data-document-metadata="true"]');
  assert.equal(await metadataRegion.count(), 1, `${route}: Metadata does not have one explicit region.`);
}

async function assertManualResultDocument(page) {
  await page.goto(`${baseUrl}/results/new?manual=1`, { waitUntil: "networkidle" });
  assert.equal(await page.getByText("直接结果", { exact: true }).count(), 0, "Manual Result still renders the legacy direct-result textarea.");
  assert.equal(await page.getByText("主要数值 · 可选", { exact: true }).count(), 0, "Manual Result still renders the legacy primary-number field.");
  const toolbar = page.getByRole("toolbar", { name: "Scientific document formatting" }).first();
  await toolbar.getByRole("button", { name: "Insert", exact: true }).click();
  const menu = page.locator('[data-toolbar-menu="insert"]');
  for (const label of ["Table", "Metric", "Callout", "Media", "Dataset"]) {
    assert.equal(await menu.getByText(label, { exact: true }).count(), 1, `Manual Result insert menu is missing ${label}.`);
  }
}

async function assertFitInsideToolbar(page) {
  await page.goto(`${baseUrl}/results/new?manual=1`, { waitUntil: "networkidle" });
  await page.getByRole("group", { name: "Document view zoom" }).getByRole("button", { name: "Fit" }).click();
  await page.waitForTimeout(250);
  const toolbarBox = await page.locator(".standalone-document-editor-toolbar").first().boundingBox();
  const paperBox = await page.locator(".document-a4-paper").first().boundingBox();
  assert(toolbarBox && paperBox, "Fit geometry is not measurable.");
  assert(paperBox.x >= toolbarBox.x - 1 && paperBox.x + paperBox.width <= toolbarBox.x + toolbarBox.width + 1,
    `Fit paper exceeds toolbar bounds: ${JSON.stringify({ toolbarBox, paperBox })}`);
}

async function assertOutlineAlignment(page) {
  await page.goto(`${baseUrl}/results/new?manual=1`, { waitUntil: "networkidle" });
  const buttons = page.locator(".document-editor-outline nav button");
  assert(await buttons.count() >= 2, "Result outline needs multiple navigation targets.");
  const target = buttons.nth(1);
  const targetId = await target.getAttribute("aria-controls");
  await target.click();
  await page.waitForTimeout(700);
  const geometry = await page.locator(`#${targetId}`).evaluate((element) => {
    const toolbar = document.querySelector(".standalone-document-editor-toolbar");
    return { targetTop: element.getBoundingClientRect().top, toolbarBottom: toolbar?.getBoundingClientRect().bottom ?? 0 };
  });
  assert(geometry.targetTop >= geometry.toolbarBottom - 2 && geometry.targetTop <= geometry.toolbarBottom + 28,
    `Outline target is misaligned below sticky chrome: ${JSON.stringify(geometry)}`);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  await assertSingleMetadataPath(page, "/research-plans/new", "Research Plan title");
  await assertSingleMetadataPath(page, "/experiments/new", "Experiment title");
  await assertSingleMetadataPath(page, "/results/new?manual=1", "Result title");
  await assertSingleMetadataPath(page, "/entries/new", "Entry title");
  await assertManualResultDocument(page);
  await assertFitInsideToolbar(page);
  await assertOutlineAlignment(page);

  const resultHref = await firstRecordHref(page, "/results", /^\/results\/[^/]+$/);
  let savedResultChecked = false;
  if (resultHref) {
    await page.goto(`${baseUrl}${resultHref}`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".result-record-document .document-canvas-toolbar").count(), 0, "Saved Result preview still has the full-width banner toolbar.");
    assert.equal(await page.getByRole("button", { name: /Print \/ PDF|打印 \/ PDF/ }).count(), 1, "Saved Result lacks one compact print action.");
    await assertSingleMetadataPath(page, `${resultHref}/edit`, "Result title");
    savedResultChecked = true;
  }

  const entryHref = await firstRecordHref(page, "/entries", /^\/entries\/[^/]+$/);
  let savedEntryChecked = false;
  if (entryHref) {
    await assertSingleMetadataPath(page, `${entryHref}/edit`, "Entry title");
    savedEntryChecked = true;
  }

  console.log(`Real document workspace routes passed: new Research Plan, Experiment, Result, and Entry; Fit and Outline; saved Result=${savedResultChecked}; saved Entry=${savedEntryChecked}.`);
} finally {
  await browser.close();
}
