import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3100";

async function findProtocolEditor(page) {
  await page.goto(`${baseUrl}/protocols`, { waitUntil: "domcontentloaded" });
  const detailHref = await page.locator('a[href^="/protocols/"]').evaluateAll((links) => links
    .map((link) => link.getAttribute("href"))
    .find((href) => href && /^\/protocols\/[^/]+$/.test(href) && !["/protocols/import", "/protocols/new"].includes(href)));
  assert(detailHref, "No Protocol record is available for the document-editor check.");
  await page.goto(`${baseUrl}${detailHref}`, { waitUntil: "domcontentloaded" });
  const editHref = await page.locator('a[href^="/protocols/"][href$="/edit"]').first().getAttribute("href");
  assert(editHref, "No Protocol version editor is available for the document-editor check.");
  return editHref;
}

async function assertToolbar(page, route, ariaLabel) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  const toolbar = page.getByRole("toolbar", { name: ariaLabel }).first();
  await toolbar.waitFor();

  for (const name of ["More", "Insert"]) {
    const trigger = toolbar.getByRole("button", { name, exact: true });
    if (!await trigger.count()) continue;
    await trigger.focus();
    await page.keyboard.press("Enter");
    assert.equal(await trigger.getAttribute("aria-expanded"), "true", `${name} did not open from the keyboard.`);
    await page.keyboard.press("Escape");
    assert.equal(await trigger.getAttribute("aria-expanded"), "false", `${name} did not close with Escape.`);
    await trigger.click();
    await page.mouse.click(8, 8);
    assert.equal(await trigger.getAttribute("aria-expanded"), "false", `${name} did not close after an outside click.`);
  }

  for (const name of ["Font", "Font size", "Line spacing"]) {
    const control = toolbar.getByRole("combobox", { name, exact: true });
    const box = await control.boundingBox();
    assert(box && box.height >= 24, `${name} is clipped.`);
  }

  const editorParagraph = page.locator(".ProseMirror p").first();
  if (!(await editorParagraph.textContent())?.trim()) {
    await editorParagraph.click();
    await page.keyboard.type("Regression check");
  }
  await editorParagraph.selectText();
  await toolbar.getByRole("button", { name: "Bold", exact: true }).click();
  assert(await editorParagraph.locator("strong").count(), "Bold did not apply to the selected text.");
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  const protocolEditor = await findProtocolEditor(page);
  await assertToolbar(page, protocolEditor, "Protocol formatting");

  await page.getByRole("tab", { name: "Metadata" }).click();
  const metadata = page.getByRole("region", { name: "Protocol metadata" });
  await metadata.waitFor();
  assert.equal(await metadata.locator('h2:has-text("Identity")').count(), 0, "Metadata renders a redundant Identity heading.");
  const metadataSave = metadata.getByRole("button", { name: /Save metadata|保存元数据/ });
  assert.equal(await metadataSave.count(), 1, "Metadata needs one contextual save action.");

  await page.getByRole("tab", { name: /Links|Relevant items/ }).click();
  const related = page.getByLabel("Protocol related records");
  await related.waitFor();
  assert.equal(await related.getByRole("button", { name: /Save links|保存关联/ }).count(), 1, "Relevant items need one contextual save action.");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Document" }).click();
  const widths = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert(widths.scroll <= widths.client + 1, `Document editor overflows on mobile: ${JSON.stringify(widths)}`);

  await assertToolbar(page, "/results/new", "Scientific document formatting");
  console.log("Document editor hardening passed for Protocol and Result editors.");
} finally {
  await browser.close();
}
