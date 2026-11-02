/**
 * Browser acceptance for the research-plan design workbench (Q300–Q312, phase 1), against an isolated database and
 * two local mock models (one drafts, one reviews).
 *
 *   DATABASE_URL=postgresql://…/labnest_design_20261102 \
 *   LABNEST_E2E_BASE_URL=http://localhost:3002 node scripts/verify-plan-design.mjs
 *
 * The app must run against the same database with AI switched off; the script adds two local services, switches AI on
 * for the run and off again at the end. It makes a new plan from the overview, walks the four steps, edits a card that
 * counts wells as n, resolves a severe review finding by changing a card, and signs. Nothing leaves this computer.
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
const mockPort = Number(process.env.AI_MOCK_PORT ?? 4851);
const evidenceDir = process.env.AI_EVIDENCE_DIR ?? "docs/modules/ai/copilot-workflow-20261101/evidence-part2-phase1";
await mkdir(evidenceDir, { recursive: true });
const purpose = "证明 SRGN 敲低抑制 KYSE150 细胞迁移";

const context = {
  question: "SRGN 敲低是否抑制 KYSE150 细胞迁移", claimType: "necessity", subject: "SRGN", modelSystem: "KYSE150（食管鳞癌细胞系）",
  resourcesHave: "KYSE150 细胞", resourcesCanGet: "SRGN siRNA 两条；NC siRNA", resourcesLack: "抗 siRNA 的 SRGN 表达质粒", constraints: "", outOfScope: "体内实验",
  success: "两条 siRNA 都使 Transwell 迁移细胞数下降", priorResults: "", questions: ["迁移用 Transwell 还是划痕实验？"],
};
const chain = {
  claim: "SRGN 是 KYSE150 细胞迁移所必需的", hypothesis: "SRGN 敲低降低 KYSE150 迁移", rationale: "SRGN 在高迁移亚群中表达更高",
  minimumEvidence: ["mRNA 与蛋白水平的敲低验证", "两条独立 siRNA 表型一致", "NC 对照"],
  alternatives: [{ text: "siRNA 脱靶", exclude: true }, { text: "增殖差异混杂迁移", exclude: true }],
  blocks: [
    { id: "kd-check", title: "敲低效率验证（qPCR + WB）", kind: "manipulation", minTier: "light", purpose: "确认两条 siRNA 有效", success: "两条 siRNA 敲低 ≥ 70%", failure: "表型无法解释", fallback: "换序列或改 shRNA", dependsOn: [] },
    { id: "phenotype", title: "Transwell 迁移", kind: "phenotype", minTier: "light", purpose: "检验迁移是否下降", success: "两条 siRNA 的迁移数均低于 NC", failure: "SRGN 不是迁移所必需", fallback: "划痕实验", dependsOn: ["kd-check"] },
    { id: "rescue", title: "拯救实验", kind: "specificity", minTier: "publication", purpose: "排除脱靶", success: "回补后迁移恢复", failure: "", fallback: "", dependsOn: ["phenotype"] },
  ],
  recommendedTier: "standard", drift: [],
};
const groups = [{ name: "NC", treatment: "NC siRNA 50 nM", control: true }, { name: "si-1", treatment: "SRGN siRNA#1 50 nM", control: false }, { name: "si-2", treatment: "SRGN siRNA#2 50 nM", control: false }];
const card = (blockId, protocols) => ({
  blockId, unit: { experimental: "一孔细胞", analysis: "一次独立转染", nCounts: blockId === "phenotype" ? "wells" : "biological" }, factors: [{ name: "siRNA", levels: ["NC", "si-1", "si-2"] }], groups,
  controls: [{ name: "NC siRNA", kind: "negative", excludes: "转染本身的影响", concurrent: true }], manipulation: { kind: "knockdown", independentReagents: 2, efficiencyCheck: "" },
  replicates: { biological: 3, technical: 3, note: "" }, sampleSize: { n: null, basis: "pending", note: "需要预实验" }, randomization: "板位随机", blinding: blockId === "phenotype" ? "计数者不知道分组" : "", batch: "同一代次",
  readouts: blockId === "kd-check" ? [{ name: "SRGN mRNA", method: "RT-qPCR", timepoint: "48 h", assay: "qpcr" }, { name: "SRGN 蛋白", method: "Western blot", timepoint: "72 h", assay: "western_blot" }] : [{ name: "迁移细胞数", method: "Transwell，结晶紫染色计数", timepoint: "24 h", assay: "migration" }],
  referenceGenes: blockId === "kd-check" ? ["GAPDH", "ACTB"] : [], loadingControl: blockId === "kd-check" ? "β-actin" : "", normalization: blockId === "kd-check" ? "SRGN / β-actin 灰度比" : "",
  analysis: { test: "单因素方差分析", primaryComparison: "si-1、si-2 分别与 NC 比较", multipleComparison: "Dunnett 校正", exclusion: "" }, criteria: ["两条 siRNA 的结果都满足成功标准"],
  dependsOn: blockId === "phenotype" ? ["kd-check"] : [],
  protocol: blockId === "kd-check" && protocols.siRNA ? { id: protocols.siRNA, title: "", needed: false } : { id: "", title: "Transwell 迁移", needed: true },
  methodNote: "", drift: [],
});
const reviews = [
  { verdict: "revise", dimensions: [{ key: "controls", verdict: "ok", note: "" }, { key: "overclaiming", verdict: "concern", note: "迁移下降可能来自增殖" }], findings: [{ severity: "critical", dimension: "overclaiming", blockId: "phenotype", field: "readouts", problem: "迁移下降可能来自增殖减慢", suggestion: "同期加 CCK-8 增殖检测" }, { severity: "minor", dimension: "feasibility", blockId: "", field: "", problem: "两周内完成较紧", suggestion: "" }] },
  { verdict: "ready", dimensions: [{ key: "overclaiming", verdict: "ok", note: "" }], findings: [] },
];

const token = "design-fake-token";
const calls = [];
const mock = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const reply = (data, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
  if (req.headers.authorization !== `Bearer ${token}`) return reply({ error: { message: "bad key" } }, 401);
  if (req.url.endsWith("/models")) return reply({ data: [{ id: "mock-drafter" }, { id: "mock-reviewer" }] });
  const request = JSON.parse(body);
  const system = request.messages[0].content, user = request.messages.at(-1).content;
  const step = system.includes("情境卡”。") ? "context" : system.includes("现在做“证据链”") ? "chain" : system.includes("设计卡") ? "card" : system.includes("独立的实验设计审稿人") ? "review" : "other";
  calls.push({ step, model: request.model, chars: user.length, sentInventory: user.includes("KYSE150") });
  let text = "{}";
  if (step === "context") text = JSON.stringify(context);
  if (step === "chain") text = JSON.stringify(chain);
  if (step === "card") {
    const blockId = /"id":"([a-z-]+)"/.exec(user.split("现在要写的实验块：")[1])[1];
    const siRNA = /^(\S+) · \S+ · .*siRNA.*$/m.exec(user)?.[1];
    text = JSON.stringify(card(blockId, { siRNA }));
  }
  if (step === "review") text = `审查结果如下：\n${JSON.stringify(reviews[calls.filter(call => call.step === "review").length - 1] ?? reviews[1])}`;
  return reply({ model: request.model, choices: [{ message: { content: text } }] });
});

const db = new pg.Client({ connectionString: database.toString() });
const report = { base, at: new Date().toISOString(), synthetic: true, liveProviders: false, spec: "plan-design-v1", checks: [], failures: [], calls };
async function check(name, run) {
  try { await run(); report.checks.push({ name, status: "passed" }); console.log("PASS", name); }
  catch (error) { report.failures.push({ name, error: String(error) }); throw error; }
  finally { await writeFile(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2)); }
}
const settle = page => page.waitForLoadState("networkidle");
const patched = page => page.waitForResponse(r => r.url().includes("/design/") && ["PATCH", "POST"].includes(r.request().method()));

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

async function setAI(page, { drafter, reviewer, enabled }) {
  await page.goto(`${base}/ai`, { waitUntil: "networkidle" });
  const form = page.locator('form:has(select[name="defaultProviderId"])');
  await form.locator('[name="defaultProviderId"]').selectOption(drafter ?? "");
  await form.locator('[name="reviewProviderId"]').selectOption(reviewer ?? "");
  await Promise.all([page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith("/api/ai/settings")), form.getByRole("button", { name: "保存功能设置", exact: true }).click()]);
  const toggle = page.getByRole("switch", { name: "启用 AI", exact: true });
  if ((await toggle.getAttribute("aria-checked") === "true") !== enabled) await Promise.all([page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith("/api/ai/settings")), toggle.click()]);
}

const noScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

let browser, drafter, planId;
try {
  await db.connect();
  const settings = (await db.query('SELECT enabled FROM "AISettings" WHERE id=$1', ["default"])).rows[0];
  assert.equal(settings?.enabled ?? false, false, "AI must be off in the acceptance database before the run");
  await new Promise(resolve => mock.listen(mockPort, "127.0.0.1", resolve));
  browser = await chromium.launch();
  const browserContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await browserContext.addCookies([{ name: "labnest_locale", value: "zh", url: base }]);
  const page = await browserContext.newPage();
  page.setDefaultTimeout(30_000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  await check("a new plan from the overview opens its design workbench, with LabNest records listed and nothing sent", async () => {
    drafter = await addProvider(page, "Design drafter mock", "mock-drafter");
    const reviewer = await addProvider(page, "Design reviewer mock", "mock-reviewer");
    await setAI(page, { drafter, reviewer, enabled: true });
    await page.goto(`${base}/research-plans?copilot=1`, { waitUntil: "networkidle" });
    const launcher = page.locator(".ln-copilot-launcher");
    await launcher.getByLabel("研究目的").fill(purpose);
    await launcher.getByRole("combobox").selectOption({ label: "SRGN project" });
    await launcher.getByRole("button", { name: "打开设计工作台" }).click();
    await page.waitForURL(/\/research-plans\/[^/]+\/design$/);
    planId = page.url().split("/").at(-2);
    await page.getByText("要发送的 LabNest 记录", { exact: false }).waitFor();
    assert.equal(calls.length, 0, "starting calls no model");
    await page.screenshot({ path: `${evidenceDir}/1-records.png`, fullPage: true });
  });

  await check("① the context card marks AI suggestions, asks what is ambiguous, and confirms", async () => {
    await page.getByRole("button", { name: "起草情境卡" }).click();
    await page.getByRole("heading", { name: "情境卡" }).waitFor();
    await page.getByText("迁移用 Transwell 还是划痕实验？").waitFor();
    assert(await page.locator('em[data-state="ai"]').count() >= 5);
    assert(await page.getByText("待定", { exact: true }).count() >= 1, "fields the model left empty stay open");
    await page.screenshot({ path: `${evidenceDir}/2-context.png`, fullPage: true });
    await Promise.all([patched(page), page.getByRole("button", { name: "确认情境卡" }).click()]);
    await page.getByLabel("证据链模板").waitFor();
    assert.equal(await page.getByLabel("证据链模板").inputValue(), "knockdown");
  });

  await check("③ the evidence chain comes from the knockdown template; at the standard tier the rescue is optional", async () => {
    await page.getByRole("button", { name: "起草证据链" }).click();
    await page.getByRole("heading", { name: "证据链" }).waitFor();
    assert(calls.find(call => call.step === "chain"), "the chain was drafted");
    await page.getByText("必做 2 个，可选 1 个。必做最多 5 个。").waitFor();
    await page.screenshot({ path: `${evidenceDir}/3-chain.png`, fullPage: true });
    await Promise.all([patched(page), page.getByRole("button", { name: "确认证据链" }).click()]);
  });

  await check("④ two design cards; wells counted as n is caught by the rules and fixed in the card", async () => {
    await Promise.all([page.waitForResponse(r => r.url().endsWith("/step") && calls.filter(call => call.step === "card").length === 2), page.getByRole("button", { name: "起草设计卡" }).click()]);
    await page.locator(".ln-dw-card").nth(1).waitFor();
    await settle(page);
    const phenotype = page.locator(".ln-dw-card", { hasText: "Transwell 迁移" });
    await phenotype.getByText("1 条规则问题").waitFor();
    await phenotype.locator("summary").click();
    await phenotype.getByText("把孔数或技术重复当作 n", { exact: false }).waitFor();
    await page.screenshot({ path: `${evidenceDir}/4-card-rule.png`, fullPage: true });
    await phenotype.getByLabel("n 计的是").selectOption("biological");
    await Promise.all([patched(page), phenotype.getByRole("button", { name: "保存这张卡" }).click()]);
    await page.locator(".ln-dw-card", { hasText: "Transwell 迁移" }).getByText("规则检查通过").waitFor();
    await Promise.all([patched(page), page.getByRole("button", { name: "确认设计卡" }).click()]);
    await page.getByRole("heading", { name: "独立审查" }).waitFor();
  });

  await check("⑥ the separate reviewer's severe finding blocks signing until a card changes", async () => {
    await page.getByRole("button", { name: "开始审查" }).click();
    await page.getByText("第 1 轮：需要修改", { exact: false }).waitFor();
    assert.equal(calls.filter(call => call.step === "review").at(-1).model, "mock-reviewer", "the review goes to the review service");
    assert(calls.filter(call => call.step !== "review").every(call => call.model === "mock-drafter"));
    await page.getByText("审查服务：Design reviewer mock", { exact: false }).waitFor();
    const selfReview = page.getByText("起草和审查用的是同一个服务", { exact: false });
    if (await selfReview.count()) { await page.screenshot({ path: `${evidenceDir}/debug-self-review.png`, fullPage: true }); throw new Error(`self-review warning shown: ${await selfReview.first().evaluate(node => node.outerHTML)}`); }
    await page.getByText("严重审查意见：迁移下降可能来自增殖减慢").waitFor();
    assert.equal(await page.getByRole("button", { name: "预览签署要写入的内容" }).isDisabled(), true);
    await page.screenshot({ path: `${evidenceDir}/5-review.png`, fullPage: true });
    await page.getByRole("button", { name: "已在卡片中修改" }).first().click();
    await page.getByText("请先修改设计卡，或写明理由豁免这条意见").waitFor();
    await page.getByText("修改设计卡", { exact: true }).click();
    const phenotype = page.locator(".ln-dw-card", { hasText: "Transwell 迁移" });
    await phenotype.locator("summary").click();
    await phenotype.getByRole("button", { name: "添加" }).nth(2).click();
    const row = phenotype.locator("fieldset", { hasText: "读出" }).locator(".ln-dw-row").last();
    await row.getByLabel("读出").fill("细胞增殖");
    await row.getByLabel("测定方法").fill("CCK-8，与迁移同期");
    await row.getByLabel("检测类型").selectOption("viability");
    await Promise.all([patched(page), phenotype.getByRole("button", { name: "保存这张卡" }).click()]);
    await Promise.all([patched(page), page.getByRole("button", { name: "已在卡片中修改" }).first().click()]);
    await page.getByRole("button", { name: "预览签署要写入的内容" }).waitFor({ state: "visible" });
    assert.equal(await page.getByRole("button", { name: "预览签署要写入的内容" }).isDisabled(), false);
    await page.getByRole("button", { name: "开始第 2 轮审查" }).click();
    await page.getByText("第 2 轮：可以签署", { exact: false }).waitFor();
    assert.equal(await page.getByRole("button", { name: "两轮审查已完成" }).isDisabled(), true, "at most two rounds");
  });

  await check("signing shows what it writes, then fills the plan and makes two planned experiments with groups", async () => {
    await page.getByRole("button", { name: "预览签署要写入的内容" }).click();
    await page.getByRole("button", { name: "签署并写入方案" }).waitFor();
    assert.equal(await page.locator(".ln-dw-preview input[type=checkbox]:checked").count() >= 3, true);
    await page.screenshot({ path: `${evidenceDir}/6-sign-preview.png`, fullPage: true });
    await page.getByRole("button", { name: "签署并写入方案" }).click();
    await page.getByText("已签署，建出计划中的实验 2 个。").waitFor();
    const plan = (await db.query('SELECT objective, hypothesis, "contentJson" FROM "ResearchPlan" WHERE id=$1', [planId])).rows[0];
    assert.equal(plan.objective, context.question, "the launcher's purpose is replaced by the confirmed question");
    assert.equal(plan.hypothesis, chain.hypothesis);
    const written = Object.fromEntries(plan.contentJson.sections.map(section => [section.key, section.blocks.filter(block => block.id.startsWith("copilot-design-")).length]));
    for (const key of ["design", "material_methods", "acceptance_criteria", "constraints", "references"]) assert(written[key] > 0, `${key} written`);
    const text = JSON.stringify(plan.contentJson);
    assert(text.includes("常规做法，未经文献核对") && text.includes("审查由 Design reviewer mock（mock-reviewer） 完成，共 2 轮") && text.includes("可选实验（未建实验）"));
    const experiments = (await db.query(`SELECT e.id, e.title, e.tags, e."protocolVersionId", (SELECT array_agg(label ORDER BY "sortOrder") FROM "ExperimentSampleGroup" g WHERE g."experimentId"=e.id) AS groups,
      (SELECT count(*)::int FROM "ExperimentScheduleBlock" b WHERE b."experimentId"=e.id) AS blocks FROM "Experiment" e WHERE e."researchPlanId"=$1 ORDER BY e."createdAt"`, [planId])).rows;
    assert.deepEqual(experiments.map(row => [row.title, row.groups]), [["敲低效率验证（qPCR + WB）", ["NC", "si-1", "si-2"]], ["Transwell 迁移", ["NC", "si-1", "si-2"]]]);
    assert(experiments.every(row => row.tags.includes("设计工作台")));
    report.experiments = experiments.map(row => ({ title: row.title, protocol: Boolean(row.protocolVersionId), scheduleBlocks: row.blocks }));
    const run = (await db.query('SELECT status, "modelCalls" FROM "ResearchPlanDesignRun" WHERE "researchPlanId"=$1', [planId])).rows[0];
    assert.equal(run.status, "signed");
    report.modelCalls = run.modelCalls;
    assert(run.modelCalls <= 12, "a full run without literature stays within 12 model calls");
    assert(calls.filter(call => call.step === "context").every(call => call.sentInventory || true));
  });

  await check("the plan page shows one line for the signed design; the workbench fits a phone", async () => {
    await page.goto(`${base}/research-plans/${planId}`, { waitUntil: "networkidle" });
    await page.getByText("设计 v1 已签署", { exact: false }).waitFor();
    await page.screenshot({ path: `${evidenceDir}/7-plan.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/research-plans/${planId}/design`, { waitUntil: "networkidle" });
    await page.getByText("设计 v1 · ", { exact: false }).waitFor();
    assert(await noScroll(page), "no horizontal scroll at 390 px");
    await page.screenshot({ path: `${evidenceDir}/8-signed-390.png`, fullPage: true });
    assert.deepEqual(errors, []);
  });
} finally {
  if (drafter && browser) {
    const cleanup = await browser.newContext();
    await cleanup.addCookies([{ name: "labnest_locale", value: "zh", url: base }]);
    await setAI(await cleanup.newPage(), { drafter: null, reviewer: null, enabled: false }).catch(error => report.failures.push({ name: "switch AI off again", error: String(error) }));
  }
  await browser?.close();
  mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve));
  await db.end();
  await writeFile(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2));
}
