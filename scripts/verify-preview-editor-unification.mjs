import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3000";
const output = process.env.LABNEST_E2E_OUTPUT ?? "/private/tmp/labnest-preview-editor-verification";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const records = {};
try {
  const page = await browser.newPage({ viewport: { width: 1309, height: 1000 } });
  for (const moduleName of ["research-plans", "protocols", "experiments", "results", "reports", "entries"]) {
    await page.goto(`${baseUrl}/${moduleName}`, { waitUntil: "networkidle" });
    const href = await page.locator(`a[href^="/${moduleName}/"]`).evaluateAll((links, name) => links.map((link) => link.getAttribute("href")).find((href) => new RegExp(`^/${name}/[^/?]+$`).test(href) && !/\/(new|import|export)$/.test(href)), moduleName);
    assert(href, `${moduleName}: no saved record available to verify`);
    records[moduleName] = href;
    await page.goto(`${baseUrl}${href}`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".document-canvas-toolbar").count(), 0, `${moduleName}: legacy preview strip remains`);
    assert.equal(await page.locator(".document-editor-sidebar").count(), 0, `${moduleName}: preview still uses editor drawer`);
    const paperBox = await page.locator(".document-a4-paper").first().boundingBox();
    const metadataBox = await page.locator(".document-preview-sidebar").boundingBox();
    assert(paperBox && paperBox.width > 300, `${moduleName}: paper is not visibly laid out`);
    assert(metadataBox && metadataBox.x >= paperBox.x + paperBox.width - 2, `${moduleName}: metadata is not to the right of the paper`);
    await page.screenshot({ path: `${output}/${moduleName}-preview.png`, fullPage: false });
  }
  // 1440 / 1.1 models the available CSS width at 110% desktop browser zoom.
  await page.setViewportSize({ width: 1309, height: 900 });
  for (const route of ["/protocols/new", "/research-plans/new", "/experiments/new", "/results/new?manual=1", `${records.reports}/edit`, "/entries/new"]) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    const toolbar = page.locator('[role="toolbar"]').first();
    await toolbar.waitFor();
    const insert = toolbar.getByRole("button", { name: "Insert", exact: true });
    assert.equal(await insert.count(), 1, `${route}: Insert missing`);
    await insert.click();
    assert(await page.locator('[data-toolbar-menu="insert"] button').count() >= 2, `${route}: Insert menu incomplete`);
    await page.keyboard.press("Escape");
    const font = toolbar.getByRole("button", { name: "Font", exact: true });
    assert(!((await font.textContent()) ?? "").includes(" / "), `${route}: combined font label remains`);
    const chrome = page.locator(".standalone-document-editor-toolbar, .document-editor-toolbar-row");
    const print = chrome.getByRole("button", { name: "Print", exact: true });
    assert.equal(await print.count(), 1, `${route}: Print is missing`);
    const formattingBox = await toolbar.boundingBox();
    const printBox = await print.boundingBox();
    assert(formattingBox && printBox && Math.abs(printBox.y - formattingBox.y) < 8, `${route}: Print wrapped below formatting`);
    const buttonBoxes = await toolbar.locator("button").evaluateAll((buttons) => buttons.map((button) => { const rect = button.getBoundingClientRect(); return { top: rect.top, right: rect.right }; }));
    const rowBox = await chrome.boundingBox();
    assert(rowBox && buttonBoxes.every((box) => Math.abs(box.top - formattingBox.y) < 8 && box.right <= rowBox.x + rowBox.width), `${route}: formatting controls wrap or overflow`);
    const tabs = page.locator(".document-editor-layout-tabs, .document-editor-viewbar-inner");
    assert.equal(await tabs.count(), 1, `${route}: tab strip is missing`);
    await page.evaluate(() => window.scrollTo(0, 400));
    const tabBox = await tabs.boundingBox();
    const chromeBox = await chrome.boundingBox();
    assert(tabBox && chromeBox && Math.abs(tabBox.x - chromeBox.x) < 2 && Math.abs(tabBox.y + tabBox.height - chromeBox.y) < 3, `${route}: tabs and toolbar are not aligned and sticky together`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${output}/${route.split("/")[1]}-edit.png`, fullPage: false });
  }
  await page.goto(`${baseUrl}/entries/new`, { waitUntil: "networkidle" });
  await page.locator('input[type="file"][accept="image/*"][multiple]').setInputFiles({ name: "qa-image.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=", "base64") });
  await page.getByRole("tab", { name: "Metadata", exact: true }).click();
  assert.equal(await page.locator('select').filter({ has: page.locator('option[value="photo"]') }).inputValue(), "text", "Entry image attachment changed the source category");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/entries/new`, { waitUntil: "networkidle" });
  const mobileInsert = page.getByRole("toolbar").getByRole("button", { name: "Insert", exact: true });
  const mobileInsertBox = await mobileInsert.boundingBox();
  assert(mobileInsertBox && mobileInsertBox.x + mobileInsertBox.width <= 390, "Mobile Entry Insert is clipped outside viewport");
  await page.screenshot({ path: `${output}/entry-mobile.png`, fullPage: false });
  console.log(JSON.stringify({ passed: true, records, output }));
} finally {
  await browser.close();
}
