import {closeProperties} from './test-helpers/editor-controls.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import readXlsxFile from 'read-excel-file/node';
const base = process.env.LABNEST_E2E_BASE_URL ?? 'http://localhost:3338';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname) && new URL(base).port !== '3001', 'Isolated acceptance server only');
const dir = 'docs/structured-protocol/20261014/evidence', fixture = JSON.parse(await readFile(`${dir}/fixtures.json`, 'utf8'));
await mkdir(dir, { recursive: true });
const browser = await chromium.launch(), context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Los_Angeles' });
await context.addCookies([{ name: 'labnest_locale', value: 'zh', url: base }]);
await context.tracing.start({ screenshots: true, snapshots: true });
context.setDefaultTimeout(15000);
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
const report = { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: Boolean(execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' }).trim()), browser: browser.version(), fixture: 'synthetic isolated database; AI_ENABLED=false', checks: [], screenshots: [] };
const go = path => page.goto(base + path, { waitUntil: 'networkidle' });
const shot = async name => { await page.screenshot({ path: `${dir}/${name}.png` }); report.screenshots.push(`${name}.png`); };
const record = async id => (await (await page.request.get(`${base}/api/experiments/${id}?qa=${Date.now()}`)).json()).experiment;
const waitRecord = async (id, predicate) => { for (let i = 0; i < 100; i++) { const value = await record(id); if (predicate(value)) { if (page.url().endsWith(`/experiments/${id}/run`) && value.protocolRun?.executionPlanJson?.revision !== undefined) await page.waitForFunction(revision => document.querySelector('[data-run-system-selection] input[name="executionPlanRevision"]')?.value === String(revision), value.protocolRun.executionPlanJson.revision); return value; } await new Promise(r => setTimeout(r, 100)); } throw Error('Database readback timed out'); };
const check = async (name, action) => { const started = Date.now(); try { await action(); report.checks.push({ name, result: '通过', ms: Date.now() - started }); console.log('PASS', name); } catch (error) { report.checks.push({ name, result: '失败', error: error.message }); await shot('failure'); throw error; } };
let experimentId, sourceBefore, steps;
try {
await check('A01 A02 all-system and selected preview retain source and existing Run selection', async () => {
  sourceBefore = await record(fixture.experimentId);
  await go(`/protocols/${fixture.protocolId}?version=${fixture.versionId}`);
  const main = page.locator('.app-shell-main'); assert((await main.innerText()).includes('50/80µL'));
  const preview = page.locator('.ln-systems-bar'); await preview.locator('.ln-systems-options').nth(0).getByRole('button',{name:'350 µL',exact:true}).click(); await preview.locator('.ln-systems-options').nth(1).getByRole('button',{name:'普通样本',exact:true}).click(); assert((await main.innerText()).includes('50µL')); assert(!(await main.innerText()).includes('50/80µL'));
  assert(!(await main.innerText()).includes('附加盐'));
  await shot('protocol-selected-desktop');
  assert.deepEqual((await record(fixture.experimentId)).protocolRun.executionPlanJson, sourceBefore.protocolRun.executionPlanJson);
  await preview.getByRole('button',{name:/^(All systems|全部体系)$/,exact:true}).click();
  await page.pdf({ path: `${dir}/protocol-preview.pdf`, format: 'A4', printBackground: true });
});
await check('B01 B03 actual experiment creation captures four stable operations and blocks unconfirmed dependent work', async () => {
  await go(`/experiments/new?plan=${fixture.planId}&protocolVersionId=${fixture.versionId}`);
  assert.equal(await page.locator('[data-preview-step]').count(), 4);
  await page.locator('.document-page-title-input').fill('合成验收 · 页面创建与执行');
  await closeProperties(page); await page.getByRole('button', { name: /^(Save Experiment|保存实验)$/ }).click();
  await page.waitForURL(url => /^\/experiments\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/new'));
  experimentId = page.url().split('/').pop(); report.experimentId = experimentId;
  const initial = await record(experimentId); steps = Object.fromEntries(initial.steps.map(s => [s.protocolStepRef.split(':').pop(), s]));
  assert.equal(initial.steps.length, 4); report.stepIds = Object.fromEntries(Object.entries(steps).map(([key, s]) => [key, s.id]));
  await go(`/experiments/${experimentId}/run`);
  assert(await page.locator(`#step-${steps.dose.id} input[name="completedStepIds"]`).isDisabled());
  const form = page.locator('[data-run-system-selection]');
  if (!await form.isVisible()) await form.locator('..').locator('summary').first().click();
  await form.getByLabel('裂解体积').selectOption('small'); await form.getByLabel('样本性质').selectOption('normal');
  await form.getByRole('button', { name: /^(确认本次体系|Confirm systems for this run)$/, exact: true }).click();
  await waitRecord(experimentId, e => Boolean(e.protocolRun.executionPlanJson.versions?.[fixture.versionId]));
  await page.locator(`#step-${steps.dose.id}`).getByRole('button',{name:/示例母液取液量/}).click();
  const calculation=page.getByRole('dialog');await calculation.getByLabel(/^(Target concentration|目标浓度)$/).fill('10');
  await calculation.getByRole('button',{name:/^(Calculate and adopt|计算并确认采用)$/}).click();
  await waitRecord(experimentId, e => e.protocolRun.executionPlanJson.versions?.[fixture.versionId]?.calculations.take?.value === 10);
  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'networkidle' });
  const text = await page.locator(`#step-${steps.dose.id}`).innerText(); assert(text.replace(/\s/g,'').includes('50µL')); assert(text.replace(/\s/g,'').includes('10µL'));
  await shot('run-confirmed-desktop');
});
await check('E01 mobile/tablet reflow and D02 calculator return preserve unsaved actual values and notes', async () => {
  for (const width of [1024, 768, 600, 390, 320]) { await page.setViewportSize({ width, height: 1000 }); await page.reload({ waitUntil: 'networkidle' }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow ${width}`); await shot(`run-${width}`); }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^(Next|下一步)$/ }).click();
  const mobile = page.locator('section.lg\\:hidden').first();
  await mobile.getByLabel('实际 Proteinase K').fill('50');
  await mobile.locator('details > summary').filter({ hasText: '记录偏差' }).click();
  await mobile.locator('textarea[name^="mobileDeviation:"]').fill('未保存中文备注');
  await mobile.locator('[data-run-tools]').getByRole('button', { name: /Calculator|计算器/ }).click(); await page.waitForURL(url => url.pathname === '/tools/calculator');
  await page.locator('a[href^="/tools/calculator/molarity"]').first().click(); await page.waitForURL(url => url.pathname === '/tools/calculator/molarity');
  await page.locator(`a[href^="/experiments/${experimentId}/run"]`).first().click(); await page.waitForURL(url => url.pathname.endsWith('/run'));
  await page.waitForFunction(() => document.querySelector('textarea[name^="mobileDeviation:"]')?.value === '未保存中文备注');
  assert.equal(await mobile.getByLabel('实际 Proteinase K').inputValue(), '50');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-run-step-content] img')].filter(i => i.getBoundingClientRect().width > 0).every(i => i.complete && i.naturalWidth > 0));
  assert.equal(await mobile.locator('[data-run-step-content] img').count(), 4);
  await shot('run-mobile-draft-and-images');
  await mobile.getByRole('button', { name: /^(保存实际值|Save actual values)$/, exact: true }).click();
  await waitRecord(experimentId, e => e.protocolRun.executionPlanJson.actualValues?.[steps.dose.id]?.['actual-proteinase']?.value === 50);
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.reload({ waitUntil: 'networkidle' });
});
await check('UI A1 actual-value drafts never display a stale saved receipt and clear after save', async () => {
  const row = page.locator(`#step-${steps.dose.id} [data-structured-step-record]`);
  const input = row.getByLabel('实际 Proteinase K');
  await input.fill('55');
  await row.getByText(/^(未保存修改|Unsaved change)$/, { exact: true }).waitFor();
  assert((await row.innerText()).match(/上次保存：50 µL|Last saved value 50 µL/));
  assert.equal((await record(experimentId)).protocolRun.executionPlanJson.actualValues[steps.dose.id]['actual-proteinase'].value, 50);
  const other = page.locator(`#step-${steps.prepare.id} [data-structured-step-record]`);
  await other.locator('details > summary').click(); await other.getByLabel(/^(跳过原因|Reason for skipping)$/).fill('隔离验收暂时跳过');
  await other.getByRole('button', { name: /^(记录跳过|Record skip)$/, exact: true }).click();
  await waitRecord(experimentId, e => Boolean(e.protocolRun.executionPlanJson.skips[steps.prepare.id]));
  await page.waitForFunction(id => document.querySelector(`#step-${id} input[aria-label="实际 Proteinase K"]`)?.value === '55', steps.dose.id);
  if(!await other.locator('details').evaluate(el=>el.open))await other.locator('details > summary').click(); await other.getByRole('button', { name: /^(撤销跳过|Undo skip)$/, exact: true }).click();
  await waitRecord(experimentId, e => !e.protocolRun.executionPlanJson.skips[steps.prepare.id]);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(id => document.querySelector(`#step-${id} input[aria-label="实际 Proteinase K"]`)?.value === '55', steps.dose.id);
  await row.getByText(/^(未保存修改|Unsaved change)$/, { exact: true }).waitFor(); await shot('actual-value-unsaved-draft');
  await row.locator('details > summary').click();
  const reason = row.getByLabel(/^(跳过原因|Reason for skipping)$/); await reason.fill('未提交的原因草稿');
  let releaseSave, finishSave; const saveGate = new Promise(resolve => { releaseSave = resolve; });
  const saveRouted = new Promise(resolve => { finishSave = resolve; });
  const holdSave = async route => { const saving = route.request().method() === 'POST'; if (saving) await saveGate; await route.continue(); if (saving) finishSave(); };
  await page.route(`**/experiments/${experimentId}/run`, holdSave);
  try {
    await row.getByRole('button', { name: /^(保存实际值|Save actual values)$/, exact: true }).click();
    assert(await reason.isDisabled(), 'Reason must not change while its submitted draft snapshot is being reconciled');
    assert(await input.isDisabled());
  } finally { releaseSave(); await saveRouted; await page.unroute(`**/experiments/${experimentId}/run`, holdSave); }
  await waitRecord(experimentId, e => e.protocolRun.executionPlanJson.actualValues[steps.dose.id]['actual-proteinase'].value === 55);
  await page.waitForFunction(id => document.querySelector(`#step-${id} [data-structured-step-record] details input`)?.value === '未提交的原因草稿', steps.dose.id);
  assert.equal(await reason.inputValue(), '未提交的原因草稿');
  await page.waitForFunction(id => !/未保存修改|Unsaved change/.test(document.querySelector(`#step-${id} [data-structured-step-record]`)?.textContent ?? ''), steps.dose.id);
  assert(await row.getByRole('button', { name: /^(保存实际值|Save actual values)$/, exact: true }).isDisabled());
  await page.reload({ waitUntil: 'networkidle' }); assert.equal(await input.inputValue(), '55');
  assert(!await row.getByText(/^(未保存修改|Unsaved change)$/, { exact: true }).count());
  await input.fill('50'); await row.getByRole('button', { name: /^(保存实际值|Save actual values)$/, exact: true }).click();
  await waitRecord(experimentId, e => e.protocolRun.executionPlanJson.actualValues[steps.dose.id]['actual-proteinase'].value === 50);
  await page.reload({ waitUntil: 'networkidle' });
});
await check('B07 E05 two real tabs reject stale full-form completion instead of undoing newer progress', async () => {
  const stale = await context.newPage(); await stale.goto(`${base}/experiments/${experimentId}/run`, { waitUntil: 'networkidle' });
  await page.locator(`#step-${steps.dose.id} input[name="completedStepIds"]`).check();
  await page.locator(`#step-${steps.prepare.id} input[name="completedStepIds"]`).check();
  await page.getByRole('button', { name: /^(Save progress|保存进度)$/ }).click(); await waitRecord(experimentId, e => [steps.prepare.id, steps.dose.id].every(id => e.steps.find(s => s.id === id).completed));
  await stale.getByRole('button', { name: /^(Save progress|保存进度)$/ }).click();
  await stale.getByText(/执行方案已变更，请刷新/).filter({ visible: true }).first().waitFor(); assert((await record(experimentId)).steps.find(s => s.id === steps.dose.id).completed);
  await stale.screenshot({ path: `${dir}/stale-tab-rejected.png` }); await stale.close(); await page.reload({ waitUntil: 'networkidle' });
});
await check('D03 D04 start refresh pause resume finish timer retains one instance and never completes step', async () => {
  const row = page.locator(`#step-${steps.incubate.id}`);
  const timer = row.locator('section[aria-label="Step timer"]');
  if (!await timer.isVisible()) await row.getByRole('button', { name: /计时器|Timer/ }).first().click();
  await timer.getByRole('button', { name: /^(Start|开始)$/, exact: true }).click();
  const started = await waitRecord(experimentId, e => e.steps.find(s => s.id === steps.incubate.id).timerStartedAt); const start = started.steps.find(s => s.id === steps.incubate.id).timerStartedAt;
  await page.reload({ waitUntil: 'networkidle' }); assert.equal((await record(experimentId)).steps.find(s => s.id === steps.incubate.id).timerStartedAt, start);
  if (!await timer.isVisible()) await row.getByRole('button', { name: /计时器|Timer/ }).first().click();
  await timer.getByRole('button', { name: /^(Pause|暂停)$/, exact: true }).click(); await waitRecord(experimentId, e => e.steps.find(s => s.id === steps.incubate.id).timerPausedAt);
  await timer.getByRole('button', { name: /^(Resume|继续)$/, exact: true }).click(); await waitRecord(experimentId, e => e.steps.find(s => s.id === steps.incubate.id).timerStartedAt);
  await timer.getByRole('button', { name: /^(Pause|暂停)$/, exact: true }).waitFor();
  await timer.getByRole('button', { name: '结束计时（步骤仍需确认）', exact: true }).click();
  const finished = await waitRecord(experimentId, e => e.steps.find(s => s.id === steps.incubate.id).timerRemainingSeconds === 0); assert(!finished.steps.find(s => s.id === steps.incubate.id).completed);
  await shot('timer-finished-not-completed');
});
await check('B06 continuation displays original treatment and starts at explicit remaining operation', async () => {
  await go(`/experiments/${fixture.continuationId}/run`); assert((await page.locator('.app-shell-main').innerText()).includes('此前已完成'));
  assert((await page.locator('.app-shell-main').innerText()).includes('50 µL'));
  const continued = await record(fixture.continuationId); assert.equal(continued.steps.length, 2); assert.equal(continued.steps[0].protocolStepRef, `${fixture.versionId}:incubate`);
  await shot('continuation-history');
});
await check('F03 actual JSON Markdown CSV XLSX DOCX and print files preserve adopted quantities and source', async () => {
  await go(`/experiments/${experimentId}`);
  await page.pdf({ path: `${dir}/experiment-preview.pdf`, format: 'A4', printBackground: true });
  for (const format of ['json', 'md', 'csv', 'xlsx']) {
    const response = await page.request.get(`${base}/api/structured-export/experiments?format=${format}&exportScope=selected&id=${experimentId}`); assert.equal(response.status(), 200, `${format}: ${response.status() === 200 ? '' : await response.text()}`);
    const bytes = await response.body(); await writeFile(`${dir}/experiment.${format}`, bytes);
    const text = format === 'xlsx' ? JSON.stringify(await readXlsxFile(bytes)) : bytes.toString(); assert(text.replace(/\s/g,'').includes('50µL'), format); assert(text.replace(/\s/g,'').includes('10µL'), format); assert(text.includes(fixture.protocolCode), `${format}: source Protocol code`); assert(text.includes(fixture.displayVersion), `${format}: source version`);
  }
  const docx = await page.request.get(`${base}/api/protocols/${fixture.protocolId}/versions/${fixture.versionId}/docx`); assert.equal(docx.status(), 200); await writeFile(`${dir}/protocol.docx`, await docx.body());
  for (const format of ['json', 'md', 'xlsx']) {
    const response = await page.request.get(`${base}/api/structured-export/protocols?format=${format}&exportScope=selected&id=${fixture.protocolId}`); assert.equal(response.status(),200);
    const bytes = await response.body(); await writeFile(`${dir}/protocol.${format}`,bytes);
    const text = format === 'xlsx' ? JSON.stringify(await readXlsxFile(bytes)) : bytes.toString();
    assert(text.replace(/\s/g,'').includes('50µL') && text.replace(/\s/g,'').includes('80µL'),format);
  }
});
await check('E01 actual light/dark responsive Run retains readable system labels and scoped spacing', async () => {
  for (const mode of ['light','dark']) for (const width of [1440,390]) {
    await page.emulateMedia({colorScheme:mode}); await page.setViewportSize({width,height:1000});
    await go(`/experiments/${experimentId}/run`);
    assert.equal(await page.locator('html').getAttribute('data-labnest-mode'),mode);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1));
    assert(await page.locator('.protocol-system-preparation').evaluate(el=>parseFloat(getComputedStyle(el).paddingLeft)>=12));
    await shot(`final-run-${mode}-${width}`);
  }
});
assert.deepEqual(errors, []);
} finally {
  report.pageErrors = errors; await context.tracing.stop({ path: `${dir}/browser-trace.zip` }); await browser.close(); await writeFile(`${dir}/browser-report.json`, JSON.stringify(report, null, 2));
}
