import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chromium, webkit } from "playwright";

const base = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3010";
const output = ".local-runtime/collections-20261104/print";
const f = JSON.parse(await readFile(".local-runtime/collections-20261104/fixtures.json", "utf8"));
const results = [];
for (const [engine, type] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await type.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${base}/protocols/${f.protocolId}`, { waitUntil: "networkidle" });
    const button = page.locator(".ln-systems-options button").first();
    const content = () => page.locator(".document-a4-paper").innerText();
    if (engine === "chromium") {
      await page.emulateMedia({ media: "print" });
      await page.pdf({ path: `${output}/q413-after-all.pdf`, format: "A4", printBackground: true });
      await page.emulateMedia({ media: "screen" });
    }
    const all = await content();
    await button.click();
    await page.waitForFunction(() => document.querySelector(".ln-systems-options button").getAttribute("aria-pressed") === "true");
    const saved = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith("labnest.protocol-lens:")));
    if (engine === "chromium") {
      await page.emulateMedia({ media: "print" });
      await page.pdf({ path: `${output}/q413-after-lens.pdf`, format: "A4", printBackground: true });
      await page.emulateMedia({ media: "screen" });
    } else {
      await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
      assert.equal(await content(), all);
      await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    }
    await page.waitForFunction(() => document.querySelector(".ln-systems-options button").getAttribute("aria-pressed") === "true");
    assert.deepEqual(await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith("labnest.protocol-lens:"))), saved);
    results.push({ engine, readingSelectionRestored: true, fullSourceDuringPrint: true, actualPdf: engine === "chromium" });
  } finally { await browser.close(); }
}
const text = name => execFileSync("pdftotext", ["-layout", `${output}/q413-after-${name}.pdf`, "-"]);
const all = text("all"), filtered = text("lens");
assert(all.equals(filtered), "A reading filter must not alter printed scientific content.");
const result = { passed: true, results, characters: all.toString().length, sha256: createHash("sha256").update(all).digest("hex") };
await writeFile(`${output}/lens-regression.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
