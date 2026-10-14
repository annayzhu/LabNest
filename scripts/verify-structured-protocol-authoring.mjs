import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const base = process.env.LABNEST_E2E_BASE_URL ?? 'http://localhost:3338', dir = 'docs/structured-protocol/20261014/evidence';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname) && new URL(base).port !== '3001');
const fixture = JSON.parse(await readFile(`${dir}/fixtures.json`, 'utf8'));
const browser = await chromium.launch(), context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage(), report = { head: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), checks: [], browser: browser.version(), images: [] };
context.setDefaultTimeout(20000);
const readDocument = async () => JSON.parse(await page.locator('input[name="contentJson"]').inputValue());
const check = async (name, fn) => { try { await fn(); report.checks.push({ name, result: '通过' }); console.log('PASS', name); } catch (e) { report.checks.push({ name, result: '失败', error: e.message }); await page.screenshot({ path: `${dir}/author-failure.png` }); throw e; } };
const save = async () => {
  const panel = page.locator('.context-properties[aria-hidden="false"]');
  if (await panel.count()) await panel.getByRole('button', { name: '返回主界面继续填写或保存', exact: true }).click();
  await page.locator('.protocol-workbench-save button[type="submit"]').click();
  await page.waitForURL(u => /^\/protocols\/[^/]+$/.test(u.pathname) && !u.pathname.endsWith('/new'));
};
let createdId, createdVersion, parameterId;
try {
await check('13.1 author two systems and conditional parameter using the real empty Protocol UI', async () => {
  await page.goto(`${base}/protocols/new`, { waitUntil: 'networkidle' });
  await page.getByLabel('Protocol title', { exact: true }).fill('合成验收 · 从空白编写两体系');
  const systems = page.locator('[data-protocol-systems-editor]'); await systems.locator('summary').click();
  await systems.getByRole('button', { name: '设置实验体系', exact: true }).click();
  await systems.getByRole('button', { name: '添加选择维度', exact: true }).click();
  await systems.getByLabel('维度名称').fill('裂解体积');
  await systems.getByRole('tab', { name: '参数', exact: true }).click(); await systems.getByRole('button', { name: '添加参数', exact: true }).click();
  await systems.getByLabel('参数名称').fill('Proteinase K');
  await systems.getByLabel('参数来源').selectOption('lookup');
  for (const [index, value] of ['50', '80'].entries()) {
    await systems.getByRole('button', { name: '添加条件取值', exact: true }).click();
    const row = systems.locator('fieldset.protocol-system-item > div.protocol-system-item').nth(index);
    await row.getByRole('button', { name: '添加条件', exact: true }).click();
    await row.getByLabel('条件 1 的选项').selectOption({ label: index ? '600 µL' : '350 µL' }); await row.getByLabel('取值', { exact: true }).fill(value);
  }
  parameterId = (await readDocument()).systems.parameters[0].id;
  // Use existing heading/list/paragraph commands, not editor-state injection.
  const paragraph = page.locator('#protocol-section-steps [data-node-view-content] p').first();
  await paragraph.click(); await page.keyboard.type('加入试剂'); await page.keyboard.press('ControlOrMeta+Alt+2'); await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('取液 ');
  await page.getByLabel('待插入参数').selectOption(parameterId); await page.getByRole('button', { name: '插入参数', exact: true }).click();
  await page.keyboard.press('End'); await page.keyboard.type('，混匀。');
  const organizer = page.locator('[data-execution-organizer]'); await organizer.locator('summary').click(); await organizer.getByRole('button', { name: '整理／拆分步骤', exact: true }).click();
  await organizer.getByLabel('第 1 块的归属', { exact: true }).selectOption('step'); await organizer.getByLabel('第 1 块的步骤标题', { exact: true }).fill('加入试剂');
  const firstId = (await readDocument()).sections.find(s => s.key === 'steps').blocks[0].execution.stepId;
  await organizer.getByLabel('第 2 块的归属', { exact: true }).selectOption(firstId); await organizer.getByRole('button', { name: '确认以上划分', exact: true }).click();
  // Type after role confirmation to detect lost split-block ownership.
  await page.locator('#protocol-section-steps [data-node-view-content] p').last().click(); await page.keyboard.press('End'); await page.keyboard.type('操作确认后继续输入。');
  await page.screenshot({ path: `${dir}/author-two-systems.png` });
  await save(); createdId = page.url().split('/').pop(); const jsonHref = await page.locator('a[href$="/json"]').getAttribute('href'); createdVersion = jsonHref.split('/')[5];
  report.protocolId = createdId; report.versionId = createdVersion;
  const read = await (await page.request.get(base + jsonHref)).json(); assert.equal(read.document.systems.parameters[0].source.values[0].value, 50); assert.equal(read.structuredProjection.steps.length, 1); assert(read.structuredProjection.steps[0].description.includes('操作确认后继续输入'));
  await page.goto(`${base}/protocols/${createdId}/versions/${createdVersion}/edit`, { waitUntil: 'networkidle' });
  const reopened = await readDocument(); assert.equal(reopened.systems.parameters[0].id, parameterId); assert(reopened.executionConfirmed); assert.equal(reopened.systems.dimensions[0].options.length, 2);
  await page.goto(`${base}/experiments/new?plan=${fixture.planId}&protocolVersionId=${createdVersion}`, { waitUntil: 'networkidle' }); await page.locator('.document-page-title-input').fill('真实编写规程创建的合成实验');
  await page.getByRole('button', { name: /^(Save Experiment|保存实验)$/ }).click(); await page.waitForURL(u => /^\/experiments\/[^/]+$/.test(u.pathname) && !u.pathname.endsWith('/new'));
  const id = page.url().split('/').pop(); report.experimentId = id; await page.goto(`${base}/experiments/${id}/run`, { waitUntil: 'networkidle' });
  const form = page.locator('[data-run-system-selection]'); await form.getByLabel('裂解体积').selectOption({ label: '350 µL' }); await form.getByRole('button', { name: '确认本次体系', exact: true }).click();
  await page.getByText('50 µL', { exact: true }).first().waitFor(); await page.screenshot({ path: `${dir}/authored-protocol-run.png` });
});
await check('C01 C03 C07 C08 long source formatting, table editing, unit source separation and save/reopen preserve frozen runs', async () => {
  const before = (await (await page.request.get(`${base}/api/experiments/${fixture.experimentId}`)).json()).experiment;
  await page.goto(`${base}/protocols/${fixture.protocolId}/versions/${fixture.versionId}/edit`, { waitUntil: 'networkidle' });
  const initial = await readDocument(); report.documentBytes = JSON.stringify(initial).length; report.longParagraphs = initial.sections.find(s => s.key === 'background').blocks.reduce((n,b)=>n+(b.nodes?.length ?? 1),0);
  const paragraph = page.locator('#protocol-section-background [data-node-view-content] p').nth(35);
  await paragraph.click();
  const beforeY = await paragraph.evaluate(el => el.getBoundingClientRect().top);
  await page.keyboard.type('持续输入测试 ABC 123；中英文标点。'); await page.getByRole('button', { name: 'Bold', exact: true }).click(); await page.keyboard.type('加粗'); await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await page.getByRole('button', { name: 'Redo', exact: true }).click();
  const afterY = await paragraph.evaluate(el => el.getBoundingClientRect().top); report.scrollChangePx = Math.abs(afterY - beforeY); assert(Math.abs(afterY-beforeY) < 200);
  const table = page.locator('#protocol-section-steps table'); await table.locator('td').first().click(); await page.keyboard.press('End'); await page.keyboard.type('（回读测试）');
  const close = page.getByRole('button', { name: 'Close selected block settings', exact: true }); if(await close.isVisible()) await close.click(); await page.keyboard.type('选区保留');
  const systems = page.locator('[data-protocol-systems-editor]'); await systems.locator('summary').click(); await systems.getByRole('tab', { name: '参数', exact: true }).click();
  const proteinase = systems.locator('fieldset').filter({ has: page.locator('legend', { hasText: 'Proteinase K' }) });
  await proteinase.getByLabel('显示单位').fill('mL');
  const changed = (await readDocument()).systems.parameters.find(p => p.id === 'proteinase'); assert.equal(changed.unit, 'mL'); assert.deepEqual(changed.source, initial.systems.parameters.find(p=>p.id==='proteinase').source);
  await save(); await page.goto(`${base}/protocols/${fixture.protocolId}/versions/${fixture.versionId}/edit`, { waitUntil: 'networkidle' });
  const saved = await readDocument(); assert(JSON.stringify(saved).includes('持续输入测试')); assert(JSON.stringify(saved).includes('选区保留')); assert.equal(saved.systems.parameters.find(p=>p.id==='proteinase').unit,'mL');
  assert.deepEqual((await (await page.request.get(`${base}/api/experiments/${fixture.experimentId}`)).json()).experiment.protocolSnapshotJson, before.protocolSnapshotJson);
  assert.equal(saved.sections.flatMap(s=>s.blocks).filter(b=>b.type==='media').length,4);
  await page.screenshot({ path: `${dir}/long-editor-reopened.png` });
});
} finally { await context.tracing.stop({ path: `${dir}/author-trace.zip` }); await browser.close(); await writeFile(`${dir}/author-report.json`, JSON.stringify(report, null, 2)); }
