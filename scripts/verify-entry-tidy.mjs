/**
 * Browser acceptance for 整理 on quick records and the adoption numbers (Q333–Q340), against the isolated design
 * database and one local mock model.
 *
 *   DATABASE_URL=postgresql://…/labnest_design_20261102 \
 *   LABNEST_E2E_BASE_URL=http://localhost:3002 node scripts/verify-entry-tidy.mjs
 *
 * The app must run against the same database with AI switched off; the script adds a local service, switches AI on for
 * the run and off again at the end. It saves a dictated record naming an experiment, tidies it, sees the number the
 * model added flagged, fixes it, files the record under the experiment and adopts the draft; then tidies again and
 * sets the draft aside with a reason. Nothing leaves this computer.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import pg from "pg";

const database = new URL(process.env.DATABASE_URL ?? "");
assert.equal(database.pathname, "/labnest_design_20261102", "Only the isolated design acceptance database is permitted");
assert(["localhost", "127.0.0.1"].includes(database.hostname));
const base = process.env.LABNEST_E2E_BASE_URL ?? "http://localhost:3002";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname) && new URL(base).port !== "3001");
const mockPort = Number(process.env.AI_MOCK_PORT ?? 4852);
const evidenceDir = process.env.AI_EVIDENCE_DIR ?? "docs/modules/ai/copilot-four-modules-20261101/evidence-harness";
await mkdir(evidenceDir, { recursive: true });

const token = "tidy-fake-token";
const calls = [];
let experiment;
// The model tidies the words, and adds one number they do not have (15 min) for the program to catch.
const mock = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const reply = (data, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
  if (req.headers.authorization !== `Bearer ${token}`) return reply({ error: { message: "bad key" } }, 401);
  if (req.url.endsWith("/models")) return reply({ data: [{ id: "mock-tidy" }] });
  const request = JSON.parse(body);
  calls.push({ tidy: request.messages[0].content.includes("整理一条实验室快速记录"), json: request.response_format?.type });
  const answer = { title: "KYSE150 转染 si-SRGN", done: ["上午 10 点换液后转染两条 si-SRGN（24 孔板）", "离心 15 分钟"], seen: ["下午细胞状态还行"], values: ["si-SRGN 50 nM"], next: ["48 h 收 RNA 做 qPCR"], unclear: ["每孔加了多少转染试剂没说"], experiment: experiment.runCode };
  return reply({ model: request.model, choices: [{ message: { content: JSON.stringify(answer) } }] });
});

const db = new pg.Client({ connectionString: database.toString() });
const report = { base, at: new Date().toISOString(), synthetic: true, liveProviders: false, spec: "entry.tidy@1", checks: [], failures: [], calls };
async function check(name, run) {
  try { await run(); report.checks.push({ name, status: "passed" }); console.log("PASS", name); }
  catch (error) { report.failures.push({ name, error: String(error) }); throw error; }
  finally { await writeFile(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2)); }
}

async function addProvider(page, name, model) {
  await page.goto(`${base}/ai`, { waitUntil: "networkidle" });
  const fold = page.locator("#add-service");
  if (await fold.count() && await fold.getAttribute("open") === null) await fold.locator("summary").click();
  const form = page.locator('form:has(input[name="apiKey"])');
  await form.getByRole("button", { name: "使用 DeepSeek" }).click();
  await form.locator('[name="name"]').fill(name);
  await form.locator('[name="baseUrl"]').fill(`http://127.0.0.1:${mockPort}/v1`);
  await form.locator('[name="defaultModel"]').fill(model);
  await form.locator('[name="apiKey"]').fill(token);
  await Promise.all([page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/ai"), form.getByRole("button", { name: "添加服务", exact: true }).click()]);
  return (await db.query('SELECT id FROM "AIProvider" WHERE name=$1 ORDER BY "createdAt" DESC LIMIT 1', [name])).rows[0].id;
}

async function setAI(page, { provider, enabled }) {
  await page.goto(`${base}/ai`, { waitUntil: "networkidle" });
  const form = page.locator('form:has(select[name="defaultProviderId"])');
  await form.locator('[name="defaultProviderId"]').selectOption(provider ?? "");
  await Promise.all([page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith("/api/ai/settings")), form.getByRole("button", { name: "保存功能设置", exact: true }).click()]);
  const toggle = page.getByRole("switch", { name: "启用 AI", exact: true });
  if ((await toggle.getAttribute("aria-checked") === "true") !== enabled) await Promise.all([page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith("/api/ai/settings")), toggle.click()]);
}

const noScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const suggestions = entryId => db.query('SELECT kind, subject, status, "editedFields", "ignoreReason", "specId", "specVersion", "beforeJson" FROM "CopilotSuggestion" WHERE "targetType"=$1 AND "targetId"=$2 ORDER BY "createdAt", kind DESC', ["entry", entryId]).then(result => result.rows);

let browser, provider, entryId;
try {
  await db.connect();
  const settings = (await db.query('SELECT enabled FROM "AISettings" WHERE id=$1', ["default"])).rows[0];
  assert.equal(settings?.enabled ?? false, false, "AI must be off in the acceptance database before the run");
  experiment = (await db.query(`SELECT e.id, e."runCode", e.title FROM "Experiment" e WHERE e.status <> 'archived' AND e."recordStatus" NOT IN ('submitted','reviewed')
    AND NOT EXISTS (SELECT 1 FROM "DeletedRecord" d WHERE d."targetType"='experiment' AND d."targetId"=e.id AND d."restoredAt" IS NULL) ORDER BY e."createdAt" DESC LIMIT 1`)).rows[0];
  assert(experiment, "an open experiment to file the record under");
  await new Promise(resolve => mock.listen(mockPort, "127.0.0.1", resolve));
  browser = await chromium.launch();
  const browserContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await browserContext.addCookies([{ name: "labnest_locale", value: "zh", url: base }]);
  const page = await browserContext.newPage();
  page.setDefaultTimeout(30_000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const words = `今天上午十点给KYSE150换液然后转染si-SRGN两条，浓度五十纳摩尔，那个24孔板，下午看了一下细胞状态还行，明天四十八小时收RNA做qPCR，记到${experiment.runCode}`;

  await check("a dictated record is saved as written, and the record page offers 整理 instead of the old AI suggestions", async () => {
    provider = await addProvider(page, "Tidy mock", "mock-tidy");
    await setAI(page, { provider, enabled: true });
    await page.goto(`${base}/entries`, { waitUntil: "networkidle" });
    entryId = await page.evaluate(async ({ words }) => {
      const form = new FormData();
      form.set("title", "口述速记"); form.set("contentMarkdown", words);
      const response = await fetch("/api/entries", { method: "POST", body: form });
      return (await response.json()).entryId;
    }, { words });
    assert(entryId, "the record was saved");
    await page.goto(`${base}/entries/${entryId}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "整理", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Propose with AI" }).count(), 0);
    assert.equal(calls.length, 0, "opening the record calls no model");
  });

  await check("整理 shows the draft, flags the number the words do not have, and offers the experiment the words name", async () => {
    await page.getByRole("button", { name: "整理", exact: true }).click();
    const panel = page.locator("#entry-tidy");
    await panel.getByRole("heading", { name: "整理稿" }).waitFor();
    await panel.getByText("原话里没有：15。采用前请核对。").waitFor();
    await panel.getByText(`原话提到了 ${experiment.runCode} ${experiment.title}。把这条记录归入它吗？`).waitFor();
    assert((await panel.getByLabel("正文").inputValue()).includes("**做了什么**"));
    assert.deepEqual(calls.map(call => [call.tidy, call.json]), [[true, "json_object"]], "one call, in JSON mode");
    const rows = await suggestions(entryId);
    assert.deepEqual(rows.map(row => [row.kind, row.status]), [["entry_tidy", "pending"], ["entry_assign", "pending"]]);
    assert.equal(rows[0].beforeJson.markdown, words, "the words as they were are kept with the draft");
    await page.screenshot({ path: `${evidenceDir}/1-draft.png`, fullPage: true });
  });

  await check("filing the record and fixing the draft, then 采用: the text is replaced and the original words stay folded", async () => {
    const panel = page.locator("#entry-tidy");
    await panel.getByRole("button", { name: "归入", exact: true }).click();
    await panel.getByText(`已归入 ${experiment.runCode} ${experiment.title}。`).waitFor();
    const text = panel.getByLabel("正文");
    await text.fill((await text.inputValue()).replace("\n- 离心 15 分钟", ""));
    await panel.getByLabel("标题").fill("KYSE150 转染 si-SRGN（口述）");
    await panel.getByRole("button", { name: "采用", exact: true }).click();
    await page.getByText("已采用。原来的文字保留在“原话”里。").waitFor();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "KYSE150 转染 si-SRGN（口述）", level: 1 }).first().waitFor();
    await page.getByText("上午 10 点换液后转染两条 si-SRGN（24 孔板）").first().waitFor();
    assert.equal(await page.getByText("离心 15 分钟").count(), 0);
    await page.getByText("原话", { exact: true }).click();
    await page.getByText(words).waitFor();
    const rows = await suggestions(entryId);
    assert.deepEqual(rows.map(row => [row.kind, row.status, row.editedFields]), [["entry_tidy", "adopted", ["markdown", "title"]], ["entry_assign", "adopted", []]]);
    const link = (await db.query(`SELECT "targetId" FROM "ItemLink" WHERE "sourceType"='entry' AND "sourceId"=$1 AND "linkType"='entry_primary'`, [entryId])).rows[0];
    assert.equal(link?.targetId, experiment.id, "filed under the experiment the words named");
    await page.screenshot({ path: `${evidenceDir}/2-adopted.png`, fullPage: true });
  });

  await check("a second draft set aside with a reason leaves the record unchanged", async () => {
    await page.getByRole("button", { name: "整理", exact: true }).click();
    const panel = page.locator("#entry-tidy");
    await panel.getByRole("heading", { name: "整理稿" }).waitFor();
    assert.equal(await panel.getByText("把这条记录归入它吗？", { exact: false }).count(), 0, "a filed record gets no filing suggestion");
    await panel.getByRole("button", { name: "不采用" }).click();
    await panel.getByRole("button", { name: "写法不好" }).click();
    await page.getByText("已放弃整理稿，记录没有改变。").waitFor();
    const rows = await suggestions(entryId);
    assert.deepEqual(rows.at(-1) && [rows.at(-1).status, rows.at(-1).ignoreReason], ["ignored", "poor_wording"]);
    await page.getByRole("heading", { name: "KYSE150 转染 si-SRGN（口述）", level: 1 }).first().waitFor();
  });

  await check("the AI page counts what happened, per service and per step", async () => {
    await page.goto(`${base}/ai`, { waitUntil: "networkidle" });
    await page.locator(`[data-provider-row="${provider}"] [data-adoption]`).getByText("Copilot 最近 30 天：采纳 2/3（67%）", { exact: false }).waitFor();
    await page.locator(`[data-provider-row="${provider}"] [data-adoption]`).getByText("未采用：写法不好 1", { exact: false }).waitFor();
    await page.getByText("Copilot 各步骤的建议（最近 30 天）").click();
    await page.locator('[data-adoption-spec="entry.tidy@1"]').getByText("快速记录 · 整理快速记录 · 第 1 版").waitFor();
    await page.screenshot({ path: `${evidenceDir}/3-ai-page.png`, fullPage: true });
  });

  await check("the draft fits a phone", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    // A dev server may abort a load while it recompiles; one more try tells that apart from a real failure.
    await page.goto(`${base}/entries/${entryId}`, { waitUntil: "networkidle" }).catch(() => page.goto(`${base}/entries/${entryId}`, { waitUntil: "networkidle" }));
    // The dev server's own badge sits over the sheet's bottom-left corner; a built app has none.
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    // On a phone the header's actions are in the page actions sheet, 整理 among them.
    await page.getByRole("button", { name: "页面操作" }).click();
    // The sheet slides up; a tap during the slide presses one button and releases on another.
    await page.waitForFunction(() => ["none", "matrix(1, 0, 0, 1, 0, 0)"].includes(getComputedStyle(document.querySelector(".ln-modal-sheet")).transform));
    // Until the page has read the AI settings, an AI button opens the setup guide instead.
    await page.locator("button:not([data-ai-off])", { hasText: /^整理$/ }).click();
    await page.locator("#entry-tidy").getByRole("heading", { name: "整理稿" }).waitFor();
    assert(await noScroll(page), "no horizontal scroll at 390 px");
    await page.screenshot({ path: `${evidenceDir}/4-draft-390.png`, fullPage: true });
    assert.deepEqual(errors, []);
  });
} finally {
  if (provider && browser) {
    const cleanup = await browser.newContext();
    await cleanup.addCookies([{ name: "labnest_locale", value: "zh", url: base }]);
    await setAI(await cleanup.newPage(), { provider: null, enabled: false }).catch(error => report.failures.push({ name: "switch AI off again", error: String(error) }));
  }
  await browser?.close();
  mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve));
  await db.end();
  await writeFile(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2));
}
