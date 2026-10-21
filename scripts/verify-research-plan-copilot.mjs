/**
 * Browser acceptance for the research plan Copilot, against an isolated database, a mock model that calls tools and a
 * mock Europe PMC.
 *
 *   DATABASE_URL=postgresql://…/labnest_protocol_ai_extraction_20261009 LABNEST_EUROPE_PMC_BASE=http://127.0.0.1:4854 \
 *   LABNEST_E2E_BASE_URL=http://localhost:3339 node scripts/verify-research-plan-copilot.mjs
 *
 * The app must run against the same database with the same LABNEST_EUROPE_PMC_BASE. Nothing leaves the machine.
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
const literature = new URL(process.env.LABNEST_EUROPE_PMC_BASE ?? "");
assert(literature.hostname === "127.0.0.1", "Europe PMC must be the local stand-in");
const mockPort = Number(literature.port);
const evidenceDir = process.env.AI_EVIDENCE_DIR ?? "docs/structured-protocol/20261014-redesign/copilot-evidence";
await mkdir(evidenceDir, { recursive: true });

const token = "copilot-fake-token";
const seen = { model: [], search: [], fullText: [] };
const fullTextXml = `<article><front><article-meta><title-group><article-title>Gene A drives esophageal cancer growth</article-title></title-group></article-meta></front><body>
<sec><title>Introduction</title><p>Background.</p></sec>
<sec><title>Materials and Methods</title><p>Cell viability was measured by CCK-8 assay at 24 h.</p></sec>
<sec><title>Results</title><p>Knockdown of gene A reduced viability.</p></sec></body></article>`;
const searchResults = { resultList: { result: [
  { pmcid: "PMC9000001", isOpenAccess: "Y", title: "Gene A drives esophageal cancer growth", authorString: "Li X, Wang Y.", pubYear: "2021", journalTitle: "Cancer Res", abstractText: "<p>Gene A knockdown reduced growth of ESCC cells.</p>" },
  { pmid: "777", source: "MED", isOpenAccess: "N", title: "Pathway B in ESCC", authorString: "Chen Z.", pubYear: "2019", journalTitle: "Oncogene", abstractText: "We examined pathway B by Western blot analysis of p-AKT." },
] } };

const mock = createServer(async (req, res) => {
  let body = ""; for await (const chunk of req) body += chunk;
  const reply = (data, status = 200, type = "application/json") => { res.writeHead(status, { "content-type": type }); res.end(typeof data === "string" ? data : JSON.stringify(data)); };
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname.includes("/europepmc/webservices/rest/search")) { seen.search.push(decodeURIComponent(url.searchParams.get("query") ?? "")); return reply(searchResults); }
  if (url.pathname.endsWith("/fullTextXML")) { seen.fullText.push(url.pathname); return reply(fullTextXml, 200, "application/xml"); }
  if (req.headers.authorization !== `Bearer ${token}`) return reply({ error: { message: "bad key" } }, 401);
  if (url.pathname.endsWith("/models")) return reply({ data: [{ id: "mock-tools" }] });
  const request = JSON.parse(body);
  const names = (request.tools ?? []).map(tool => tool.function.name);
  const last = request.messages.at(-1);
  const text = content => reply({ model: "mock-tools", choices: [{ message: { content } }] });
  const call = (name, args) => reply({ model: "mock-tools", choices: [{ message: { content: null, tool_calls: [{ id: `call-${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] } }] });
  seen.model.push(names.join(",") || (last.content ?? "").slice(0, 20));
  if (names.includes("read_plan_context")) return last.role === "user" ? call("read_plan_context", {}) : text(JSON.stringify({ subQuestions: [
    { id: "q1", question: "A 基因是否促进食管癌细胞增殖", why: "CCK-8 增殖是否下降", keywords: ["gene A", "proliferation"] },
    { id: "q2", question: "A 基因通过哪条通路起作用", why: "磷酸化蛋白是否变化", keywords: ["gene A", "AKT"] }] }));
  if (names.includes("search_papers")) return last.role === "user" ? call("search_papers", { query: "gene A proliferation esophageal" }) : text(JSON.stringify({ selected: [{ ref: "r1", why: "同一问题的原始研究", subQuestionIds: ["q1"] }, { ref: "r2", why: "通路", subQuestionIds: ["q2"] }] }));
  const user = String(last.content);
  if (user.includes("论文：Gene A")) return text(JSON.stringify({ experiments: [{ name: "CCK-8 增殖实验", subQuestionIds: ["q1"], approach: "CCK-8", purpose: "看敲低后增殖是否下降", readouts: ["OD450"], controls: ["si-NC"], sample: "KYSE150", quote: "Cell viability was measured by CCK-8 assay" }] }));
  if (user.includes("论文：Pathway B")) return text(JSON.stringify({ experiments: [{ name: "Western 检测 p-AKT", subQuestionIds: ["q2"], approach: "Western blot", quote: "We examined pathway B by Western blot" }] }));
  if (user.includes("文献里做过的实验")) return text(JSON.stringify({ summary: "先验证增殖表型，再检测通路。", gaps: ["动物模型要自己决定"], items: [
    { subQuestionId: "q1", experiments: [{ name: "CCK-8 增殖实验", purpose: "看敲低后增殖是否下降", approach: "CCK-8", readouts: ["OD450"], controls: ["si-NC"], priority: "must", evidence: ["PMC9000001"] }] },
    { subQuestionId: "q2", experiments: [{ name: "Western 检测 p-AKT", approach: "Western blot", priority: "must", evidence: ["MED:777"], note: "抗体要验证" }] }] }));
  return text("{}");
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
  await new Promise(resolve => mock.listen(mockPort, "127.0.0.1", resolve));
  await db.query(`INSERT INTO "Project" (id, name, status, "updatedAt") VALUES ('copilot-test-project', 'Copilot 测试项目', 'active', now()) ON CONFLICT (id) DO NOTHING`);
  await db.query(`INSERT INTO "ResearchPlan" (id, "projectId", code, title, status, "updatedAt") VALUES ('copilot-test-plan', 'copilot-test-project', 'RP-COPILOT-1', 'A 基因在食管癌中的作用（Copilot 测试）', 'draft', now()) ON CONFLICT (id) DO NOTHING`);
  // A plan with nothing written and no runs: the state the first check expects, every time.
  await db.query(`DELETE FROM "ResearchPlanCopilotRun" WHERE "researchPlanId" = 'copilot-test-plan'`);
  await db.query(`DELETE FROM "Experiment" WHERE "researchPlanId" = 'copilot-test-plan'`);
  await db.query(`DELETE FROM "ActivityLog" WHERE "targetId" = 'copilot-test-plan' AND action LIKE 'copilot_%'`);
  await db.query(`UPDATE "ResearchPlan" SET "contentJson" = '{}', objective = NULL, hypothesis = NULL, design = NULL WHERE id = 'copilot-test-plan'`);
  await db.query(`INSERT INTO "MethodSearchSettings" (id, enabled, "sourcesJson", "updatedAt") VALUES ('default', true, '["local","europe_pmc"]', now()) ON CONFLICT (id) DO UPDATE SET enabled = true, "sourcesJson" = '["local","europe_pmc"]'`);
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
  await context.addCookies([{ name: "labnest_locale", value: "zh", url: base }]);
  const page = await context.newPage();

  // AI: a mock service as the default.
  await page.goto(`${base}/ai`, { waitUntil: "networkidle" });
  const form = page.locator('form:has(input[name="apiKey"])');
  await form.getByRole("button", { name: "使用 DeepSeek" }).click();
  await form.locator('[name="name"]').fill("Copilot mock");
  await form.locator('[name="baseUrl"]').fill(`http://127.0.0.1:${mockPort}/v1`);
  await form.locator('[name="defaultModel"]').fill("mock-tools");
  await form.locator('[name="apiKey"]').fill(token);
  await Promise.all([page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/ai"), form.getByRole("button", { name: "添加服务", exact: true }).click()]);
  const providerId = (await db.query('SELECT id FROM "AIProvider" WHERE name=$1 ORDER BY "createdAt" DESC LIMIT 1', ["Copilot mock"])).rows[0].id;
  await page.goto(`${base}/ai`, { waitUntil: "networkidle" });
  await page.locator('form:has(select[name="defaultProviderId"]) [name="defaultProviderId"]').selectOption(providerId);
  await Promise.all([page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith("/api/ai/settings")), page.locator('form:has(select[name="defaultProviderId"])').getByRole("button", { name: "保存功能设置", exact: true }).click()]);
  const toggle = page.getByRole("switch", { name: "启用 AI", exact: true });
  if (await toggle.getAttribute("aria-checked") !== "true") await Promise.all([page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith("/api/ai/settings")), toggle.click()]);

  await check("an empty plan opens the Copilot, and Start needs only the purpose", async () => {
    await page.goto(`${base}/research-plans/copilot-test-plan`, { waitUntil: "networkidle" });
    await page.getByText("本方案的 Copilot").waitFor();
    const start = page.getByRole("button", { name: "开始", exact: true });
    assert(await start.isDisabled());
    await page.getByLabel("研究目的").first().fill("证明敲低 A 基因能抑制食管鳞癌细胞生长，并找出它通过哪条通路起作用");
    assert(!(await start.isDisabled()));
    assert.equal(await page.locator(".ln-copilot-form input[type=checkbox]:visible").count(), 0, "the form shows one question; the rest waits under More settings");
    await page.screenshot({ path: `${evidenceDir}/copilot-start.png`, fullPage: true });
  });

  await check("a run goes through the five stages, the agent calls its tools, and every stage leaves its result", async () => {
    await page.getByRole("button", { name: "开始", exact: true }).click();
    await page.getByText("你采纳之前，不会往方案里写任何东西。").waitFor({ timeout: 120_000 });
    assert.equal(await page.locator(".ln-copilot-stages li[data-state=done]").count(), 5);
    assert(seen.search.length >= 1 && seen.fullText.length === 1, `one search and one full text: ${seen.search.length} / ${seen.fullText.length}`);
    assert(seen.model.includes("read_plan_context") && seen.model.includes("search_papers"), "the model was offered its tools");
    await page.getByText("运行记录").click();
    await page.getByText(/search_papers\(/).first().waitFor();
    const row = (await db.query(`SELECT status, stage, "modelCalls", model, provider, "suggestionsJson", "stateJson" FROM "ResearchPlanCopilotRun" WHERE "researchPlanId" = 'copilot-test-plan' ORDER BY "createdAt" DESC LIMIT 1`)).rows[0];
    assert.equal(row.status, "done");
    assert.equal(row.provider, "Copilot mock");
    assert(row.modelCalls >= 6, `model calls: ${row.modelCalls}`);
    assert.deepEqual(row.stateJson.papers.map(paper => [paper.key, paper.basis]), [["PMC9000001", "fulltext"], ["MED:777", "abstract"]]);
    assert.deepEqual(row.suggestionsJson.map(item => item.kind), ["design", "references", "experiment", "experiment"]);
    const design = row.stateJson.design.items.flatMap(item => item.experiments);
    assert.deepEqual(design.map(item => [item.name, item.verified]), [["CCK-8 增殖实验", true], ["Western 检测 p-AKT", false]]);
    await page.screenshot({ path: `${evidenceDir}/copilot-done.png`, fullPage: true });
    const plan = (await db.query(`SELECT "contentJson" FROM "ResearchPlan" WHERE id = 'copilot-test-plan'`)).rows[0];
    assert(!JSON.stringify(plan.contentJson).includes("Copilot"), "nothing is written into the plan before adoption");
  });

  await check("adopting writes the design and the references into the plan and creates a planned experiment; ignoring writes nothing", async () => {
    const cards = page.locator(".ln-copilot-suggestions li");
    await cards.nth(0).getByRole("button", { name: "采纳" }).click();
    await cards.nth(0).getByText("已采用").waitFor();
    await cards.nth(1).getByRole("button", { name: "采纳" }).click();
    await cards.nth(1).getByText("已采用").waitFor();
    await cards.nth(2).getByRole("button", { name: "采纳" }).click();
    await cards.nth(2).getByText("已采用").waitFor();
    await cards.nth(3).getByRole("button", { name: "忽略" }).click();
    await cards.nth(3).getByText("已忽略").waitFor();
    const plan = JSON.stringify((await db.query(`SELECT "contentJson" FROM "ResearchPlan" WHERE id = 'copilot-test-plan'`)).rows[0].contentJson);
    assert(plan.includes("【必做】CCK-8 增殖实验"), "the design was written");
    assert(plan.includes("（未核实：依据只来自摘要，请核对原文）"), "the unverified mark came along");
    assert(plan.includes("PMC9000001"), "the references were written");
    const experiments = (await db.query(`SELECT title, status, "researchPlanId", "projectId" FROM "Experiment" WHERE "researchPlanId" = 'copilot-test-plan'`)).rows;
    assert.deepEqual(experiments, [{ title: "CCK-8 增殖实验", status: "planned", researchPlanId: "copilot-test-plan", projectId: "copilot-test-project" }]);
    const logs = await db.query(`SELECT action FROM "ActivityLog" WHERE "targetId" = 'copilot-test-plan' AND action LIKE 'copilot_suggestion_%' ORDER BY "createdAt"`);
    assert.deepEqual(logs.rows.map(item => item.action), ["copilot_suggestion_adopted", "copilot_suggestion_adopted", "copilot_suggestion_adopted", "copilot_suggestion_ignored"]);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("本方案的 Copilot").waitFor();
    assert.equal(await page.locator('.ln-copilot-suggestions li[data-status="adopted"]').count(), 3, "the run and its decisions survive a reload");
    await page.screenshot({ path: `${evidenceDir}/copilot-adopted.png`, fullPage: true });
  });

  await check("a run can stop after each stage and go on from the next", async () => {
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "删除这次运行" }).click();
    await page.getByLabel("要调整或核查什么？").first().waitFor();
    await page.getByLabel("要调整或核查什么？").first().fill("比较两种转染试剂在 KYSE150 细胞中的效率");
    await page.getByText("更多设置").click();
    await page.getByLabel("每个阶段结束后先停下来让我看").check();
    await page.getByRole("button", { name: "开始", exact: true }).click();
    await page.getByRole("button", { name: "继续下一阶段" }).waitFor({ timeout: 60_000 });
    assert.equal(await page.locator(".ln-copilot-stages li[data-state=done]").count(), 1);
    await page.getByText("科学问题（2）").waitFor();
    await page.getByRole("button", { name: "继续下一阶段" }).click();
    await page.waitForFunction(() => document.querySelectorAll(".ln-copilot-stages li[data-state=done]").length === 2, null, { timeout: 60_000 });
    await page.getByRole("button", { name: "继续下一阶段" }).waitFor({ timeout: 60_000 });
    await page.getByText("论文（2）").waitFor();
  });
  await check("the overview makes a new plan from a purpose, and the run goes on in the plan", async () => {
    await db.query(`DELETE FROM "ActivityLog" WHERE "targetId" IN (SELECT id FROM "ResearchPlan" WHERE title LIKE '比较两种%' AND id <> 'copilot-test-plan')`);
    await db.query(`DELETE FROM "ResearchPlan" WHERE title LIKE '验证 B 基因%' AND id <> 'copilot-test-plan'`);
    await page.goto(`${base}/research-plans?copilot=1`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "设计新方案" }).waitFor();
    await page.getByLabel("研究目的").fill("验证 B 基因敲低是否降低 KYSE150 细胞的迁移能力。再看它是否经过 AKT 通路");
    await page.getByLabel("所在项目").selectOption("copilot-test-project");
    await page.screenshot({ path: `${evidenceDir}/copilot-overview.png`, fullPage: true });
    await page.getByRole("button", { name: "开始", exact: true }).click();
    await page.waitForURL(/\/research-plans\/(?!copilot-test-plan)[^/?]+/, { timeout: 30_000 });
    await page.getByText("你采纳之前，不会往方案里写任何东西。").waitFor({ timeout: 120_000 });
    assert(!page.url().includes("autostart"), "the link's mark is dropped once the run has started");
    const plan = (await db.query(`SELECT p.id, p.code, p.title, p.status, p.objective, r.status AS run, r."inputsJson" FROM "ResearchPlan" p JOIN "ResearchPlanCopilotRun" r ON r."researchPlanId" = p.id WHERE p.title LIKE '验证 B 基因%'`)).rows;
    assert.equal(plan.length, 1);
    assert.deepEqual([plan[0].title, plan[0].status, plan[0].run, plan[0].inputsJson.mode], ["验证 B 基因敲低是否降低 KYSE150 细胞的迁移能力", "draft", "done", "new"]);
    assert(/^RP-/.test(plan[0].code) && plan[0].objective.startsWith("验证 B 基因"));
    // Adopting an abstract-only experiment must keep its uncertainty and source even after deleting the run.
    await page.locator('.ln-copilot-suggestions li').nth(3).getByRole('button', { name: '采纳' }).click();
    await page.locator('.ln-copilot-suggestions li').nth(3).getByText('已采用').waitFor();
    const savedPurpose = (await db.query('SELECT purpose FROM "Experiment" WHERE "researchPlanId"=$1', [plan[0].id])).rows[0].purpose;
    assert(savedPurpose.includes('未核实') && savedPurpose.includes('MED:777') && savedPurpose.includes('科学问题'));
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '删除这次运行' }).click();
    await page.getByLabel('要调整或核查什么？').first().waitFor();
    assert.equal((await db.query('SELECT purpose FROM "Experiment" WHERE "researchPlanId"=$1', [plan[0].id])).rows[0].purpose, savedPurpose);

  });

  await check("the overview adjusts an existing plan: the run is marked as an adjustment and starts on that plan", async () => {
    await page.goto(`${base}/research-plans?copilot=1`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "调整已有方案" }).click();
    await page.getByLabel("要调整的方案").selectOption("copilot-test-plan");
    await page.getByLabel("要调整或核查什么？").fill("方案只写了增殖，补上证明通路所需的实验");
    await page.getByText("更多设置").click();
    await page.getByLabel("每个阶段结束后先停下来让我看").check();
    await page.getByRole("button", { name: "开始", exact: true }).click();
    await page.waitForURL(/\/research-plans\/copilot-test-plan/, { timeout: 30_000 });
    await page.getByRole("button", { name: "继续下一阶段" }).waitFor({ timeout: 60_000 });
    const run = (await db.query(`SELECT "inputsJson", purpose FROM "ResearchPlanCopilotRun" WHERE "researchPlanId" = 'copilot-test-plan' ORDER BY "createdAt" DESC LIMIT 1`)).rows[0];
    assert.equal(run.inputsJson.mode, "adjust");
    assert(run.purpose.startsWith("方案只写了增殖"));
    await page.screenshot({ path: `${evidenceDir}/copilot-adjust.png`, fullPage: true });
  });
} finally {
  await db.query(`UPDATE "AISettings" SET enabled = false WHERE id = 'default'`).catch(() => undefined);
  await db.query(`UPDATE "MethodSearchSettings" SET enabled = false WHERE id = 'default'`).catch(() => undefined);
  await browser?.close();
  mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve));
  await db.end();
  await writeFile(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2));
}
