/**
 * Browser acceptance for the research-plan design workbench (plan-design-v2: Q300–Q312 and phase 2, Q332), against an
 * isolated database, two local mock models (one drafts, one reviews) and a local stand-in for Europe PMC.
 *
 *   DATABASE_URL=postgresql://…/labnest_design_20261102 \
 *   LABNEST_E2E_BASE_URL=http://localhost:3002 node scripts/verify-plan-design.mjs
 *
 * The app must run against the same database with AI switched off, and with LABNEST_EUROPE_PMC_BASE and
 * LABNEST_PUBMED_BASE pointing at the mock (the `labnest-design-check` launch entry). The script adds two local services,
 * switches AI on for the run and off again at the end, and puts external search back as it found it. It makes a new
 * plan from the overview and walks the five steps: the context card; the hypotheses, with a result that would count
 * against the main one required; an evidence ledger filled by a search and by a PMID, each paper checked three ways;
 * the chain built on the confirmed rivals; design cards with the sample size worked out by the program; two review
 * rounds; and a sign-off that leaves out one section. Nothing leaves this computer.
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
const evidenceDir = process.env.AI_EVIDENCE_DIR ?? "docs/modules/ai/copilot-workflow-20261101/evidence-part2-phase2";
await mkdir(evidenceDir, { recursive: true });
const purpose = "证明 SRGN 敲低抑制 KYSE150 细胞迁移";

const context = {
  question: "SRGN 敲低是否抑制 KYSE150 细胞迁移", claimType: "necessity", subject: "SRGN", modelSystem: "KYSE150（食管鳞癌细胞系）",
  resourcesHave: "KYSE150 细胞", resourcesCanGet: "SRGN siRNA 两条；NC siRNA", resourcesLack: "抗 siRNA 的 SRGN 表达质粒", constraints: "", outOfScope: "体内实验",
  success: "两条 siRNA 都使 Transwell 迁移细胞数下降", priorResults: "预实验：NC 约 60 个/视野，SD 约 15", questions: ["迁移用 Transwell 还是划痕实验？"],
};
const hypotheses = {
  estimand: "si-SRGN 与 NC 相比，KYSE150 24 h Transwell 迁移细胞数的差异",
  main: { statement: "SRGN 是 KYSE150 细胞迁移所必需的：敲低 SRGN 使迁移减少", mechanism: "", predicts: "两条独立 siRNA 都使迁移细胞数低于 NC", incompatible: "敲低效率达标而两条 siRNA 的迁移数都与 NC 无差别" },
  rivals: [
    { id: "r1", statement: "siRNA 脱靶", kind: "reagent", test: "两条序列不同的 siRNA 比较", ifMain: "两条 siRNA 表型一致", ifRival: "只有一条 siRNA 有表型", undecided: "两条 siRNA 敲低效率相差很大", exclude: true },
    { id: "r2", statement: "增殖差异混杂迁移", kind: "confounding", test: "同期 CCK-8 增殖检测", ifMain: "24 h 内增殖无差别而迁移下降", ifRival: "增殖与迁移同步下降", undecided: "增殖略降但小于迁移下降", exclude: true },
  ],
  drift: [],
};
const chain = {
  claim: "SRGN 是 KYSE150 细胞迁移所必需的", hypothesis: "（模型写的，会被已确认的主假设替换）", rationale: "预实验显示 NC 约 60 个/视野；已核实的文献 e1 在同一细胞系中看到敲低后迁移下降",
  minimumEvidence: ["mRNA 与蛋白水平的敲低验证", "两条独立 siRNA 表型一致", "NC 对照"],
  blocks: [
    { id: "kd-check", title: "敲低效率验证（qPCR + WB）", kind: "manipulation", minTier: "light", purpose: "确认两条 siRNA 有效", success: "两条 siRNA 敲低 ≥ 70%", failure: "表型无法解释", fallback: "换序列或改 shRNA", dependsOn: [], addresses: [] },
    { id: "phenotype", title: "Transwell 迁移", kind: "phenotype", minTier: "light", purpose: "检验迁移是否下降", success: "两条 siRNA 的迁移数均低于 NC", failure: "SRGN 不是迁移所必需", fallback: "划痕实验", dependsOn: ["kd-check"], addresses: ["r1"] },
    { id: "rescue", title: "拯救实验", kind: "specificity", minTier: "publication", purpose: "排除脱靶", success: "回补后迁移恢复", failure: "", fallback: "", dependsOn: ["phenotype"], addresses: ["r1"] },
  ],
  recommendedTier: "standard", drift: [],
};
const groups = [{ name: "NC", treatment: "NC siRNA 50 nM", control: true }, { name: "si-1", treatment: "SRGN siRNA#1 50 nM", control: false }, { name: "si-2", treatment: "SRGN siRNA#2 50 nM", control: false }];
const card = (blockId, protocols) => ({
  blockId, unit: { experimental: "一孔细胞", analysis: "一次独立转染", nCounts: blockId === "phenotype" ? "wells" : "biological" }, factors: [{ name: "siRNA", levels: ["NC", "si-1", "si-2"] }], groups,
  controls: [{ name: "NC siRNA", kind: "negative", excludes: "转染本身的影响", concurrent: true, addresses: [] }], manipulation: { kind: "knockdown", independentReagents: 2, efficiencyCheck: "" },
  replicates: { biological: 3, technical: 3, note: "" },
  // The model proposes the effect and where it comes from; it also writes an n, which the program must replace.
  sampleSize: blockId === "phenotype" ? { n: 3, basis: "minimum_effect", design: "two_groups", difference: 30, sd: 15, source: "情境卡的预实验：NC 约 60 个/视野，SD 约 15；最小关注差异为一半", note: "" } : { n: null, basis: "pending", note: "需要预实验" },
  randomization: "板位随机", blinding: blockId === "phenotype" ? "计数者不知道分组" : "", batch: "每个独立重复在不同的一天完成，每批都包含全部分组",
  readouts: blockId === "kd-check" ? [{ name: "SRGN mRNA", method: "RT-qPCR", timepoint: "48 h", assay: "qpcr" }, { name: "SRGN 蛋白", method: "Western blot", timepoint: "72 h", assay: "western_blot" }] : [{ name: "迁移细胞数", method: "Transwell，结晶紫染色计数", timepoint: "24 h", assay: "migration" }],
  referenceGenes: blockId === "kd-check" ? ["GAPDH", "ACTB"] : [], loadingControl: blockId === "kd-check" ? "β-actin" : "", normalization: blockId === "kd-check" ? "SRGN / β-actin 灰度比" : "",
  analysis: { test: "单因素方差分析", primaryComparison: "si-1、si-2 分别与 NC 比较", multipleComparison: "Dunnett 校正", exclusion: "" }, criteria: ["两条 siRNA 的结果都满足成功标准"],
  dependsOn: blockId === "phenotype" ? ["kd-check"] : [],
  protocol: blockId === "kd-check" && protocols.siRNA ? { id: protocols.siRNA, title: "", needed: false } : { id: "", title: "Transwell 迁移", needed: true },
  methodNote: "", drift: [],
});
// A review judges every dimension, with a finding behind each concern and a change to make for each finding.
const judged = (...concerns) => ["controls", "confounding", "pseudoreplication", "sample_size", "multiple_comparisons", "overclaiming", "feasibility", "safety_ethics"].map(key => ({ key, verdict: concerns.includes(key) ? "concern" : "ok", note: "" }));
const reviews = [
  { verdict: "revise", supports: "SRGN 对 KYSE150 迁移的必要性（仅限 KYSE150 与 24 h Transwell）", strengths: ["两条独立 siRNA 加同期 NC"], dimensions: judged("overclaiming", "feasibility"),
    findings: [{ severity: "critical", dimension: "overclaiming", blockId: "phenotype", field: "controls", problem: "迁移下降可能来自增殖减慢", suggestion: "同期加 CCK-8 增殖检测，并把它对应到“增殖差异混杂迁移”" }, { severity: "minor", dimension: "feasibility", blockId: "", field: "", problem: "两周内完成较紧", suggestion: "把拯救实验留到下一期" }] },
  { verdict: "ready", supports: "SRGN 对 KYSE150 迁移的必要性（仅限 KYSE150 与 24 h Transwell）", strengths: [], dimensions: judged(), findings: [] },
];

// The stand-in for Europe PMC: two search results (one open access, one retracted), one paper by PMID, none by a made-up DOI.
const papers = {
  open: { pmid: "38000001", pmcid: "PMC9000001", isOpenAccess: "Y", title: "Serglycin knockdown reduces migration of esophageal squamous carcinoma cells", pubYear: "2024", journalTitle: "Test Journal",
    abstractText: "Serglycin (SRGN) was highly expressed in ESCC tissues. In KYSE150 cells, knockdown of SRGN with two independent siRNAs reduced migration in Transwell assays." },
  retracted: { pmid: "38000002", isOpenAccess: "N", title: "A retracted study of SRGN and metastasis", pubYear: "2021", journalTitle: "Test Journal",
    abstractText: "SRGN drives metastasis of esophageal cancer cells in every model tested.", pubTypeList: { pubType: ["Journal Article", "Retracted Publication"] } },
  byPmid: { pmid: "31234567", isOpenAccess: "N", title: "SRGN and invasion in ESCC", pubYear: "2019", journalTitle: "Oncology Test", abstractText: "SRGN expression correlated with invasion depth in 120 ESCC patients." },
};
const fullText = "<article><body><sec><title>Methods</title><p>KYSE150 cells were transfected with two independent siRNAs against SRGN.</p></sec><sec><title>Results</title><p>Knockdown of SRGN reduced the number of migrated cells by about half in Transwell assays.</p></sec></body></article>";

const token = "design-fake-token";
const calls = [], outside = [];
const mock = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const reply = (data, status = 200, type = "application/json") => { res.writeHead(status, { "content-type": type }); res.end(typeof data === "string" ? data : JSON.stringify(data)); };
  const url = new URL(req.url, `http://127.0.0.1:${mockPort}`);
  if (url.pathname.startsWith("/europepmc/")) {
    const query = url.searchParams.get("query") ?? "";
    outside.push({ path: url.pathname, query });
    if (url.pathname.endsWith("/fullTextXML")) return reply(fullText, 200, "application/xml");
    if (query.includes("EXT_ID:31234567")) return reply({ resultList: { result: [papers.byPmid] } });
    if (query.includes("DOI:")) return reply({ resultList: { result: [] } });
    return reply({ resultList: { result: [papers.open, papers.retracted] } });
  }
  if (req.headers.authorization !== `Bearer ${token}`) return reply({ error: { message: "bad key" } }, 401);
  if (req.url.endsWith("/models")) return reply({ data: [{ id: "mock-drafter" }, { id: "mock-reviewer" }] });
  const request = JSON.parse(body);
  const system = request.messages[0].content, user = request.messages.at(-1).content;
  const step = system.includes("现在做第二步“假设与预测”") ? "hypotheses" : system.includes("拟定文献检索词") ? "terms" : system.includes("证据账本读一篇论文") ? "read"
    : system.includes("情境卡”。") ? "context" : system.includes("现在做“证据链”") ? "chain" : system.includes("写“设计卡”") ? "card" : system.includes("独立的实验设计审稿人") ? "review" : "other";
  calls.push({ step, model: request.model, chars: user.length, sentInventory: user.includes("KYSE150"), json: request.response_format?.type });
  let text = "{}";
  if (step === "context") text = JSON.stringify(context);
  if (step === "hypotheses") text = JSON.stringify(hypotheses);
  if (step === "terms") text = JSON.stringify({ queries: [{ text: "SRGN knockdown migration esophageal", for: "main" }, { text: "SRGN proliferation KYSE150", for: "r2" }] });
  if (step === "read") {
    const source = user.split("原文：\n")[1] ?? "";
    const quote = source.split(/(?<=\.)\s+/).find(sentence => /SRGN/.test(sentence) && sentence.length > 40) ?? "";
    text = JSON.stringify({ relevant: true, target: "main", relation: "subject", quote: quote.replace(/\.$/, ""), system: "KYSE150", note: "同一细胞系里的直接证据" });
  }
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
const report = { base, at: new Date().toISOString(), synthetic: true, liveProviders: false, spec: "plan-design-v2", checks: [], failures: [], calls, outside };
async function check(name, run) {
  try { await run(); report.checks.push({ name, status: "passed" }); console.log("PASS", name); }
  catch (error) { report.failures.push({ name, error: String(error) }); throw error; }
  finally { await writeFile(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2)); }
}
const settle = page => page.waitForLoadState("networkidle");
const patched = page => page.waitForResponse(r => r.url().includes("/design/") && ["PATCH", "POST"].includes(r.request().method()));
const ledgerCall = page => page.waitForResponse(r => r.url().endsWith("/evidence") && r.request().method() === "POST");

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

/** External search, on the AI page since Q306: the switch and Europe PMC. */
async function setSearch(page, on) {
  await page.goto(`${base}/ai#external-search`, { waitUntil: "networkidle" });
  const section = page.locator("#external-search");
  await section.locator('input[name="enabled"]').setChecked(on);
  await section.locator('input[name="sources"][value="europe_pmc"]').setChecked(on);
  await section.locator('button[type="submit"]').click();
  await section.getByText("Search settings saved.").or(section.getByRole("status")).first().waitFor();
}

const noScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

let browser, drafter, planId, searchBefore;
try {
  await db.connect();
  const settings = (await db.query('SELECT enabled FROM "AISettings" WHERE id=$1', ["default"])).rows[0];
  assert.equal(settings?.enabled ?? false, false, "AI must be off in the acceptance database before the run");
  searchBefore = (await db.query('SELECT enabled, "sourcesJson" FROM "MethodSearchSettings" WHERE id=$1', ["default"])).rows[0];
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
    await setSearch(page, false);
    await page.goto(`${base}/research-plans?copilot=1`, { waitUntil: "networkidle" });
    const launcher = page.locator(".ln-copilot-launcher");
    await launcher.getByLabel("研究目的").fill(purpose);
    await launcher.getByRole("combobox").selectOption({ label: "SRGN project" });
    await launcher.getByRole("button", { name: "打开设计工作台" }).click();
    await page.waitForURL(/\/research-plans\/[^/]+\/design$/);
    planId = page.url().split("/").at(-2);
    await page.getByText("要发送的 LabNest 记录", { exact: false }).waitFor();
    assert.equal(await page.locator(".ln-dw-rail li").count(), 5, "five steps");
    assert.equal(calls.length, 0, "starting calls no model");
    await page.screenshot({ path: `${evidenceDir}/1-records.png`, fullPage: true });
  });

  await check("① the context card marks AI suggestions, asks what is ambiguous, and confirms into ②", async () => {
    await page.getByRole("button", { name: "起草情境卡" }).click();
    await page.getByRole("heading", { name: "情境卡" }).waitFor();
    await page.getByText("迁移用 Transwell 还是划痕实验？").waitFor();
    assert(await page.locator('em[data-state="ai"]').count() >= 5);
    await Promise.all([patched(page), page.getByRole("button", { name: "确认情境卡" }).click()]);
    await page.getByRole("button", { name: "起草假设" }).waitFor();
  });

  await check("② rivals with the tests that tell them apart; no confirming without a result against the main hypothesis", async () => {
    await page.getByRole("button", { name: "起草假设" }).click();
    await page.getByRole("heading", { name: "假设与预测" }).waitFor();
    assert.equal(await page.locator(".ln-dw-blocks > li").count(), 2, "two rivals");
    const incompatible = page.locator("label", { hasText: "与之不相容的结果" }).locator("textarea");
    await incompatible.fill("");
    await page.getByText("写明什么结果与主假设不相容：没有它，假设就无法检验").first().waitFor();
    await Promise.all([patched(page), page.getByRole("button", { name: "保存修改" }).click()]);
    assert.equal(await page.getByRole("button", { name: "确认假设" }).isDisabled(), true, "a serious check stops the confirmation");
    await page.screenshot({ path: `${evidenceDir}/2-hypotheses-check.png`, fullPage: true });
    await incompatible.fill(hypotheses.main.incompatible);
    await Promise.all([patched(page), page.getByRole("button", { name: "保存修改" }).click()]);
    assert.equal(await page.getByRole("button", { name: "确认假设" }).isDisabled(), false);
  });

  await check("the evidence ledger says when literature search is off; the switch is on the AI page", async () => {
    await page.getByText("文献检索已关闭。请在", { exact: false }).waitFor();
    await setSearch(page, true);
    await page.goto(`${base}/research-plans/${planId}/design`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "起草检索词" }).waitFor();
    await page.goto(`${base}/protocols/design`, { waitUntil: "networkidle" });
    await page.getByText("在 AI 页面修改").waitFor();
    assert.equal(await page.locator('input[name="enabled"]').count(), 0, "the method design page no longer holds the switch");
    await page.goto(`${base}/research-plans/${planId}/design`, { waitUntil: "networkidle" });
  });

  await check("a search through LabNest, then reading: the retracted paper never counts, the other counts once confirmed", async () => {
    await Promise.all([ledgerCall(page), page.getByRole("button", { name: "起草检索词" }).click()]);
    await page.locator('input[aria-label="检索词"]').nth(1).waitFor();
    await Promise.all([ledgerCall(page), page.locator(".ln-dw-ledger").getByRole("button", { name: "搜索", exact: true }).click()]);
    await page.getByText("待读的检索结果（2）").waitFor();
    assert(outside.some(request => request.path.endsWith("/search") && /SRGN/.test(request.query)), "LabNest searched the stand-in");
    await page.getByRole("button", { name: "读这 2 篇" }).click();
    await page.locator(".ln-dw-entries > li").nth(1).waitFor();
    await settle(page);
    const open = page.locator(".ln-dw-entries > li", { hasText: "Serglycin knockdown" });
    await open.getByText("待核实", { exact: true }).waitFor();
    await open.getByText("还没确认关系").waitFor();
    await open.getByText("检索所得，读了全文").waitFor();
    assert(outside.some(request => request.path.endsWith("/PMC9000001/fullTextXML")), "the open-access paper was read in full text");
    const retracted = page.locator(".ln-dw-entries > li", { hasText: "A retracted study" });
    await retracted.getByText("已撤稿：不会作为证据。", { exact: false }).waitFor();
    assert.equal(await retracted.getByLabel("我已核对它关于哪一条、是什么关系").isDisabled(), true);
    // The box follows the saved entry, so it ticks once the save is back.
    await Promise.all([patched(page), open.getByLabel("我已核对它关于哪一条、是什么关系").click()]);
    await page.locator(".ln-dw-entries > li", { hasText: "Serglycin knockdown" }).getByText("已核实", { exact: true }).waitFor();
    await page.screenshot({ path: `${evidenceDir}/3-ledger-search.png`, fullPage: true });
  });

  await check("adding by PMID: found, but a quote not in the abstract stays to check; a made-up DOI is not found", async () => {
    await page.getByText("添加你知道的文献").click();
    const form = page.locator(".ln-dw-add");
    await form.getByLabel("PMID、PMCID 或 DOI").fill("PMID: 31234567");
    await form.getByLabel("引文：从摘要或论文中逐字复制").fill("SRGN knockdown abolished invasion in every ESCC line tested");
    await Promise.all([ledgerCall(page), form.getByRole("button", { name: "添加并核对" }).click()]);
    const byPmid = page.locator(".ln-dw-entries > li", { hasText: "SRGN and invasion in ESCC" });
    await byPmid.getByText("引文没有逐字出现在原文里").waitFor();
    await byPmid.getByText("由你添加").waitFor();
    if (!await form.getByLabel("PMID、PMCID 或 DOI").isVisible()) await page.getByText("添加你知道的文献").click();
    await form.getByLabel("PMID、PMCID 或 DOI").fill("10.9999/none.2026");
    await Promise.all([ledgerCall(page), form.getByRole("button", { name: "添加并核对" }).click()]);
    await page.locator(".ln-dw-entries > li", { hasText: "DOI 10.9999/none.2026" }).getByText("在 Europe PMC 和 PubMed 都查不到").waitFor();
    await page.getByText("证据账本 · 已核实 1 · 待核实 3 · 已撤稿 1").waitFor();
    await page.screenshot({ path: `${evidenceDir}/4-ledger-added.png`, fullPage: true });
    await Promise.all([patched(page), page.getByRole("button", { name: "确认假设" }).click()]);
    await page.getByLabel("证据链模板").waitFor();
  });

  await check("③ the chain is built on the confirmed rivals; each block says which ones it rules out", async () => {
    await page.getByRole("button", { name: "起草证据链" }).click();
    await page.getByRole("heading", { name: "证据链" }).waitFor();
    const chainCall = calls.find(call => call.step === "chain");
    assert(chainCall, "the chain was drafted");
    await page.getByText("来自已确认的假设；要修改请重新打开第 2 步。", { exact: false }).waitFor();
    // Block titles sit in inputs, so the block is found by its success criterion.
    const phenotype = page.locator(".ln-dw-blocks > li", { hasText: "两条 siRNA 的迁移数均低于 NC" }).first();
    assert.equal(await phenotype.getByLabel("siRNA 脱靶").isChecked(), true);
    assert.equal(await phenotype.getByLabel("增殖差异混杂迁移").isChecked(), false);
    await page.getByText("必做 2 个，可选 1 个。必做最多 5 个。").waitFor();
    await page.screenshot({ path: `${evidenceDir}/5-chain.png`, fullPage: true });
    await Promise.all([patched(page), page.getByRole("button", { name: "确认证据链" }).click()]);
  });

  await check("④ the program works out n from the effect; wells as n and too few replicates are caught and fixed", async () => {
    await Promise.all([page.waitForResponse(r => r.url().endsWith("/step") && calls.filter(call => call.step === "card").length === 2), page.getByRole("button", { name: "起草设计卡" }).click()]);
    await page.locator(".ln-dw-card").nth(1).waitFor();
    await settle(page);
    await page.getByText("没有对照或必做实验块排除“增殖差异混杂迁移”", { exact: false }).waitFor();
    const phenotype = page.locator(".ln-dw-card", { hasText: "Transwell 迁移" });
    await phenotype.getByText("2 条规则问题").waitFor();
    await phenotype.locator("summary").click();
    await phenotype.getByText("每组 n = 6").waitFor();
    await phenotype.getByText("每组计划 3 个生物学重复；样本量计算需要 6 个").waitFor();
    await page.screenshot({ path: `${evidenceDir}/6-card-sample-size.png`, fullPage: true });
    await phenotype.getByLabel("n 计的是").selectOption("biological");
    await phenotype.getByLabel("每组生物学重复").fill("6");
    await Promise.all([patched(page), phenotype.getByRole("button", { name: "保存这张卡" }).click()]);
    await page.locator(".ln-dw-card", { hasText: "Transwell 迁移" }).getByText("规则检查通过").waitFor();
    const stored = (await db.query('SELECT "stateJson" FROM "ResearchPlanDesignRun" WHERE "researchPlanId"=$1', [planId])).rows[0].stateJson;
    assert.equal(stored.cards.items.find(item => item.blockId === "phenotype").sampleSize.n, 6, "the model's n of 3 was replaced by the computed 6");
    await Promise.all([patched(page), page.getByRole("button", { name: "确认设计卡" }).click()]);
    await page.getByRole("heading", { name: "独立审查" }).waitFor();
  });

  await check("⑥ review v3: what the design can support; the severe finding is fixed by a control tied to its rival", async () => {
    await page.getByRole("button", { name: "开始审查" }).click();
    await page.getByText("第 1 轮：需要修改", { exact: false }).waitFor();
    assert.equal(calls.filter(call => call.step === "review").at(-1).model, "mock-reviewer", "the review goes to the review service");
    await page.getByText("这份设计最多能支持的结论").waitFor();
    await page.getByText("严重审查意见：迁移下降可能来自增殖减慢").waitFor();
    assert.equal(await page.getByRole("button", { name: "预览签署要写入的内容" }).isDisabled(), true);
    await page.screenshot({ path: `${evidenceDir}/7-review.png`, fullPage: true });
    await page.getByText("修改设计卡", { exact: true }).click();
    const phenotype = page.locator(".ln-dw-card", { hasText: "Transwell 迁移" });
    await phenotype.locator("summary").click();
    const controls = phenotype.locator("fieldset").filter({ has: page.locator("legend", { hasText: /^对照$/ }) });
    await controls.getByRole("button", { name: "添加" }).click();
    const row = controls.locator(".ln-dw-row").last();
    await row.locator("input").first().fill("同期 CCK-8 增殖");
    await row.getByLabel("它排除的对立解释").selectOption({ label: "增殖差异混杂迁移" });
    await Promise.all([patched(page), phenotype.getByRole("button", { name: "保存这张卡" }).click()]);
    assert.equal(await page.getByText("没有对照或必做实验块排除“增殖差异混杂迁移”", { exact: false }).count(), 0, "rule 18 is satisfied");
    await Promise.all([patched(page), page.getByRole("button", { name: "已在卡片中修改" }).first().click()]);
    await page.getByText("第 1 轮审查之后改过，请再审查一轮：Transwell 迁移").waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await noScroll(page), "the review step with the ledger fits 390 px");
    await page.screenshot({ path: `${evidenceDir}/8-review-390.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "开始第 2 轮审查" }).click();
    await page.getByText("第 2 轮：可以签署", { exact: false }).waitFor();
    assert.equal(await page.getByRole("button", { name: "预览签署要写入的内容" }).isDisabled(), false);
  });

  await check("signing leaves out the section the author unticks and writes only verified papers as evidence", async () => {
    await page.getByRole("button", { name: "预览签署要写入的内容" }).click();
    await page.getByRole("button", { name: "签署并写入方案" }).waitFor();
    await page.locator(".ln-dw-preview label", { hasText: "材料与方法" }).locator("input").uncheck();
    await page.screenshot({ path: `${evidenceDir}/9-sign-preview.png`, fullPage: true });
    await page.getByRole("button", { name: "签署并写入方案" }).click();
    await page.getByText("已签署，建出计划中的实验 2 个。").waitFor();
    const plan = (await db.query('SELECT objective, hypothesis, "contentJson" FROM "ResearchPlan" WHERE id=$1', [planId])).rows[0];
    assert.equal(plan.objective, context.question);
    assert.equal(plan.hypothesis, hypotheses.main.statement, "the hypothesis comes from ②");
    const written = Object.fromEntries(plan.contentJson.sections.map(section => [section.key, section.blocks.filter(block => block.id.startsWith("copilot-design-")).length]));
    assert.equal(written.material_methods ?? 0, 0, "the unticked section is left as it was");
    for (const key of ["design", "acceptance_criteria", "constraints", "references"]) assert(written[key] > 0, `${key} written`);
    const text = JSON.stringify(plan.contentJson);
    for (const phrase of ["区分性预测", "样本量：每组 6", "已核实的证据", "Serglycin knockdown reduces migration", "待核实（未写入依据）", "已撤稿", "检索记录", "审查认为这份设计最多能支持", "样本量由程序计算"]) assert(text.includes(phrase), `the plan says ${phrase}`);
    const run = (await db.query('SELECT status, "modelCalls", spec FROM "ResearchPlanDesignRun" WHERE "researchPlanId"=$1', [planId])).rows[0];
    assert.deepEqual([run.status, run.spec], ["signed", "plan-design-v2"]);
    report.modelCalls = run.modelCalls;
    assert(run.modelCalls <= 12, "the whole run, two papers read included, stays within 12 model calls");
  });

  await check("each suggestion and what the author did with it is kept under its spec version, and every call asked for JSON", async () => {
    const runId = (await db.query('SELECT id FROM "ResearchPlanDesignRun" WHERE "researchPlanId"=$1', [planId])).rows[0].id;
    const rows = (await db.query('SELECT kind, subject, status, "editedFields", "ignoreReason", "specId", "specVersion", provider FROM "CopilotSuggestion" WHERE "targetId"=$1 ORDER BY "createdAt"', [runId])).rows;
    const of = (kind, subject) => rows.find(row => row.kind === kind && row.subject === subject);
    assert.deepEqual([of("hypotheses", "hypotheses")?.status, of("hypotheses", "hypotheses")?.specId], ["adopted", "plan-design.hypotheses"]);
    assert.equal(of("evidence_entry", "e1")?.status, "adopted", "the confirmed paper counts as adopted");
    assert.notEqual(of("evidence_entry", "e2")?.status, "adopted", "the retracted one was never confirmed");
    assert.deepEqual([of("evidence_chain", "chain")?.specVersion, of("design_card", "phenotype")?.specVersion], [2, 2]);
    assert(rows.filter(row => row.kind === "review_finding").every(row => row.specVersion === 3));
    assert(calls.every(call => call.json === "json_object"), "JSON mode on every call");
    report.suggestions = rows;
  });

  await check("the plan page shows one line for the signed design; the signed workbench fits a phone", async () => {
    await page.goto(`${base}/research-plans/${planId}`, { waitUntil: "networkidle" });
    await page.getByText("设计 v1 已签署", { exact: false }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/research-plans/${planId}/design`, { waitUntil: "networkidle" });
    await page.getByText("设计 v1 · ", { exact: false }).waitFor();
    assert(await noScroll(page), "no horizontal scroll at 390 px");
    await page.screenshot({ path: `${evidenceDir}/10-signed-390.png`, fullPage: true });
    assert.deepEqual(errors, []);
  });
} finally {
  if (drafter && browser) {
    const cleanup = await browser.newContext();
    await cleanup.addCookies([{ name: "labnest_locale", value: "zh", url: base }]);
    await setAI(await cleanup.newPage(), { drafter: null, reviewer: null, enabled: false }).catch(error => report.failures.push({ name: "switch AI off again", error: String(error) }));
  }
  if (searchBefore) await db.query('UPDATE "MethodSearchSettings" SET enabled=$1, "sourcesJson"=$2 WHERE id=$3', [searchBefore.enabled, JSON.stringify(searchBefore.sourcesJson), "default"]).catch(error => report.failures.push({ name: "put external search back", error: String(error) }));
  await browser?.close();
  mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve));
  await db.end();
  await writeFile(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2));
}
