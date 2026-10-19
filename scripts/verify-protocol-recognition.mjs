/**
 * Browser acceptance for 整理说明书或非模板规程 (AI 识别), against an isolated database and a mock model.
 *
 *   DATABASE_URL=postgresql://…/labnest_protocol_ai_extraction_20261009 \
 *   LABNEST_E2E_BASE_URL=http://localhost:3339 node scripts/verify-protocol-recognition.mjs
 *
 * The app must run against the same database. The mock model first answers with a number that is not in the manual,
 * so the check fails and one repair round follows; the second answer is faithful.
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
const mockPort = Number(process.env.AI_MOCK_PORT ?? 4849);
const evidenceDir = process.env.AI_EVIDENCE_DIR ?? "docs/structured-protocol/20261014-redesign/recognition-evidence";
await mkdir(evidenceDir, { recursive: true });

/** A made-up kit manual, and its faithful layout (the same pair as src/lib/protocol-recognition.test.ts). */
const manual = [
  "XX 总 RNA 提取试剂盒 使用说明书",
  "产品简介：本试剂盒适用于从培养细胞中快速提取高纯度总 RNA。",
  "储存条件：室温保存，有效期 12 个月。",
  "试剂盒组分：Buffer RL 35 mL；Buffer RW1 45 mL；RNase-free 水 10 mL。",
  "操作步骤",
  "1. 收集细胞：样本少于 5×10^6 个细胞时加入 350 µL Buffer RL，5×10^6 至 1×10^7 个细胞时加入 600 µL Buffer RL，涡旋混匀 15 s。",
  "2. 富脂样本另加 200 µL 氯仿，剧烈振荡 15 s。",
  "3. 12,000 ×g 离心 2 min，将上清转移至吸附柱。",
  "4. 加入 700 µL Buffer RW1，12,000 ×g 离心 30 s，弃滤液。",
  "5. 加入 50 µL RNase-free 水，室温静置 1 min，12,000 ×g 离心 1 min 洗脱 RNA。",
  "结果检测：用分光光度计测定 RNA 浓度和 A260/280。",
  "常见问题：RNA 产量低怎么办？请确认样本量不超过 1×10^7 个细胞。",
].join("\n");
const faithful = [
  "标题：XX 总 RNA 提取试剂盒 使用说明书",
  "说明：本试剂盒适用于从培养细胞中快速提取高纯度总 RNA。",
  "材料：", "- Buffer RL | 35 mL |", "- Buffer RW1 | 45 mL |", "- RNase-free 水 | 10 mL |",
  "步骤：", "体系：少于 5×10^6 个细胞 / 5×10^6 至 1×10^7 个细胞",
  "1. 收集细胞：加入 350/600 µL Buffer RL，涡旋混匀 15 s。", "2. 仅富脂样本：另加 200 µL 氯仿，剧烈振荡 15 s。",
  "3. 12,000 ×g 离心 2 min，将上清转移至吸附柱。", "4. 加入 700 µL Buffer RW1，12,000 ×g 离心 30 s，弃滤液。",
  "5. 加入 50 µL RNase-free 水，室温静置 1 min，12,000 ×g 离心 1 min 洗脱 RNA。",
  "结果：", "记录：RNA 浓度、A260/280",
].join("\n");

const token = "recognition-fake-token";
const answers = [faithful.replace("700 µL", "750 µL"), faithful];
const completions = [];
const mock = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const reply = (data, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
  if (req.headers.authorization !== `Bearer ${token}`) return reply({ error: { message: "bad key" } }, 401);
  if (req.url.endsWith("/models")) return reply({ data: [{ id: "mock-model" }] });
  completions.push(JSON.parse(body));
  return reply({ model: "mock-model", choices: [{ message: { content: answers[Math.min(completions.length, answers.length) - 1] } }] });
});

const db = new pg.Client({ connectionString: database.toString() });
const report = { base, at: new Date().toISOString(), synthetic: true, liveProviders: false, checks: [], failures: [] };
async function check(name, run) {
  try { await run(); report.checks.push({ name, status: "passed" }); console.log("PASS", name); }
  catch (error) { report.failures.push({ name, error: String(error) }); throw error; }
  finally { await writeFile(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2)); }
}

async function setAI(page, providerId, enabled) {
  await page.goto(`${base}/ai`, { waitUntil: "networkidle" });
  const form = page.locator('form:has(select[name="defaultProviderId"])');
  await form.locator('[name="defaultProviderId"]').selectOption(providerId ?? "");
  await Promise.all([page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith("/api/ai/settings")), form.getByRole("button", { name: "保存功能设置", exact: true }).click()]);
  const toggle = page.getByRole("switch", { name: "启用 AI", exact: true });
  if ((await toggle.getAttribute("aria-checked") === "true") !== enabled) await Promise.all([page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith("/api/ai/settings")), toggle.click()]);
}

async function configureProvider(page) {
  await page.goto(`${base}/ai`, { waitUntil: "networkidle" });
  const form = page.locator('form:has(input[name="apiKey"])');
  await form.getByRole("button", { name: "使用 DeepSeek" }).click();
  // Only the endpoint and the model change: a local mock stands in for the provider.
  await form.locator('[name="name"]').fill("Recognition mock");
  await form.locator('[name="baseUrl"]').fill(`http://127.0.0.1:${mockPort}/v1`);
  await form.locator('[name="defaultModel"]').fill("mock-model");
  await form.locator('[name="apiKey"]').fill(token);
  await Promise.all([page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/ai"), form.getByRole("button", { name: "添加服务", exact: true }).click()]);
  return (await db.query('SELECT id FROM "AIProvider" WHERE name=$1 ORDER BY "createdAt" DESC LIMIT 1', ["Recognition mock"])).rows[0].id;
}

async function readManual(page) {
  await page.goto(`${base}/protocols/import/recognize`, { waitUntil: "networkidle" });
  await page.getByLabel("或粘贴文字").fill(manual);
  await page.getByRole("button", { name: "读取", exact: true }).click();
  await page.getByText("按写法读取（未用 AI）", { exact: false }).waitFor();
}

let browser, providerId;
try {
  await db.connect();
  await new Promise(resolve => mock.listen(mockPort, "127.0.0.1", resolve));
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([{ name: "labnest_locale", value: "zh", url: base }]);
  const page = await context.newPage();

  await check("without a model the page reads as written, and the gray AI button opens the setup guide instead", async () => {
    await readManual(page);
    const ai = page.getByRole("button", { name: "用 AI 整理" });
    assert.equal(await ai.getAttribute("data-ai-off"), "true");
    await ai.click();
    await page.getByRole("dialog", { name: "AI 还没有开启" }).waitFor();
    await page.getByText("开启 AI 还差", { exact: false }).waitFor();
    assert.equal(completions.length, 0);
    await page.keyboard.press("Escape");
  });

  providerId = await configureProvider(page);
  await setAI(page, providerId, true);

  await check("AI 整理 repairs once and every line is found in the original", async () => {
    await readManual(page);
    await page.getByRole("button", { name: "用 AI 整理" }).click();
    await page.getByText("AI 整理（mock-model，核对后重做了一次）", { exact: false }).waitFor({ timeout: 60_000 });
    await page.getByText("行都在原文中找到出处", { exact: false }).waitFor();
    assert.equal(completions.length, 2);
    assert(JSON.stringify(completions[1]).includes("数值不在原文：750"), "the repair round names the wrong number");
    await page.screenshot({ path: `${evidenceDir}/recognized.png`, fullPage: true });
  });

  await check("存为草稿规程 saves an ai_recognized draft that keeps its source and its check", async () => {
    await Promise.all([page.waitForURL(/\/protocols\/[^/]+\/versions\/[^/]+\/edit$/, { timeout: 60_000 }), page.getByRole("button", { name: "存为草稿规程" }).click()]);
    const versionId = page.url().split("/versions/")[1].split("/")[0];
    const version = (await db.query('SELECT "sourceType", "reviewStage", "contentJson", "stepsJson" FROM "ProtocolVersion" WHERE id=$1', [versionId])).rows[0];
    assert.equal(version.sourceType, "ai_recognized");
    assert.equal(version.reviewStage, "draft");
    assert.equal(version.stepsJson.length, 5);
    assert.deepEqual({ ...version.contentJson.provenance.recognition, recognizedAt: undefined, sourceAttachmentId: undefined }, { model: "mock-model", promptVersion: "habit-v1", unverified: 0, recognizedAt: undefined, sourceAttachmentId: undefined });
    const link = await db.query('SELECT 1 FROM "AttachmentLink" WHERE "targetType"=$1 AND "targetId"=$2 AND "linkType"=$3', ["protocol_version", versionId, "recognition_source"]);
    assert.equal(link.rowCount, 1);
  });
} finally {
  if (providerId && browser) { const page = await (await browser.newContext()).newPage(); await setAI(page, null, false).catch(() => undefined); }
  await browser?.close();
  mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve));
  await db.end();
  await writeFile(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2));
}
