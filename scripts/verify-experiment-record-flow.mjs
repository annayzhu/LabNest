import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.LABNEST_E2E_BASE_URL ?? 'http://127.0.0.1:3342';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname) && new URL(base).port !== '3001', 'Isolated acceptance server only.');
const dir = process.env.LABNEST_QA_DIR ?? 'outputs/experiment-record-flow';
const fixture = JSON.parse(await readFile(`${dir}/fixtures.json`, 'utf8'));
assert(fixture.synthetic);
await mkdir(dir, { recursive: true });
const packaged = process.env.LABNEST_QA_CHROMIUM_PACKAGE ? (await import(process.env.LABNEST_QA_CHROMIUM_PACKAGE)).default : null;
const browser = await chromium.launch(packaged ? { args: packaged.args, executablePath: process.env.LABNEST_QA_CHROMIUM_EXECUTABLE ?? await packaged.executablePath() } : {});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
await context.addCookies([{ name: 'labnest_locale', value: 'zh', url: base }]);
const page = await context.newPage(), errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.setDefaultTimeout(30000);
const record = async id => (await (await page.request.get(`${base}/api/experiments/${id}`)).json()).experiment;
const go = path => page.goto(base + path, { waitUntil: 'networkidle', timeout: 120000 });
const check = async (name, action) => { await action(); checks.push(name); console.log('PASS', name); };
const shot = name => page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
let newId;
try {
  await check('New experiment opens metadata and permits an unassigned custom experiment', async () => {
    await go('/experiments/new');
    await page.locator('.context-properties:not([hidden])').waitFor();
    assert.equal(await page.locator('select[name="researchPlanId"]').inputValue(), '');
    await page.locator('select[name="researchPlanId"]').selectOption(fixture.planId);
    await page.locator('select[name="researchPlanId"]').selectOption('');
    await page.getByLabel('自行记录', { exact: true }).check();
    assert.equal(await page.getByText('No step-by-step checklist for this custom protocol.', { exact: false }).count(), 0);
    await page.locator('input[name="title"]').fill('合成验收 · 未选择研究计划');
    await shot('new-metadata-desktop');
    await page.getByRole('button', { name: '返回主界面继续填写或保存' }).click();
    await page.locator('button[type="submit"]').filter({ hasText: /保存实验|Save Experiment/ }).click();
    await page.waitForURL(url => /^\/experiments\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/new'));
    newId = page.url().split('/').pop();
    assert.equal((await record(newId)).researchPlanId, null);
    await go(`/experiments/${newId}/edit`);
    await page.locator('.ln-scientific-tiptap').waitFor();
    assert.equal(await page.locator('input[name="researchPlanId"]').inputValue(), '');
  });
  await check('Multiple protocols retain round numbered badges and preview inside Execution notes', async () => {
    await go(`/experiments/new?protocolVersionId=${fixture.versionIds[0]}`);
    await page.locator('.context-properties:not([hidden])').waitFor();
    for (const title of ['合成验收规程 2', '合成验收规程 3']) await page.getByRole('button').filter({ hasText: title }).filter({ hasText: '添加' }).click();
    assert.equal(await page.locator('.experiment-protocol-selection-row').count(), 3);
    const badges = await page.locator('.experiment-protocol-selection-row > span:first-child').evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
    assert(badges.every(b => Math.abs(b.width - b.height) < 1 && b.width >= 27));
    assert.equal(await page.locator('[data-section-key="execution"] [data-execution-protocol]').count(), 3);
    assert.equal(await page.locator('.document-editor-main > [data-protocol-execution-preview]').count(), 0);
    await shot('protocol-picker-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await shot('protocol-picker-mobile');
  });
  await check('Inline system selection projects steps and preserves rich-text drafts across step/deviation saves', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await go(`/experiments/${fixture.experimentId}/edit`);
    await page.locator('.ln-scientific-tiptap').waitFor();
    const recordBefore = await record(fixture.experimentId);
    const first = recordBefore.steps.find(s => s.groupKey === fixture.versionIds[0] && s.protocolStepRef.endsWith(':prepare'));
    const dose = recordBefore.steps.find(s => s.groupKey === fixture.versionIds[0] && s.protocolStepRef.endsWith(':dose'));
    const large = recordBefore.steps.find(s => s.groupKey === fixture.versionIds[0] && s.protocolStepRef.endsWith(':large'));
    const step = id => page.locator(`[data-execution-step="${id}"]`);
    assert(await step(dose.id).getByRole('checkbox').isDisabled());
    const prose = page.locator('[data-section-key="execution"] [data-node-view-content-react]').last();
    await prose.getByText('既有执行正文，保存偏差时必须保留。', { exact: true }).click();
    await page.keyboard.press('End'); await page.keyboard.insertText(' 未保存的中文草稿。');
    const selection = page.locator('[data-run-system-selection]');
    await selection.getByLabel('反应体系').selectOption('small');
    await selection.getByRole('button', { name: '确认本次体系', exact: true }).click();
    await page.waitForFunction(id => document.querySelector(`[data-execution-step="${id}"]`)?.getAttribute('data-applicability') === 'not-applicable', large.id);
    assert(await step(large.id).getByRole('checkbox').isDisabled());
    assert((await step(dose.id).innerText()).includes('10 µL'));
    await step(first.id).getByRole('checkbox').click();
    await page.waitForFunction(id => document.querySelector(`[data-execution-step="${id}"] input`)?.checked, first.id);
    await step(first.id).getByText('记录偏差', { exact: true }).click();
    await step(first.id).getByRole('textbox').fill('实际延长 5 分钟');
    await step(first.id).getByRole('button', { name: '保存偏差', exact: true }).click();
    await page.locator('[data-section-key="deviations"]').getByText('偏差：实际延长 5 分钟', { exact: false }).waitFor();
    assert((await prose.innerText()).includes('未保存的中文草稿'));
    assert(!(await step(first.id).innerText()).includes('偏差：实际延长 5 分钟'));
    await page.locator('button[type="submit"]').filter({ hasText: /保存实验|Save Experiment/ }).click();
    await page.waitForURL(`${base}/experiments/${fixture.experimentId}`);
    const saved = await record(fixture.experimentId);
    assert(saved.steps.find(s => s.id === first.id).completed);
    assert.equal(saved.steps.find(s => s.id === first.id).deviationNote, '实际延长 5 分钟');
    assert(JSON.stringify(saved.contentJson).includes('未保存的中文草稿'));
    assert(!JSON.stringify(saved.contentJson).includes('run-derived:'));
    assert.equal(saved.researchPlanId, null);
  });
  await check('Document header, final observations, outline stability and responsive widths', async () => {
    assert((await page.locator('.ln-experiment-brief').innerText()).includes('实验日期：2026-10-14'));
    assert(!(await page.locator('.ln-experiment-brief').innerText()).includes('方法来源'));
    const sections = page.locator('.document-section');
    assert.equal(await sections.last().getAttribute('id'), 'section-observations');
    const outline = page.locator('.document-editor-outline');
    for (const id of ['section-execution', 'section-deviations', 'section-observations', 'section-execution']) {
      await outline.locator(`[aria-controls="${id}"]`).click();
      const position = await page.evaluate(() => window.scrollY);
      await page.waitForTimeout(450);
      assert.equal(await outline.locator('[aria-current="location"]').getAttribute('aria-controls'), id);
      assert(Math.abs((await page.evaluate(() => window.scrollY)) - position) < 2);
    }
    await shot('execution-desktop');
    for (const width of [768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `horizontal overflow at ${width}`);
      if (width === 390) await shot('execution-mobile');
    }
    assert.equal(await page.locator('form form').count(), 0);
    assert.deepEqual(errors, []);
  });
} catch (error) {
  await shot('failure');
  await writeFile(`${dir}/failure.html`, await page.content());
  await writeFile(`${dir}/report.json`, JSON.stringify({ checks, errors, failure: error.message }, null, 2));
  throw error;
} finally { await browser.close(); }
await writeFile(`${dir}/report.json`, JSON.stringify({ checks, errors, browser: browser.version(), widths: [1440, 768, 390, 320], synthetic: true, newId }, null, 2));
