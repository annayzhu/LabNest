/**
 * Browser acceptance for 整理说明书或非模板规程 (AI 识别, template-v1), against an isolated database and a mock model.
 *
 *   DATABASE_URL=postgresql://…/labnest_recognition_20261101 \
 *   LABNEST_E2E_BASE_URL=http://localhost:3006 node scripts/verify-protocol-recognition.mjs
 *
 * The app must run against the same database, with AI switched off; the script adds a local mock service, switches AI
 * on for the run and off again at the end. The mock answers the first pass with an outline that has two systems, so the
 * page asks the author to confirm them; in the second pass the steps first come back with a number the cited line does
 * not hold, so one repair round follows. Nothing is sent outside this computer.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import { chromium } from "playwright";
import pg from "pg";

const database = new URL(process.env.DATABASE_URL ?? "");
assert(["/labnest_recognition_20261101", "/labnest_protocol_ai_extraction_20261009", "/labnest_ai_module_acceptance_20261014", "/labnest_ai_connection_20261014"].includes(database.pathname), "Only an isolated acceptance database is permitted");
assert(["localhost", "127.0.0.1"].includes(database.hostname));
const base = process.env.LABNEST_E2E_BASE_URL ?? "http://localhost:3006";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname) && new URL(base).port !== "3001");
const mockPort = Number(process.env.AI_MOCK_PORT ?? 4849);
const evidenceDir = process.env.AI_EVIDENCE_DIR ?? "docs/modules/ai/copilot-workflow-20261101/evidence-part1-phase1";
await mkdir(evidenceDir, { recursive: true });

/** A made-up kit manual (the same as src/lib/protocol-recognition.test.ts): pasted, it is page 1, lines 1–12. */
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
const systems = ["少于 5×10^6 个细胞", "5×10^6 至 1×10^7 个细胞"];
const outline = { parts: [{ pages: "1", label: "说明书全文", use: "步骤" }], workflows: [], systems: { label: "体系", options: systems }, conflicts: [] };
const answers = {
  front: ["标题：XX 总 RNA 提取试剂盒", "说明：", "体系对应：少于 5×10^6 个细胞用 350 µL，5×10^6 至 1×10^7 个细胞用 600 µL〔p1:6〕", "目的：", "从培养细胞中快速提取高纯度总 RNA。〔p1:2〕", "背景：", "储存：室温保存，有效期 12 个月。〔p1:3〕"],
  material: ["材料：", "- Buffer RL | 350/600 µL | 试剂盒内 35 mL〔p1:4, p1:6〕", "- Buffer RW1 | 700 µL | 试剂盒内 45 mL〔p1:4, p1:9〕", "- RNase-free 水 | 50 µL | 试剂盒内 10 mL〔p1:4, p1:10〕"],
  steps: ["步骤：", `体系：${systems.join(" / ")}〔p1:6〕`, "1. 加入 Buffer RL 350/600 µL，涡旋混匀 15 s。〔p1:6〕", "2. 仅富脂样本：另加 200 µL 氯仿，剧烈振荡 15 s。〔p1:7〕",
    "3. 12,000 ×g 离心 2 min，将上清转移至吸附柱。〔p1:8〕", "4. 加入 700 µL Buffer RW1，12,000 ×g 离心 30 s，弃滤液。〔p1:9〕", "5. 加入 50 µL RNase-free 水，室温静置 1 min，12,000 ×g 离心 1 min 洗脱 RNA。〔p1:10〕"],
  results: ["结果：", "RNA 质检", "记录：RNA 浓度、A260/280〔p1:11〕"],
};

const token = "recognition-fake-token";
const completions = [];
const served = {};
const mock = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const reply = (data, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
  if (req.headers.authorization !== `Bearer ${token}`) return reply({ error: { message: "bad key" } }, 401);
  if (req.url.endsWith("/models")) return reply({ data: [{ id: "mock-model" }] });
  const request = JSON.parse(body);
  completions.push(request);
  const system = request.messages[0].content;
  const key = system.includes("JSON") ? "outline" : system.includes("只写“标题”") ? "front" : system.includes("只写“材料”") ? "material" : system.includes("只写“步骤”") ? "steps" : "results";
  served[key] = (served[key] ?? 0) + 1;
  // The steps first say 750 µL where p1:9 says 700 µL: the check sends them back once.
  const text = key === "outline" ? JSON.stringify(outline) : key === "steps" && served.steps === 1 ? answers.steps.join("\n").replace("700 µL", "750 µL") : answers[key].join("\n");
  return reply({ model: "mock-model", choices: [{ message: { content: text } }] });
});

const db = new pg.Client({ connectionString: database.toString() });
const report = { base, at: new Date().toISOString(), synthetic: true, liveProviders: false, promptVersion: "template-v1", checks: [], failures: [] };
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
  // The form is folded away once any service exists.
  const fold = page.locator("#add-service");
  if (await fold.getAttribute("open") === null) await fold.locator("summary").click();
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
  await page.getByLabel("规程名称（可留空，读取后可改）").fill("细胞总 RNA 提取");
  await page.getByLabel("目标（可留空；与规程名称一起发给模型）").fill("提取培养细胞总 RNA，用于 qPCR");
  await page.getByLabel("或粘贴文字").fill(manual);
  await page.getByRole("button", { name: "读取", exact: true }).click();
  await page.getByText("按写法读取（未用 AI）", { exact: false }).waitFor();
}

let browser, providerId;
try {
  await db.connect();
  const settings = (await db.query('SELECT enabled FROM "AISettings" WHERE id=$1', ["default"])).rows[0];
  assert.equal(settings?.enabled ?? false, false, "AI must be off in the acceptance database before the run");
  await new Promise(resolve => mock.listen(mockPort, "127.0.0.1", resolve));
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.addCookies([{ name: "labnest_locale", value: "zh", url: base }]);
  const page = await context.newPage();

  await check("without a model the page reads as written, and the gray AI button opens the setup guide instead", async () => {
    await readManual(page);
    const ai = page.getByRole("button", { name: "用 AI 整理" });
    assert.equal(await ai.getAttribute("data-ai-off"), "true");
    await ai.click();
    await page.getByRole("dialog", { name: "AI 还没有开启" }).waitFor();
    assert.equal(completions.length, 0);
    await page.keyboard.press("Escape");
  });

  providerId = await configureProvider(page);
  await setAI(page, providerId, true);

  await check("the first pass reads the source with the name and the goal, and asks the author to confirm the systems", async () => {
    await readManual(page);
    assert(await page.getByLabel("中文整理（数值、单位、试剂名、货号照原文）").isChecked());
    await page.getByRole("button", { name: "用 AI 整理" }).click();
    await page.getByRole("heading", { name: "目录与范围" }).waitFor({ timeout: 60_000 });
    assert.equal(completions.length, 1);
    const user = completions[0].messages[1].content;
    assert(user.includes("规程名称：细胞总 RNA 提取") && user.includes("作者的目标：提取培养细胞总 RNA，用于 qPCR"), "the name and the goal go to the model");
    for (const option of systems) assert(await page.getByLabel(option, { exact: true }).isChecked());
    await page.screenshot({ path: `${evidenceDir}/scope.png`, fullPage: true });
  });

  let aiSummary;
  await check("the second pass writes the template with positions, repairs once, and every line is found in the lines it cites", async () => {
    await page.getByRole("button", { name: "按这个范围整理" }).click();
    await page.getByText("行都在所指的原文里找到", { exact: false }).waitFor({ timeout: 120_000 });
    assert.deepEqual(served, { outline: 1, front: 1, material: 1, steps: 2, results: 1 });
    assert(completions.some(request => request.messages[1].content.includes("数值不在指向的原文：750 µL")), "the repair round names the wrong amount");
    assert(completions.slice(1).every(request => request.messages[1].content.includes("[p1:6] 1. 收集细胞")), "each batch reads the numbered source");
    await page.getByLabel("整理稿与原文").getByText("来源：粘贴的文字.txt", { exact: true }).waitFor();
    // The program's own 来源 and 范围 lines also reach the Protocol's description.
    await page.getByLabel("细胞总 RNA 提取").getByText("范围：体系 少于 5×10^6 个细胞 / 5×10^6 至 1×10^7 个细胞；中文整理（数值、单位、试剂名、货号照原文）", { exact: true }).waitFor();
    aiSummary = await page.locator("h2", { hasText: "整理（mock-model）" }).innerText();
    assert.match(aiSummary, /5 步/);
    await page.getByRole("button", { name: "在原文中查看 p1:9" }).first().click();
    await page.locator('[data-at="1:9"][data-focus]').waitFor();
    await page.screenshot({ path: `${evidenceDir}/draft.png`, fullPage: true });
    // On a phone the draft and the original stack, without running off the screen; dark mode keeps the marks readable.
    await page.setViewportSize({ width: 390, height: 844 });
    const fits = await page.locator(".ln-draft").evaluate(element => element.scrollWidth <= element.clientWidth + 1);
    assert(fits, "the draft and the original fit a phone's width");
    await page.locator(".ln-draft").screenshot({ path: `${evidenceDir}/draft-390.png` });
    await page.evaluate(() => { document.documentElement.dataset.labnestMode = "dark"; });
    await page.locator(".ln-draft").screenshot({ path: `${evidenceDir}/draft-390-dark.png` });
    await page.evaluate(() => { document.documentElement.dataset.labnestMode = "light"; });
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  let wordFile;
  await check("下载为 Word 模板 gives the import template without positions", async () => {
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "下载为 Word 模板" }).click()]);
    wordFile = `${evidenceDir}/${download.suggestedFilename()}`;
    await download.saveAs(wordFile);
    assert.equal(download.suggestedFilename(), "PRT-UNASSIGNED_细胞总 RNA 提取_v0.1_Draft.docx");
    const xml = strFromU8(unzipSync(new Uint8Array(await readFile(wordFile)))["word/document.xml"]);
    assert(xml.includes("体系：少于 5×10^6 个细胞 / 5×10^6 至 1×10^7 个细胞") && xml.includes("记录：RNA 浓度、A260/280"));
    assert(!xml.includes("〔p"), "positions stay on the page");
  });

  await check("the 350/600 swap marks both lines that carry it as unverified, and saving is not blocked", async () => {
    await page.getByRole("button", { name: "修改文字" }).click();
    const text = page.locator("textarea").last();
    await text.fill((await text.inputValue()).replaceAll("350/600 µL", "600/350 µL"));
    await page.getByRole("button", { name: "按修改后的文字重新读取" }).click();
    await page.getByText("行中有 2 行在所指的原文里找不到", { exact: false }).waitFor();
    const flagged = page.locator("li[data-unverified]");
    assert.equal(await flagged.count(), 2);
    for (const line of await flagged.allInnerTexts()) assert(line.includes("体系取值顺序与原文不一致：600/350 µL"), line);
    await page.screenshot({ path: `${evidenceDir}/swap.png`, fullPage: true });
    await Promise.all([page.waitForURL(/\/protocols\/[^/]+\/versions\/[^/]+\/edit$/, { timeout: 60_000 }), page.getByRole("button", { name: "存为草稿规程" }).click()]);
    const versionId = page.url().split("/versions/")[1].split("/")[0];
    const version = (await db.query('SELECT "sourceType", "reviewStage", "contentJson", "stepsJson" FROM "ProtocolVersion" WHERE id=$1', [versionId])).rows[0];
    assert.equal(version.sourceType, "ai_recognized");
    assert.equal(version.reviewStage, "draft");
    assert.equal(version.stepsJson.length, 5);
    assert.deepEqual({ ...version.contentJson.provenance.recognition, recognizedAt: undefined, sourceAttachmentId: undefined }, { model: "mock-model", promptVersion: "template-v1", unverified: 2, recognizedAt: undefined, sourceAttachmentId: undefined });
    assert(!JSON.stringify(version.contentJson).includes("〔p"), "positions are not saved into the Protocol");
    const link = await db.query('SELECT 1 FROM "AttachmentLink" WHERE "targetType"=$1 AND "targetId"=$2 AND "linkType"=$3', ["protocol_version", versionId, "recognition_source"]);
    assert.equal(link.rowCount, 1);
  });

  await check("the downloaded Word file, read back without AI, gives the same Protocol", async () => {
    await page.goto(`${base}/protocols/import/recognize`, { waitUntil: "networkidle" });
    await page.locator('input[type="file"][accept=".pdf,.docx,.txt,.md"]').setInputFiles(wordFile);
    await page.getByRole("button", { name: "读取", exact: true }).click();
    const rules = await page.locator("h2", { hasText: "按写法读取（未用 AI）" }).innerText({ timeout: 60_000 });
    assert.equal(rules.replace(/^.*?：/, ""), aiSummary.replace(/^.*?：/, ""));
    assert.equal(served.outline, 1, "reading the Word file sends nothing to the model");
  });
} finally {
  if (providerId && browser) {
    const cleanup = await browser.newContext();
    await cleanup.addCookies([{ name: "labnest_locale", value: "zh", url: base }]);
    await setAI(await cleanup.newPage(), null, false).catch(error => report.failures.push({ name: "switch AI off again", error: String(error) }));
  }
  await browser?.close();
  mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve));
  await db.end();
  await writeFile(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2));
}
