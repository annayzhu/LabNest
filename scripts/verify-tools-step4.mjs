// CNV plate planning and Visualization from "/": the real path, saved into a record. Writes to the database behind
// BASE_URL, so point it only at a test instance. VISUALIZATION_STUDIO_URL must be set on that instance.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { useChineseInterface } from './qpcr-browser-helpers.mjs';

const base = process.env.BASE_URL;
assert.ok(base && !/:3001\b/.test(base), 'Set BASE_URL to a test instance, never 3001');
const out = process.argv[2] ?? 'tools-step4-evidence';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
await useChineseInterface(context, base);
const page = await context.newPage();
const errors = [], passed = [];
page.on('pageerror', (error) => errors.push(`${page.url().replace(base, '')} ${error.message.slice(0, 80)}`));
const check = async (name, run) => {
  try { await run(); } catch (error) { await page.screenshot({ path: `${out}/failed.png` }).catch(() => undefined); throw error; }
  passed.push(name); console.log('PASS', name);
};
const workspace = page.locator('.tool-record-workspace');
const tool = page.frameLocator('.tool-record-workspace iframe');
const saveButton = (name) => workspace.locator('header').getByRole('button', { name, exact: true });
const slash = async (search, option) => {
  await page.locator('.tiptap').filter({ visible: true }).first().waitFor();
  await page.locator('.tiptap p:not(.tool-output p)').filter({ visible: true }).last().click();
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.keyboard.type(`/${search}`);
  await page.getByRole('option', { name: option }).first().click();
};
/** Chooses a label column and a number column in the studio, as a person does under Data and mapping. */
const mapColumns = async () => {
  const x = tool.locator('label', { hasText: /X-axis/ }).locator('select').first(), y = tool.locator('label', { hasText: /Y-axis/ }).locator('select').first();
  const names = await x.locator('option').allTextContents();
  await x.selectOption({ label: names.find((name) => /组分|基因|项目/.test(name)) ?? names[1] });
  const values = await y.locator('option').allTextContents();
  await y.selectOption({ label: values.find((name) => /合计|µL|结果/.test(name)) ?? values.at(-1) });
  await tool.locator('svg[role="img"], [data-visualization-workbench] figure svg').first().waitFor({ timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(600);
};
const firstRecord = async (list) => {
  await page.goto(`${base}${list}`);
  const hrefs = await page.locator(`a[href^="${list}/"]`).evaluateAll((links, prefix) => [...new Set(links.map((link) => link.getAttribute('href')).filter((href) => new RegExp(`^${prefix}/(?!new|import|export)[^/]+$`).test(href)))], list);
  for (const href of hrefs) {
    await page.goto(`${base}${href}/edit`);
    if (await page.locator('.tiptap').filter({ visible: true }).first().waitFor({ timeout: 6000 }).then(() => true, () => false)) return href;
  }
  throw new Error(`No editable record under ${list}`);
};

try {
  const experiment = await firstRecord('/experiments');
  const count = (name) => page.locator(`.tiptap .tool-output-${name}`).count();
  const before = await count('cnv-plate-layout');

  await check('CNV planning: refuses to save without a layout, then saves plates as data', async () => {
    await slash('cnv', /^CNV 排板/);
    await saveButton('保存到计划').and(page.locator(':enabled')).waitFor({ timeout: 20000 });
    await page.screenshot({ path: `${out}/cnv-empty.png` });
    await saveButton('保存到计划').click();
    await workspace.getByRole('alert').filter({ hasText: '请先生成板布局' }).waitFor();
    await tool.getByRole('button', { name: /载入示例/ }).first().click();
    await tool.getByRole('button', { name: /生成板布局|生成/ }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/cnv-plate.png` });
    await saveButton('保存到计划').click();
    await workspace.waitFor({ state: 'detached', timeout: 20000 });
    const block = page.locator('.tiptap .tool-output-cnv-plate-layout').nth(before);
    await block.waitFor();
    assert.match(await block.innerText(), /CNV 板布局与配液/);
    assert.ok(await block.locator('.ln-plate-grid, [class*="plate"]').count(), 'The plate shows as a plate block');
    await page.waitForTimeout(400);
    await block.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/cnv-block.png` });
  });

  await check('CNV planning: reopens with its plan, and a second one is its own block', async () => {
    await page.goto(`${base}${experiment}/edit`);
    const block = page.locator('.tiptap .tool-output-cnv-plate-layout').nth(before);
    await block.getByRole('button', { name: '编辑布局' }).click();
    await tool.locator('.well:not(.empty)').first().waitFor({ timeout: 20000 });
    await saveButton('保存到计划').click();
    await workspace.waitFor({ state: 'detached', timeout: 20000 });
    assert.equal(await count('cnv-plate-layout'), before + 1, 'Saving again updates the same block');
    await slash('cnv', /^CNV 排板/);
    await saveButton('保存到计划').and(page.locator(':enabled')).waitFor({ timeout: 20000 });
    await tool.getByRole('button', { name: /载入示例/ }).first().click();
    await tool.getByRole('button', { name: /生成板布局|生成/ }).first().click();
    await page.waitForTimeout(400);
    await saveButton('保存到计划').click();
    await workspace.waitFor({ state: 'detached', timeout: 20000 });
    assert.equal(await count('cnv-plate-layout'), before + 2);
  });

  await check('Visualization: opens with the record tables, saves a figure, reopens it', async () => {
    const figures = await count('visualization-studio');
    await slash('keshihua', /^可视化/);
    await saveButton('插入图表').and(page.locator(':enabled')).waitFor({ timeout: 25000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/studio-open.png` });
    const picker = tool.getByLabel(/这条记录里的表格|Table from this record/);
    assert.ok(await picker.count(), 'The record tables are offered');
    assert.ok((await picker.locator('option').count()) >= 2, 'Several tables to choose from');
    assert.equal(await tool.getByText('Visualization Studio', { exact: true }).count(), 0, 'The studio does not repeat its name');
    assert.equal(await tool.getByRole('region', { name: 'Project workspace' }).count(), 0, 'Saved projects stay out of a record');
    // The studio never guesses which column means what: saving is refused until a person chooses.
    await saveButton('插入图表').click();
    await workspace.getByRole('alert').filter({ hasText: '选好用哪几列' }).waitFor();
    await mapColumns();
    await page.screenshot({ path: `${out}/studio-mapped.png` });
    await saveButton('插入图表').click();
    await page.locator('.tiptap .tool-output-visualization-studio').nth(figures).waitFor({ timeout: 30000 });
    const block = page.locator('.tiptap .tool-output-visualization-studio').nth(figures);
    assert.ok(await block.locator('img').evaluate(async (image) => { await image.decode(); return image.naturalWidth > 0; }), 'The figure loads');
    await page.waitForTimeout(300);
    await block.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/studio-block.png` });
    await page.reload();
    await page.locator('.tiptap .tool-output-visualization-studio').nth(figures).waitFor({ timeout: 20000 });
    await page.locator('.tiptap .tool-output-visualization-studio').nth(figures).getByRole('button', { name: '继续作图' }).click();
    await saveButton('插入图表').and(page.locator(':enabled')).waitFor({ timeout: 25000 });
    await page.getByRole('button', { name: '返回记录', exact: true }).click();
    await workspace.waitFor({ state: 'detached', timeout: 20000 });
  });

  await check('Quick entry: CNV planning and a figure land in the page and are saved with it', async () => {
    await page.goto(`${base}/entries/new`);
    await page.locator('input[aria-label="Entry title"], input[aria-label="记录标题"]').filter({ visible: true }).first().fill(`合成记录 step4 ${Date.now()}`);
    await slash('cnv', /^CNV 排板/);
    await saveButton('插入记录').and(page.locator(':enabled')).waitFor({ timeout: 20000 });
    await tool.getByRole('button', { name: /载入示例/ }).first().click();
    await tool.getByRole('button', { name: /生成板布局|生成/ }).first().click();
    await page.waitForTimeout(400);
    await saveButton('插入记录').click();
    await workspace.waitFor({ state: 'detached', timeout: 20000 });
    await page.waitForTimeout(400);
    await page.keyboard.type('/keshihua');
    await page.getByRole('option', { name: /^可视化/ }).first().click();
    await saveButton('插入图表').and(page.locator(':enabled')).waitFor({ timeout: 25000 });
    await page.waitForTimeout(800);
    await mapColumns();
    await saveButton('插入图表').click();
    await workspace.waitFor({ state: 'detached', timeout: 30000 });
    await page.getByRole('button', { name: /^保存快速记录/ }).filter({ visible: true }).last().click();
    await page.waitForURL(/\/entries\/(?!new)[^/]+(\?.*)?$/, { timeout: 30000 });
    await page.getByRole('article').locator('.tool-output-cnv-plate-layout').waitFor();
    await page.getByRole('article').locator('.tool-output-visualization-studio').waitFor();
    assert.equal(await page.getByText(/-r1\.json|-r1-data\.tsv/).count(), 0, 'Tool files stay out of the attachment list');
  });

  const measures = {};
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080], [820, 1180], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${base}${experiment}/edit`);
    await slash('cnv', /^CNV 排板/);
    await saveButton('保存到计划').and(page.locator(':enabled')).waitFor({ timeout: 20000 });
    await page.waitForTimeout(400);
    // Going back to the record keeps the plan as a draft, so later widths reopen on it.
    const example = tool.getByRole('button', { name: /载入示例/ }).first();
    if (await example.count()) { await example.click(); await tool.getByRole('button', { name: /生成板布局|生成/ }).first().click(); await page.waitForTimeout(600); }
    await tool.locator('.main-area').evaluate((area) => area.scrollTo(0, 0));
    await page.screenshot({ path: `${out}/cnv-${width}.png` });
    measures[width] = { cnv: await tool.locator('html').evaluate((html) => {
      const plate = html.querySelector('.plate-grid');
      const box = plate?.getBoundingClientRect();
      const texts = [...html.querySelectorAll('body *')].filter((el) => el.getClientRects().length && [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim()));
      return { plateWidth: Math.round(box?.width ?? 0), plateTop: Math.round(box?.top ?? 0), plateBottom: Math.round(box?.bottom ?? 0), well: Math.round(html.querySelector('.well')?.getBoundingClientRect().width ?? 0), minText: Math.min(...texts.map((el) => parseFloat(getComputedStyle(el).fontSize))), sideScroll: html.scrollWidth > html.clientWidth };
    }) };
    await page.getByRole('button', { name: '返回记录', exact: true }).click();
    await workspace.waitFor({ state: 'detached', timeout: 20000 });
    await page.locator('.tiptap').filter({ visible: true }).first().waitFor();
    await page.goto(`${base}${experiment}/edit`);
    await slash('keshihua', /^可视化/);
    await saveButton('插入图表').and(page.locator(':enabled')).waitFor({ timeout: 25000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/studio-${width}.png` });
    measures[width].studio = await tool.locator('html').evaluate((html) => ({ figure: Math.round(html.querySelector('svg[role="img"], [data-visualization-workbench] svg')?.getBoundingClientRect().width ?? 0), sideScroll: html.scrollWidth > html.clientWidth }));
    await page.getByRole('button', { name: '返回记录', exact: true }).click();
    await workspace.waitFor({ state: 'detached', timeout: 20000 });
  }
  console.log(JSON.stringify(measures));
  const faults = errors.filter((message) => !message.includes('React error #418'));
  console.log('page errors', JSON.stringify([...new Set(errors)]));
  assert.deepEqual(faults, [], 'Page errors');
  console.log(JSON.stringify({ passed: passed.length }));
} finally {
  await browser.close();
}
