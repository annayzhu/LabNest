/**
 * Browser acceptance for 上传图片 (photos of a manual → text → Protocol), against an isolated database and a mock vision model.
 *
 *   DATABASE_URL=postgresql://…/labnest_protocol_ai_extraction_20261009 \
 *   LABNEST_E2E_BASE_URL=http://localhost:3339 node scripts/verify-protocol-photos.mjs
 *
 * The app must run against the same database. The mock model recognises each picture by its width, answers three at a
 * time at most, and fails one picture once so the retry can be seen. No picture is ever written to storage.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import pg from "pg";
import sharp from "sharp";

const database = new URL(process.env.DATABASE_URL ?? "");
assert(["/labnest_protocol_ai_extraction_20261009", "/labnest_ai_module_acceptance_20261014", "/labnest_ai_connection_20261014"].includes(database.pathname), "Only an isolated acceptance database is permitted");
assert(["localhost", "127.0.0.1"].includes(database.hostname));
const base = process.env.LABNEST_E2E_BASE_URL ?? "http://localhost:3339";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname) && new URL(base).port !== "3001");
const mockPort = Number(process.env.AI_MOCK_PORT ?? 4851);
const evidenceDir = process.env.AI_EVIDENCE_DIR ?? "docs/structured-protocol/20261014-redesign/photo-evidence";
await mkdir(evidenceDir, { recursive: true });

// Five pages of a made-up kit manual; the width of a picture says which page it is.
const pages = { 301: "XX 总 RNA 提取试剂盒 使用说明书", 302: "1. 加入 350 µL Buffer RL，涡旋混匀 15 s。", 303: "2. 12,000 ×g 离心 2 min，将上清转移至吸附柱。", 304: "3. 加入 700 µL Buffer RW1，12,000 ×g 离心 30 s，弃滤液。", 305: "4. 加入 50 µL RNase-free 水，室温静置 1 min，洗脱 RNA。" };
const token = "photos-fake-token";
const seen = [];
let inFlight = 0, maxInFlight = 0, failedOnce = false;
const mock = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const reply = (data, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
  if (req.headers.authorization !== `Bearer ${token}`) return reply({ error: { message: "bad key" } }, 401);
  if (req.url.endsWith("/models")) return reply({ data: [{ id: "mock-vl" }] });
  const request = JSON.parse(body);
  const content = request.messages.at(-1).content;
  const picture = Array.isArray(content) ? content.find(part => part.type === "image_url") : undefined;
  if (!picture) return reply({ model: "mock-vl", choices: [{ message: { content: "OK" } }] });
  const data = picture.image_url.url.replace(/^data:image\/jpeg;base64,/, "");
  const { width } = await sharp(Buffer.from(data, "base64")).metadata();
  seen.push(width);
  inFlight += 1; maxInFlight = Math.max(maxInFlight, inFlight);
  await new Promise(resolve => setTimeout(resolve, 350));
  inFlight -= 1;
  if (width === 303 && !failedOnce) { failedOnce = true; return reply({ error: { message: "temporarily busy" } }, 503); }
  return reply({ model: "mock-vl", choices: [{ message: { content: pages[width] ?? "【没有可读文字】" } }] });
});

const db = new pg.Client({ connectionString: database.toString() });
const report = { base, at: new Date().toISOString(), synthetic: true, liveProviders: false, checks: [], failures: [] };
async function check(name, run) {
  try { await run(); report.checks.push({ name, status: "passed" }); console.log("PASS", name); }
  catch (error) { report.failures.push({ name, error: String(error) }); throw error; }
  finally { await writeFile(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2)); }
}
const picture = (width, height = 200) => sharp({ create: { width, height, channels: 3, background: { r: 240, g: 240, b: 240 } } }).jpeg().toBuffer();

async function savePreferences(page, { enabled, defaultId, visionId }) {
  await page.goto(`${base}/ai`, { waitUntil: "networkidle" });
  const form = page.locator('form:has(select[name="defaultProviderId"])');
  if (defaultId !== undefined) await form.locator('[name="defaultProviderId"]').selectOption(defaultId ?? "");
  if (visionId !== undefined) await form.locator('[name="visionProviderId"]').selectOption(visionId ?? "");
  await Promise.all([page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith("/api/ai/settings")), form.getByRole("button", { name: "保存功能设置", exact: true }).click()]);
  const toggle = page.getByRole("switch", { name: "启用 AI", exact: true });
  if ((await toggle.getAttribute("aria-checked") === "true") !== enabled) await Promise.all([page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith("/api/ai/settings")), toggle.click()]);
}

let browser, providerId;
try {
  await db.connect();
  const imagesBefore = Number((await db.query(`SELECT count(*) FROM "Attachment" WHERE "mimeType" LIKE 'image/%'`)).rows[0].count);
  await new Promise(resolve => mock.listen(mockPort, "127.0.0.1", resolve));
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await context.addCookies([{ name: "labnest_locale", value: "zh", url: base }]);
  const page = await context.newPage();

  // A service that is the default but not chosen for photos: OpenAI-compatible, so it is not assumed to see.
  await page.goto(`${base}/ai`, { waitUntil: "networkidle" });
  const form = page.locator('form:has(input[name="apiKey"])');
  await form.getByRole("button", { name: "使用 DeepSeek" }).click();
  await form.locator('[name="name"]').fill("Photo mock");
  await form.locator('[name="baseUrl"]').fill(`http://127.0.0.1:${mockPort}/v1`);
  await form.locator('[name="defaultModel"]').fill("mock-vl");
  await form.locator('[name="apiKey"]').fill(token);
  await Promise.all([page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/ai"), form.getByRole("button", { name: "添加服务", exact: true }).click()]);
  providerId = (await db.query('SELECT id FROM "AIProvider" WHERE name=$1 ORDER BY "createdAt" DESC LIMIT 1', ["Photo mock"])).rows[0].id;
  await savePreferences(page, { enabled: true, defaultId: providerId, visionId: "" });

  await check("without a photo service the picture button is gray and opens the setup note", async () => {
    await page.goto(`${base}/protocols/import/recognize`, { waitUntil: "networkidle" });
    await page.getByLabel("选择图片").setInputFiles([{ name: "a.jpg", mimeType: "image/jpeg", buffer: await picture(301) }]);
    const button = page.getByRole("button", { name: /识别图片（1 张）/ });
    assert.equal(await button.getAttribute("data-ai-off"), "true");
    await button.click();
    await page.getByText("识别图片还差一步").waitFor();
    assert.equal(seen.length, 0, "nothing is sent while no service reads pictures");
  });

  await savePreferences(page, { enabled: true, defaultId: providerId, visionId: providerId });

  await check("more than 50 pictures are cut to 50 with a note", async () => {
    await page.goto(`${base}/protocols/import/recognize`, { waitUntil: "networkidle" });
    const tiny = await picture(8, 8);
    await page.getByLabel("选择图片").setInputFiles(Array.from({ length: 52 }, (_, index) => ({ name: `p${index}.jpg`, mimeType: "image/jpeg", buffer: tiny })));
    await page.getByText("最多 50 张，已忽略多出的 2 张。").waitFor();
    assert.equal(await page.locator(".ln-photo").count(), 50);
  });

  await check("five pictures are read three at a time, one failure is retried, order is kept, no picture is stored", async () => {
    await page.goto(`${base}/protocols/import/recognize`, { waitUntil: "networkidle" });
    // Chosen out of order, then put right with the move buttons.
    const widths = [302, 301, 303, 304, 305];
    await page.getByLabel("选择图片").setInputFiles(await Promise.all(widths.map(async width => ({ name: `w${width}.jpg`, mimeType: "image/jpeg", buffer: await picture(width) }))));
    assert.equal(await page.locator(".ln-photo").count(), 5);
    await page.getByRole("button", { name: "第 1 张下移" }).click();
    await page.getByText("将把 5 张图片发给“Photo mock”，每张单独发送。").waitFor();
    seen.length = 0; maxInFlight = 0;
    await page.getByRole("button", { name: "识别图片（5 张）" }).click();
    await page.getByRole("button", { name: /重试 1 张没读出来的/ }).waitFor({ timeout: 60_000 });
    assert.equal(await page.locator('.ln-photo[data-status="failed"]').count(), 1);
    assert(maxInFlight <= 3 && maxInFlight >= 2, `parallel requests: ${maxInFlight}`);
    await page.screenshot({ path: `${evidenceDir}/photos-failed-one.png`, fullPage: true });
    await page.getByRole("button", { name: /重试 1 张没读出来的/ }).click();
    await page.getByText("按写法读取（未用 AI）", { exact: false }).waitFor({ timeout: 60_000 });
    assert.equal(seen.length, 6, "five pictures and one retry");
    await page.getByRole("button", { name: "修改文字" }).click();
    const text = await page.locator("textarea").last().inputValue();
    assert.equal(text, Object.values(pages).join("\n\n"), "the pages are joined in the order the author set");
    await page.screenshot({ path: `${evidenceDir}/photos-read.png`, fullPage: true });
    const imagesNow = Number((await db.query(`SELECT count(*) FROM "Attachment" WHERE "mimeType" LIKE 'image/%'`)).rows[0].count);
    assert.equal(imagesNow, imagesBefore, "no picture was stored");
    const kept = await db.query(`SELECT "originalFilename", "mimeType" FROM "Attachment" ORDER BY "uploadedAt" DESC LIMIT 1`);
    assert.deepEqual(kept.rows[0], { originalFilename: "照片转写（5 张，照片未存档）.txt", mimeType: "text/plain" });
  });

  await check("存为草稿规程 saves the text as the source of a draft", async () => {
    await Promise.all([page.waitForURL(/\/protocols\/[^/]+\/versions\/[^/]+\/edit$/, { timeout: 60_000 }), page.getByRole("button", { name: "存为草稿规程" }).click()]);
    const versionId = page.url().split("/versions/")[1].split("/")[0];
    const version = (await db.query('SELECT "changeSummary", "stepsJson" FROM "ProtocolVersion" WHERE id=$1', [versionId])).rows[0];
    assert.match(version.changeSummary, /照片转写（5 张，照片未存档）\.txt/);
    assert.equal(version.stepsJson.length, 4);
  });
} finally {
  if (providerId && browser) { const page = await (await browser.newContext()).newPage(); await savePreferences(page, { enabled: false, defaultId: null, visionId: null }).catch(() => undefined); }
  await browser?.close();
  mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve));
  await db.end();
  await writeFile(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2));
}
