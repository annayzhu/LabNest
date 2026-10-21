/**
 * Browser acceptance for 按产品查找说明书 and the manuals kept on inventory items, against an isolated database.
 *
 *   DATABASE_URL=postgresql://…/labnest_protocol_ai_extraction_20261009 LABNEST_MANUAL_SEARCH_URL=http://127.0.0.1:4852/search \
 *   LABNEST_E2E_BASE_URL=http://localhost:3339 node scripts/verify-product-manuals.mjs
 *
 * The app must run against the same database with the same LABNEST_MANUAL_SEARCH_URL: a local stand-in answers where
 * Tavily would. Downloading from a vendor's site is covered by unit tests with a fake fetch; nothing here leaves the machine.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import pg from "pg";

const database = new URL(process.env.DATABASE_URL ?? "");
assert(["/labnest_protocol_ai_extraction_20261009", "/labnest_ai_module_acceptance_20261014", "/labnest_ai_connection_20261014"].includes(database.pathname), "Only an isolated acceptance database is permitted");
assert(["localhost", "127.0.0.1"].includes(database.hostname));
const base = process.env.LABNEST_E2E_BASE_URL ?? "http://localhost:3339";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname) && new URL(base).port !== "3001");
const searchUrl = new URL(process.env.LABNEST_MANUAL_SEARCH_URL ?? "");
assert(searchUrl.hostname === "127.0.0.1", "the web search must be the local stand-in");
const evidenceDir = process.env.AI_EVIDENCE_DIR ?? "docs/structured-protocol/20261014-redesign/manual-evidence";
await mkdir(evidenceDir, { recursive: true });

/** A one-page PDF with a few steps of text; the reader finds the text without needing a perfect cross-reference table. */
function pdfWith(lines) {
  const stream = `BT /F1 12 Tf 50 750 Td 16 TL ${lines.map(line => `(${line}) Tj T*`).join(" ")} ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let body = "%PDF-1.4\n"; const offsets = [];
  objects.forEach((object, index) => { offsets.push(body.length); body += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, "latin1");
}

const requests = [];
const mock = createServer(async (req, res) => {
  let body = ""; for await (const chunk of req) body += chunk;
  requests.push({ auth: req.headers.authorization, body: JSON.parse(body) });
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ results: [
    { title: "RNeasy Mini Handbook", url: "https://www.qiagen.com/HB-0435-rneasy-mini.pdf", content: "Purification of total RNA from animal cells" },
    { title: "RNeasy Mini Kit page", url: "https://www.qiagen.com/us/products/rneasy-mini-kit", content: "Kit overview" },
    { title: "A blog copy", url: "https://blog.example.com/rneasy.pdf", content: "not a vendor" },
  ] }));
});

const db = new pg.Client({ connectionString: database.toString() });
const report = { base, at: new Date().toISOString(), synthetic: true, liveProviders: false, checks: [], failures: [] };
async function check(name, run) {
  try { await run(); report.checks.push({ name, status: "passed" }); console.log("PASS", name); }
  catch (error) {
    const page = browser?.contexts()[0]?.pages().at(-1);
    report.failures.push({ name, error: String(error), ...(page ? { url: page.url(), body: (await page.locator('body').innerText().catch(() => '')).slice(0, 6000) } : {}) });
    await page?.screenshot({ path: `${evidenceDir}/failure.png`, fullPage: true }).catch(() => undefined);
    throw error;
  }
  finally { await writeFile(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2)); }
}

let browser;
try {
  await db.connect();
  await new Promise(resolve => mock.listen(Number(searchUrl.port), "127.0.0.1", resolve));
  const itemId = "manual-test-item-20261020";
  await db.query(`INSERT INTO "InventoryItem" (id, name, vendor, "catalogNumber", unit, status, "freezeThawCount", "managementMode", "quantityRecorded", "updatedAt") VALUES ($1, 'RNeasy Mini Kit', 'Qiagen', '74104', 'kit', 'active', 0, 'package', false, now()) ON CONFLICT (id) DO NOTHING`, [itemId]);
  await db.query(`UPDATE "AISettings" SET enabled = false WHERE id = 'default'`);
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await context.addCookies([{ name: "labnest_locale", value: "zh", url: base }]);
  const page = await context.newPage();

  await check("a manual is added to an inventory item and listed there", async () => {
    await page.goto(`${base}/inventory/${itemId}`, { waitUntil: "networkidle" });
    await page.getByText("这个物品上还没有挂说明书。").waitFor();
    await page.getByLabel("说明书文件").setInputFiles({ name: "RNeasy_Mini_Handbook.pdf", mimeType: "application/pdf", buffer: pdfWith(["RNeasy Mini Handbook", "1. Add 350 uL Buffer RLT and mix for 15 s.", "2. Centrifuge at 8000 g for 15 s.", "3. Add 700 uL Buffer RW1 and centrifuge for 15 s."]) });
    await page.getByRole("button", { name: "添加说明书" }).click();
    await page.getByText("已添加说明书").waitFor();
    await page.getByRole("link", { name: "RNeasy_Mini_Handbook.pdf" }).waitFor();
    const link = await db.query(`SELECT "linkType" FROM "AttachmentLink" WHERE "targetType" = 'inventory_item' AND "targetId" = $1`, [itemId]);
    assert.deepEqual(link.rows, [{ linkType: "product_manual" }]);
    await page.screenshot({ path: `${evidenceDir}/inventory-manual.png`, fullPage: true });
  });

  await check("searching finds it on the item, says why the web was not searched, and organizes it into a Protocol", async () => {
    await page.goto(`${base}/protocols/import/recognize`, { waitUntil: "networkidle" });
    await page.getByLabel("产品名、货号或厂商").fill("74104");
    await page.getByRole("button", { name: "搜索", exact: true }).click();
    await page.getByText("库存物品“RNeasy Mini Kit”上挂的说明书 · 74104").waitFor();
    await page.getByText("AI 未开启，只搜了库存物品上挂的说明书。").waitFor();
    assert.equal(requests.length, 0, "no web request while AI is off");
    await page.screenshot({ path: `${evidenceDir}/search-inventory.png`, fullPage: true });
    await page.getByRole("button", { name: "整理成规程" }).click();
    await page.getByText("按写法读取（未用 AI）", { exact: false }).waitFor({ timeout: 60_000 });
    await page.getByText("RNeasy_Mini_Handbook.pdf", { exact: false }).first().waitFor();
    const steps = await page.getByText(/转换为步骤块：\d+ 步/).first().innerText();
    assert.match(steps, /转换为步骤块：[1-9]\d* 步/);
  });

  await check("with AI on and a key saved, the vendors' sites are searched once, listed vendors only", async () => {
    await db.query(`INSERT INTO "AISettings" (id, enabled, "externalDataPolicy", "attachmentsEnabled", "updatedAt") VALUES ('default', true, 'explicit_context', false, now()) ON CONFLICT (id) DO UPDATE SET enabled = true`);
    await page.goto(`${base}/protocols/import/recognize`, { waitUntil: "networkidle" });
    await page.getByText("网页搜索设置").click();
    await page.getByLabel(/^搜索密钥/).fill("tvly-test-key");
    await page.getByRole("button", { name: "保存设置" }).click();
    await page.getByText("已保存", { exact: true }).waitFor();
    await page.goto(`${base}/protocols/import/recognize`, { waitUntil: "networkidle" });
    await page.getByLabel("产品名、货号或厂商").fill("RNeasy");
    await page.getByRole("button", { name: "搜索", exact: true }).click();
    await page.getByText("RNeasy Mini Handbook").first().waitFor();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].auth, "Bearer tvly-test-key");
    assert(requests[0].body.include_domains.includes("qiagen.com") && requests[0].body.include_domains.includes("vazyme.com"));
    assert.equal(await page.getByText("A blog copy").count(), 0, "a hit off the vendor list is dropped");
    await page.getByText("这是网页，不是 PDF").waitFor();
    assert.equal(await page.getByRole("button", { name: "整理成规程" }).count(), 2, "the inventory manual and the vendor PDF can be taken in; the web page cannot");
    await page.screenshot({ path: `${evidenceDir}/search-web.png`, fullPage: true });
    const key = await db.query(`SELECT "webSearchKeyEncrypted" FROM "MethodSearchSettings" WHERE id = 'default'`);
    assert.match(key.rows[0].webSearchKeyEncrypted, /^v1:/, "the key is stored encrypted");
    assert(!(await page.content()).includes("tvly-test-key"), "the saved key never comes back to the page");
  });
} finally {
  await db.query(`UPDATE "AISettings" SET enabled = false WHERE id = 'default'`).catch(() => undefined);
  await browser?.close();
  mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve));
  await db.end();
  await writeFile(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2));
}
