// Protocol transfer between two LabNests (Q438–Q443): tick Protocols in A's list, export the JSON file, import it in B.
// A and B are two local dev servers on separate test databases and attachment folders; never the formal database.
//   LABNEST_TRANSFER_A=http://localhost:3006 LABNEST_TRANSFER_B=http://localhost:3007 node scripts/verify-protocol-transfer.mjs
// LABNEST_TRANSFER_CODES names the Protocols to tick in A (the first one should have pictures, a Project and a Research Plan).
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const A = process.env.LABNEST_TRANSFER_A ?? "http://localhost:3006";
const B = process.env.LABNEST_TRANSFER_B ?? "http://localhost:3007";
const dir = process.env.LABNEST_QA_DIR ?? "docs/modules/structured-protocol/protocol-transfer-20261111/evidence";
const codes = (process.env.LABNEST_TRANSFER_CODES ?? "PRT-200005,PRT-200004").split(",");
for (const base of [A, B]) assert(/^(localhost|127\.0\.0\.1)$/.test(new URL(base).hostname), "Runs only against local test servers.");
assert.notEqual(A, B, "A and B must be two LabNests.");
await mkdir(dir, { recursive: true });
// The exported files hold whatever the test database holds, so they stay out of the evidence folder.
const downloads = await mkdtemp(join(tmpdir(), "labnest-transfer-"));

const viewports = [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: viewports[1], timezoneId: "Asia/Shanghai", acceptDownloads: true });
await context.addCookies([A, B].map((url) => ({ name: "labnest_locale", value: "zh", url })));
context.setDefaultTimeout(20000);
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
const report = { head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), browser: browser.version(), a: A, b: B, checks: [], measurements: [] };

async function check(name, run) {
  try { await run(); report.checks.push({ name, status: "通过" }); }
  catch (error) { report.checks.push({ name, status: "失败", error: String(error) }); throw error; }
  finally { await writeFile(`${dir}/browser-report.json`, JSON.stringify(report, null, 2)); }
}
/** One screenshot per window size, with what was measured in it: the smallest text, and whether the page scrolls sideways. */
async function shots(name, scope = ".app-shell-main") {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(250);
    const measured = await page.evaluate((selector) => {
      const root = document.querySelector(selector) ?? document.body;
      let minFont = Infinity; let minText = "";
      for (const element of root.querySelectorAll("*")) {
        const own = [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
        const box = element.getBoundingClientRect();
        if (!own || !box.width || !box.height) continue;
        const size = Number.parseFloat(getComputedStyle(element).fontSize);
        if (size < minFont) { minFont = size; minText = element.textContent.trim().slice(0, 30); }
      }
      return { minFontPx: minFont, minFontText: minText, sidewaysScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth, pageHeight: document.documentElement.scrollHeight };
    }, scope);
    report.measurements.push({ name, viewport: `${viewport.width}x${viewport.height}`, ...measured });
    assert(measured.minFontPx >= 12, `${name} ${viewport.width}: text of ${measured.minFontPx}px (“${measured.minFontText}”)`);
    assert(!measured.sidewaysScroll, `${name} ${viewport.width}: the page scrolls sideways`);
    await page.screenshot({ path: `${dir}/${name}-${viewport.width}.png` });
  }
  await page.setViewportSize(viewports[1]);
}
const download = async (trigger, name) => {
  const [file] = await Promise.all([page.waitForEvent("download"), trigger()]);
  const path = join(downloads, name);
  await file.saveAs(path);
  return { path, suggested: file.suggestedFilename(), json: JSON.parse(await readFile(path, "utf8")) };
};
const protocolCodes = async (base) => {
  await page.goto(`${base}/protocols?sort=code_asc`, { waitUntil: "networkidle" });
  return page.locator("tbody tr").evaluateAll((rows) => rows.map((row) => row.innerText.match(/PRT-\d+/)?.[0]).filter(Boolean));
};
/**
 * A document without what is allowed to differ after the move: file IDs, where it came from, and links to pages of the
 * LabNest it was written in. Pictures written into text lines are compared as the blocks they hold.
 */
const comparable = (document) => {
  const walk = (value) => {
    if (typeof value === "string") return value.split("\n").map((line) => {
      const media = line.match(/<!--labnest-media:([^\s]+)-->\s*$/);
      if (media) return `media:${JSON.stringify(walk(JSON.parse(decodeURIComponent(media[1]))))}`;
      return line.replace(/(?<!!)\[([^\]\n]+)\]\(\/(?!\/)[^)\s]*\)/g, "$1");
    }).join("\n");
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.keys(value).sort()
      .filter((key) => !["attachmentId", "provenance"].includes(key) && !(key === "link" && String(value[key]).startsWith("/")))
      .map((key) => [key, walk(value[key])]));
  };
  return JSON.stringify(walk(document));
};

// Places in the document to photograph in A and again in B: the picture, the mix card, the program card.
const marks = (process.env.LABNEST_TRANSFER_MARKS ?? "合成测试段落|合成配液卡：裂解预混液|合成程序卡：PCR").split("|").filter(Boolean);
async function markShots(prefix) {
  for (const [index, mark] of marks.entries()) {
    const target = page.locator(".app-shell-main").getByText(mark).first();
    await target.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -140));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${dir}/${prefix}-part-${index + 1}-1440.png` });
  }
}

let batch; let single; let importedHref; let codesBefore;
try {
  await check("A：列表勾选 → 导出 → JSON，文件带图片", async () => {
    await page.goto(`${A}/protocols`, { waitUntil: "networkidle" });
    for (const code of codes) await page.locator("tbody tr", { hasText: code }).locator('input[type="checkbox"]').check();
    await page.getByRole("link", { name: "导出", exact: true }).or(page.getByRole("button", { name: "导出", exact: true })).first().click();
    await page.waitForURL(/\/protocols\/export\?/);
    await page.getByText("发给别人，在他们的 LabNest 里导入").waitFor();
    assert(await page.locator('input[name="exportScope"][value="selected"]').isChecked(), "selected scope is not preselected");
    await shots("a-export");
    batch = await download(() => page.locator('button[name="format"][value="json"]').click(), "exported-batch.json");
    assert.equal(batch.json.protocolTransferVersion, 1);
    assert.deepEqual(batch.json.records.map((record) => record.humanCode).sort(), [...codes].sort());
    assert(batch.json.media.length >= 2, "the file carries no pictures");
    report.batchFile = { name: batch.suggested, bytes: (await readFile(batch.path)).length, records: batch.json.records.length, pictures: batch.json.media.length };
  });

  await check("A：详情页 导出 → JSON 是同一种可导入文件", async () => {
    const href = await page.goto(`${A}/protocols?q=${codes[0]}`, { waitUntil: "networkidle" }).then(() => page.locator("tbody tr a", { hasText: codes[0] }).first().getAttribute("href"));
    await page.goto(A + href, { waitUntil: "networkidle" });
    await page.locator(".protocol-export-menu > button").click();
    await page.getByText("可导入的文件，含图片").waitFor();
    await page.screenshot({ path: `${dir}/a-detail-export-menu-1440.png` });
    single = await download(() => page.locator(".protocol-export-menu-popover a", { hasText: "JSON" }).click(), "exported-single.json");
    assert.equal(single.json.schemaVersion, batch.json.schemaVersion);
    assert.equal(single.json.records.length, 1);
    assert.equal(single.json.records[0].humanCode, codes[0]);
    assert.equal(single.json.media.length, batch.json.media.length);
    await shots("a-protocol");
    await markShots("a-protocol");
  });

  await check("B：导入页预览说明自动编号和未带入的项目", async () => {
    codesBefore = await protocolCodes(B);
    await page.goto(`${B}/protocols/import`, { waitUntil: "networkidle" });
    await page.locator('input[type="file"]').setInputFiles(batch.path);
    await page.getByRole("button", { name: /预览导入|Preview import/ }).click();
    await page.getByText(`导入时自动生成（文件中为 ${codes[0]}）`).waitFor();
    const text = await page.locator(".app-shell-main").innerText();
    assert(/原属项目“.+”，未带入；导入到实验规程库。/.test(text), "the Project note is missing");
    assert(!/already exists|已存在/.test(text), "a code clash is still reported");
    assert(!/Assigned on import|not carried over|kept as plain text/.test(text), "an English sentence is left on the Chinese page");
    await shots("b-import-preview");
    // The record itself, as the person checking it reads it.
    await page.locator("article, section, div").filter({ hasText: /^记录 1/ }).first().scrollIntoViewIfNeeded().catch(() => undefined);
    await page.getByText(`导入时自动生成（文件中为 ${codes[0]}）`).scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, -260);
    await page.waitForTimeout(300);
    for (const viewport of viewports) { await page.setViewportSize(viewport); await page.waitForTimeout(200); await page.screenshot({ path: `${dir}/b-import-preview-record-${viewport.width}.png` }); }
    await page.setViewportSize(viewports[1]);
    await page.getByText(/原属项目“.+”，未带入/).first().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 200));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${dir}/b-import-preview-notes-1440.png` });
  });

  await check("B：确认导入，得到新编号、草稿、通用库", async () => {
    await page.getByRole("button", { name: new RegExp(`(导入|Import) ?${codes.length}`) }).click();
    await page.locator('a[href^="/protocols/c"]').first().waitFor();
    const hrefs = await page.locator('a[href^="/protocols/c"]').evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")))]);
    await page.screenshot({ path: `${dir}/b-import-done-1440.png` });
    const codesAfter = await protocolCodes(B);
    const added = codesAfter.filter((code) => !codesBefore.includes(code));
    assert.equal(added.length, codes.length, `expected ${codes.length} new codes, got ${added}`);
    assert(codesBefore.every((code) => codesAfter.includes(code)), "a Protocol B already had changed its code");
    report.codes = { inFile: codes, bBefore: codesBefore, bNew: added };
    const title = batch.json.records.find((record) => record.humanCode === codes[0]).canonicalTitle;
    await page.goto(`${B}/protocols?q=${encodeURIComponent(title.slice(0, 12))}`, { waitUntil: "networkidle" });
    const row = page.locator("tbody tr", { hasText: title.slice(0, 12) }).first();
    const rowText = await row.innerText();
    assert(/草稿/.test(rowText) && /实验规程库|通用/.test(rowText), `not a draft in the library: ${rowText}`);
    importedHref = await row.locator("a").first().getAttribute("href");
    assert(hrefs.includes(importedHref));
  });

  await check("B：导入后的页面显示图片、配液卡、程序卡，正文与 A 一致", async () => {
    await page.goto(B + importedHref, { waitUntil: "networkidle" });
    await page.waitForFunction(() => { const images = [...document.querySelectorAll("main img")]; return images.length >= 2 && images.every((image) => image.complete && image.naturalWidth > 0); });
    report.pictures = await page.locator("main img").evaluateAll((images) => images.map((image) => ({ src: new URL(image.src).pathname, natural: `${image.naturalWidth}x${image.naturalHeight}`, shown: `${Math.round(image.getBoundingClientRect().width)}x${Math.round(image.getBoundingClientRect().height)}` })));
    const text = await page.locator(".app-shell-main").innerText();
    for (const expected of ["合成配液卡：裂解预混液", "合成程序卡：PCR", "RNase A · LOT-合成-22", "S-014 合成样本"]) assert(text.includes(expected), `missing “${expected}”`);
    assert.equal(await page.locator('main a[href^="/samples/"], main a[href^="/inventory/"], main a[href^="/experiments/c"]').count(), 0, "a link to the other LabNest's record is left");
    await shots("b-protocol");
    await markShots("b-protocol");
    const versionId = (await page.locator(".protocol-export-menu-popover a", { hasText: "JSON" }).getAttribute("href")).split("/versions/")[1].split("/")[0];
    const back = await (await page.request.get(`${B}${importedHref.replace("/protocols/", "/api/protocols/")}/versions/${versionId}/json`)).json();
    const source = batch.json.records.find((record) => record.humanCode === codes[0]);
    assert.notEqual(back.records[0].humanCode, codes[0]);
    assert.equal(back.records[0].displayVersion, source.displayVersion);
    assert.equal(back.records[0].scope, "general");
    assert.equal(back.records[0].project ?? null, null);
    // Nothing but file IDs and the links to A's records differs: parameters, systems, cards and tables are as written.
    assert.equal(comparable(back.records[0].contentJson), comparable(source.contentJson));
    assert(JSON.stringify(source.contentJson).includes("](/samples/") && !JSON.stringify(back.records[0].contentJson).includes("](/samples/"));
    report.documentBytes = { a: JSON.stringify(source.contentJson).length, b: JSON.stringify(back.records[0].contentJson).length };
  });

  await check("B：导入历史写明原编号和原版本", async () => {
    await page.goto(`${B}${importedHref}`, { waitUntil: "networkidle" });
    const history = page.locator("[data-protocol-import-history]").first();
    // The history sits in the page's properties; open whatever is folded around it, then the history itself.
    await history.evaluate((element) => { for (let node = element; node; node = node.parentElement) if (node instanceof HTMLDetailsElement) node.open = true; });
    await history.scrollIntoViewIfNeeded();
    const text = await history.innerText();
    assert(text.includes(`原编号`) && text.includes(codes[0]), `import history: ${text}`);
    await page.screenshot({ path: `${dir}/b-import-history-1440.png` });
  });

  await check("B：同一个文件第二次导入被拒绝并说明原因", async () => {
    await page.goto(`${B}/protocols/import`, { waitUntil: "networkidle" });
    await page.locator('input[type="file"]').setInputFiles(batch.path);
    await page.getByRole("button", { name: /预览导入|Preview import/ }).click();
    await page.getByText("这个文件已经导入过了。").first().waitFor();
    await page.screenshot({ path: `${dir}/b-import-again-1440.png` });
  });

  assert.deepEqual(pageErrors, [], "page errors");
} finally {
  report.pageErrors = pageErrors;
  await writeFile(`${dir}/browser-report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
