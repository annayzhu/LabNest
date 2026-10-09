/**
 * Browser acceptance for AI-assisted Protocol import, against an isolated database and a mock model.
 *
 *   DATABASE_URL=postgresql://…/labnest_protocol_ai_extraction_20261009 \
 *   LABNEST_E2E_BASE_URL=http://localhost:3339 node scripts/verify-protocol-ai-extraction.mjs
 *
 * The app must run against the same database. Fixture: scripts/build-protocol-ai-fixture.ts.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import pg from "pg";

const database = new URL(process.env.DATABASE_URL ?? "");
assert.equal(database.pathname, "/labnest_protocol_ai_extraction_20261009", "Only the isolated acceptance database is permitted");
assert(["localhost", "127.0.0.1"].includes(database.hostname));
const base = process.env.LABNEST_E2E_BASE_URL ?? "http://localhost:3339";
const mockPort = Number(process.env.AI_MOCK_PORT ?? 4849);
const fixtureDir = "docs/ai/20261009/fixtures";
const evidenceDir = process.env.AI_EVIDENCE_DIR ?? "docs/ai/20261009/evidence";
const fixtureName = (await readdir(fixtureDir)).find((name) => name.endsWith(".docx"));
assert(fixtureName, "Run scripts/build-protocol-ai-fixture.ts first");
const fixturePath = path.join(fixtureDir, fixtureName);
await mkdir(evidenceDir, { recursive: true });

const token = "extraction-fake-token";
const extraction = {
  parameters: [
    { name: "well_count", label: "Wells", type: "number", default: 24, unit: "wells", required: true, evidence: "cultured in a 24-well plate" },
    { name: "dna_ng_per_well", type: "number", default: 500, unit: "ng", evidence: "dilute 500 ng GFP reporter plasmid" },
    { name: "extra_fraction", type: "number", default: 0.1, evidence: "Prepare 10% extra volume to cover pipetting loss." },
    { name: "imaging time", type: "number", default: 48, unit: "h", evidence: "Image GFP 48 h after transfection" },
  ],
  consumptionRules: [
    { material_name: "Lipofectamine 3000", formula: "1.5 * well_count * (1 + extra_fraction)", unit: "µL", requires_inventory_selection: true, evidence: "dilute 1.5 µL Lipofectamine 3000 in 25 µL Opti-MEM" },
    { material_name: "Opti-MEM", formula: "50 * well_count * (1 + extra_fraction)", unit: "µL", evidence: "in 25 µL Opti-MEM" },
    { material_name: "P3000 reagent", formula: "1 * well_count * (1 + extra_fraction)", unit: "µL", evidence: "1 µL P3000 reagent in 25 µL Opti-MEM" },
    { material_name: "GFP reporter plasmid", formula: "dna_ng_per_well * well_count", unit: "ng", evidence: "dilute 500 ng GFP reporter plasmid" },
    { material_name: "Trypsin-EDTA", formula: "0.2 * well_count", unit: "mL", evidence: "Seed 1.0 × 10^5 cells per well" },
  ],
  stepAttributes: [
    { order: 1, requires_confirmation: false, evidence: "Seed 1.0 × 10^5 cells per well in 500 µL complete medium" },
    { order: 4, allows_deviation: false, evidence: "Do not vortex the complex." },
    { order: 12, requires_confirmation: true, evidence: "Do not vortex the complex." },
  ],
  resultFields: [
    { template_title: "Transfection readout", key: "gfp_positive_percent", label: "GFP-positive cells", type: "number", unit: "%", evidence: "record the percentage of GFP-positive cells" },
    { template_title: "Transfection readout", key: "mean_fluorescence", label: "Mean fluorescence intensity", type: "number", unit: "a.u.", evidence: "the mean fluorescence intensity" },
  ],
  warnings: ["Seeding density depends on the cell line."],
};

const requests = [];
const mock = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString();
  requests.push({ path: req.url, body: text ? JSON.parse(text) : undefined, auth: req.headers.authorization });
  const reply = (data, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
  if (req.headers.authorization !== `Bearer ${token}`) return reply({ error: { message: "bad key" } }, 401);
  if (req.url.endsWith("/models")) return reply({ data: [{ id: "fixture-model" }] });
  return reply({ model: "fixture-model", choices: [{ message: { content: "```json\n" + JSON.stringify(extraction, null, 1) + "\n```" } }] });
});

const db = new pg.Client({ connectionString: database.toString() });
const report = { base, at: new Date().toISOString(), synthetic: true, liveProviders: false, checks: [], failures: [] };
async function check(name, run) {
  try { await run(); report.checks.push({ name, status: "passed" }); }
  catch (error) { report.failures.push({ name, error: String(error) }); throw error; }
  finally { await writeFile(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2)); }
}
const settingsPost = (page) => page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/settings");

async function configureProvider(page) {
  await page.goto(`${base}/settings`, { waitUntil: "networkidle" });
  const form = page.locator('form:has(input[name="apiKey"])');
  await form.getByRole("button", { name: "Use DeepSeek / 使用 DeepSeek" }).click();
  assert.equal(await form.locator('[name="type"]').inputValue(), "openai_compatible");
  assert.equal(await form.locator('[name="baseUrl"]').inputValue(), "https://api.deepseek.com");
  assert.equal(await form.locator('[name="defaultModel"]').inputValue(), "deepseek-flash");
  // Replace only the external endpoint/model with a local fixture before submitting.

  await form.locator('[name="name"]').fill("Extraction fixture");
  await form.locator('[name="baseUrl"]').fill(`http://127.0.0.1:${mockPort}/v1`);
  await form.locator('[name="defaultModel"]').fill("fixture-model");
  await form.locator('[name="apiKey"]').fill(token);
  await Promise.all([settingsPost(page), form.getByRole("button", { name: "Add provider", exact: true }).click()]);
  const id = (await db.query('SELECT id FROM "AIProvider" WHERE name=$1', ["Extraction fixture"])).rows[0].id;
  await setAI(page, id, true);
  return id;
}

async function setAI(page, providerId, enabled) {
  await page.goto(`${base}/settings`, { waitUntil: "networkidle" });
  const form = page.locator('form:has(select[name="defaultProviderId"])');
  await form.locator('[name="enabled"]').setChecked(enabled);
  await form.locator('[name="defaultProviderId"]').selectOption(providerId ?? "");
  await Promise.all([settingsPost(page), form.getByRole("button", { name: "Save AI settings", exact: true }).click()]);
}

async function protocolCount() {
  return Number((await db.query('SELECT count(*) FROM "ProtocolVersion" WHERE "sourceFileName"=$1', [fixtureName])).rows[0].count);
}

async function previewViaApi(page, bytes) {
  const response = await page.request.post(`${base}/api/structured-import/protocols/preview`, { multipart: { file: { name: fixtureName, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: bytes } } });
  assert.equal(response.status(), 200, await response.text());
  return (await response.json()).preview;
}

async function extractViaApi(page, bytes, checksum, headers = { origin: base }) {
  return page.request.post(`${base}/api/ai/protocol-extraction`, { headers, multipart: { file: { name: fixtureName, mimeType: "application/octet-stream", buffer: bytes }, checksum, rowIndex: "0" } });
}

let browser;
try {
  await db.connect();
  await new Promise((resolve) => mock.listen(mockPort, "127.0.0.1", resolve));
  assert.equal(await protocolCount(), 0, "The fixture was already imported into the acceptance database; recreate it.");
  const bytes = await readFile(fixturePath);
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => { localStorage.setItem("labnest.locale", "en"); });
  const page = await context.newPage();

  await check("import page explains the disabled state when no model is connected", async () => {
    await page.goto(`${base}/protocols/import`, { waitUntil: "networkidle" });
    await page.locator('input[type="file"]').setInputFiles(fixturePath);
    await page.getByRole("button", { name: "Preview mapping" }).click();
    const panel = page.getByRole("region", { name: "AI extraction" });
    await panel.waitFor();
    assert(await panel.getByRole("button", { name: "Extract with AI" }).isDisabled());
    await panel.getByText("Connect a model provider in Settings").waitFor();
  });

  const providerId = await configureProvider(page);

  await check("boundary: foreign origin, JSON body, and AI off never reach the model", async () => {
    const preview = await previewViaApi(page, bytes);
    const before = requests.length;
    assert.equal((await extractViaApi(page, bytes, preview.checksum, { origin: "https://foreign.example" })).status(), 403);
    assert.equal((await page.request.post(`${base}/api/ai/protocol-extraction`, { headers: { origin: base, "content-type": "application/json" }, data: {} })).status(), 415);
    assert.equal((await extractViaApi(page, bytes, "0".repeat(64))).status(), 409);
    await setAI(page, providerId, false);
    assert.equal((await extractViaApi(page, bytes, preview.checksum)).status(), 403);
    await setAI(page, providerId, true);
    assert.equal(requests.length, before);
  });

  await check("prompt carries document text only, never media or the credential", async () => {
    const preview = await previewViaApi(page, bytes);
    const response = await extractViaApi(page, bytes, preview.checksum);
    assert.equal(response.status(), 200, await response.text());
    const body = requests.at(-1).body;
    const prompt = body.messages.map((message) => message.content).join("\n");
    assert(prompt.includes("Lipofectamine 3000") && prompt.includes("Do not vortex the complex."));
    assert(!prompt.includes(token) && !prompt.includes("/api/attachments/"));
  });

  await check("tampered, foreign-row and invalid selections are rejected without creating a Protocol", async () => {
    const preview = await previewViaApi(page, bytes);
    const signed = await (await extractViaApi(page, bytes, preview.checksum)).json();
    const confirm = (aiExtractions) => page.request.post(`${base}/api/structured-import/protocols/confirm`, { multipart: { file: { name: fixtureName, mimeType: "application/octet-stream", buffer: bytes }, mapping: "{}", checksum: preview.checksum, confirmationToken: preview.confirmationToken, aiExtractions: JSON.stringify(aiExtractions) } });
    const tampered = structuredClone(signed.proposal);
    tampered.items.find((item) => item.id === "consumption-1").value.formula = "999 * well_count";
    for (const attempt of [
      { proposal: tampered, token: signed.token, acceptedIds: ["consumption-1"] },
      { proposal: { ...signed.proposal, rowIndex: 3 }, token: signed.token, acceptedIds: ["parameter-1"] },
      { proposal: signed.proposal, token: signed.token, acceptedIds: ["parameter-4"] },
    ]) {
      const response = await confirm([attempt]);
      assert.equal(response.status(), 400, await response.text());
    }
    assert.equal(await protocolCount(), 0);
  });

  await check("mobile 390 px: extraction panel fits without horizontal scroll", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/protocols/import`, { waitUntil: "networkidle" });
    await page.locator('input[type="file"]').setInputFiles(fixturePath);
    await page.getByRole("button", { name: "Preview mapping" }).click();
    const panel = page.getByRole("region", { name: "AI extraction" });
    await panel.getByRole("button", { name: "Extract with AI" }).click();
    await panel.getByText(/suggestions selected/).waitFor();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    assert(width <= 390, `page scrolls horizontally at 390 px (${width})`);
    await panel.screenshot({ path: `${evidenceDir}/extraction-panel-mobile.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  await check("UI: extract, review evidence, deselect one rule, and import", async () => {
    await page.goto(`${base}/protocols/import`, { waitUntil: "networkidle" });
    await page.locator('input[type="file"]').setInputFiles(fixturePath);
    await page.getByRole("button", { name: "Preview mapping" }).click();
    const panel = page.getByRole("region", { name: "AI extraction" });
    await panel.getByRole("button", { name: "Extract with AI" }).click();
    await panel.getByText(/suggestions selected/).waitFor();
    const summary = await panel.getByText(/suggestions selected/).textContent();
    assert.match(summary, /^11 of 14 suggestions selected/);
    const row = (text) => panel.locator("label").filter({ hasText: text });
    assert(await row("imaging time").locator('input[type="checkbox"]').isDisabled(), "invalid parameter must not be selectable");
    assert(!(await row("Trypsin-EDTA").locator('input[type="checkbox"]').isChecked()), "unmatched material must start unchecked");
    assert(await row("Step 12").locator('input[type="checkbox"]').isDisabled());
    await row("P3000 reagent =").locator('input[type="checkbox"]').uncheck();
    await panel.getByText(/^10 of 14 suggestions selected/).waitFor();
    await panel.screenshot({ path: `${evidenceDir}/extraction-panel-desktop.png` });
    await Promise.all([
      page.waitForURL(/\/protocols\/(?!import)[^/]+$/, { timeout: 60_000 }),
      page.getByRole("button", { name: "Confirm import" }).click(),
    ]);
    await page.screenshot({ path: `${evidenceDir}/imported-protocol-desktop.png`, fullPage: true });
  });

  await check("database: accepted items are written, deselected and invalid items are not, audit recorded", async () => {
    const version = (await db.query('SELECT id, "protocolId", "parametersJson", "consumptionRulesJson", "stepsJson", "resultTemplatesJson", "changeSummary" FROM "ProtocolVersion" WHERE "sourceFileName"=$1', [fixtureName])).rows[0];
    assert(version, "Protocol version was not created");
    assert.deepEqual(version.parametersJson.map((p) => p.name), ["well_count", "dna_ng_per_well", "extra_fraction"]);
    assert.deepEqual(version.parametersJson[0], { name: "well_count", type: "number", default: 24, unit: "wells", required: true });
    assert.deepEqual(version.consumptionRulesJson.map((r) => r.material_name).sort(), ["GFP reporter plasmid", "Lipofectamine 3000", "Opti-MEM"]);
    assert.equal(version.stepsJson.find((s) => s.order === 1).requires_confirmation, false);
    assert.equal(version.stepsJson.find((s) => s.order === 4).allows_deviation, false);
    const readout = version.resultTemplatesJson.find((t) => t.title === "Transfection readout");
    assert.deepEqual(readout.fields.map((f) => f.key), ["gfp_positive_percent", "mean_fluorescence"]);
    assert.match(version.changeSummary, /AI-assisted extraction: 10 of 14 suggestions accepted/);
    const log = (await db.query(`SELECT "metadataJson" FROM "ActivityLog" WHERE action='structured_import' AND "targetId"=$1`, [version.protocolId])).rows[0].metadataJson;
    assert.equal(log.protocolImport.ai.provider, "Extraction fixture");
    assert.equal(log.protocolImport.ai.accepted.length, 10);
    assert(log.protocolImport.ai.rejected.includes("consumption-3"));
  });

  await check("imported parameters drive the consumption calculation", async () => {
    const version = (await db.query('SELECT "consumptionRulesJson" FROM "ProtocolVersion" WHERE "sourceFileName"=$1', [fixtureName])).rows[0];
    const lipid = version.consumptionRulesJson.find((r) => r.material_name === "Lipofectamine 3000");
    assert.equal(lipid.formula, "1.5 * well_count * (1 + extra_fraction)");
    assert.equal(lipid.requires_inventory_selection, true);
  });

  await setAI(page, providerId, false);
  await context.close();
} finally {
  await browser?.close();
  mock.closeAllConnections();
  await new Promise((resolve) => mock.close(resolve));
  await db.end();
  await writeFile(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2));
}
assert.equal(report.failures.length, 0, JSON.stringify(report.failures));
console.log(JSON.stringify({ checks: report.checks.length, failures: report.failures.length, synthetic: true, liveProviders: false }));
