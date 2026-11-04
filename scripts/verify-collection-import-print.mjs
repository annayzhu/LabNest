import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { unzipSync, strFromU8 } from "fflate";

const base = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3010";
assert(/:(3010|3011|3002)$/.test(base));
const output = ".local-runtime/collections-20261104";
const f = JSON.parse(await readFile(`${output}/fixtures.json`, "utf8"));
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
await context.addCookies([{ name: "labnest_locale", value: "en", url: base }]);
const page = await context.newPage();
const results = [];
try {
  for (const [module, formats] of [["projects", ["json", "csv", "tsv", "xlsx"]], ["research-plans", ["json", "md", "docx", "csv", "tsv", "xlsx"]], ["protocols", ["json", "md", "docx"]], ["experiments", ["json", "csv", "tsv", "xlsx"]], ["results", ["json", "csv", "tsv", "xlsx"]], ["reports", ["json", "md", "docx"]], ["inventory", ["csv", "tsv", "xlsx", "json"]], ["purchases", ["csv", "tsv", "xlsx", "json"]]]) {
    for (const format of formats) {
      const response = await context.request.get(`${base}/api/structured-import/${module}/template?format=${format}`);
      if (response.status() === 400) continue; // The module's UI lists the supported formats only.
      assert(response.ok(), `${module} ${format}: ${response.status()}`);
      assert((await response.body()).length > 0);
      results.push(`template ${module}/${format}: 200`);
    }
  }
  const direct = await context.request.get(`${base}/api/protocols/template/docx`);
  const shared = await context.request.get(`${base}/api/structured-import/protocols/template?format=docx`);
  assert(direct.ok() && shared.ok());
  const first = unzipSync(new Uint8Array(await direct.body()));
  const second = unzipSync(new Uint8Array(await shared.body()));
  assert.equal(strFromU8(first["word/document.xml"]), strFromU8(second["word/document.xml"]));
  results.push("Both legacy DOCX URLs produce the same Word document");
  await page.goto(`${base}/protocols/import`, { waitUntil: "networkidle" });
  assert.equal(await page.locator('a[href="/api/protocols/template/docx"]').count(), 1);
  await page.getByRole("button", { name: "Other templates", exact: true }).click();
  assert.equal(await page.locator('a[href*="template?format=docx"]').count(), 0);
  assert.equal(await page.locator('a[href*="template?format=json"]').count(), 1);
  await page.keyboard.press("Escape");
  results.push("Protocol UI exposes one Word download; other templates remain available");

  await page.goto(`${base}/projects/import`, { waitUntil: "networkidle" });
  assert.equal(await page.getByRole("link", { name: "CSV template", exact: true }).count(), 1);
  const name = `Synthetic CSV UI import ${Date.now()}`;
  await page.locator('input[type="file"]').setInputFiles({ name: "synthetic-project.csv", mimeType: "text/csv", buffer: Buffer.from(`name,description,status,tags\n${name},Synthetic import validation,active,synthetic\n`) });
  await page.getByRole("button", { name: "Preview import", exact: true }).click();
  await page.getByRole("button", { name: "Import 1 record", exact: true }).waitFor();
  await page.screenshot({ path: `${output}/csv-import-preview.png` });
  await page.getByRole("button", { name: "Import 1 record", exact: true }).click();
  await page.waitForURL(url => !url.pathname.endsWith("/import"));
  await page.getByText(name, { exact: true }).first().waitFor();
  results.push("CSV: select actual file → preview → import → saved record visible");

  await page.goto(`${base}/protocols/import`, { waitUntil: "networkidle" });
  await page.locator('input[type="file"]').setInputFiles(`${output}/synthetic-protocol.docx`);
  await page.getByRole("button", { name: "Preview import", exact: true }).click();
  await page.getByRole("button", { name: "Import 1 record", exact: true }).waitFor();
  await page.screenshot({ path: `${output}/docx-import-preview.png` });
  const button = page.getByRole("button", { name: "Import 1 record", exact: true });
  assert(await button.isEnabled(), "Synthetic Word template previews as importable");
  await button.click();
  await page.waitForURL(url => !url.pathname.endsWith("/import"));
  results.push(`Word: real upload → preview → import → ${new URL(page.url()).pathname}`);

  await mkdir(`${output}/print`, { recursive: true });
  for (const width of [1366, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/protocols/${f.protocolId}`, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    await page.pdf({ path: `${output}/print/protocol-${width}.pdf`, format: "A4", printBackground: true, preferCSSPageSize: true });
    await page.emulateMedia({ media: "screen" });
  }
  results.push("A4 print PDFs generated from the real read-only Protocol at three viewport widths");
  await writeFile(`${output}/import-print-results.json`, JSON.stringify({ results }, null, 2));
  console.log(JSON.stringify({ passed: results.length, results }, null, 2));
} finally { await browser.close(); }
