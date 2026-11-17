// Drag-to-swap and copy/paste in both plate planners, driven through LabNest's /tools pages
// with a real mouse and keyboard (Q464–Q476). Synthetic data only.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3002';
const evidence = path.resolve(process.env.EVIDENCE_DIR ?? '.local-runtime/plate-drag-copy-20261116/evidence');
await mkdir(evidence, { recursive: true });
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
const sizes = [[1366, 768], [1440, 900], [1920, 1080]];
const report = { free: {}, qpcr: {}, screenshots: [] };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
await context.addCookies([{ name: 'labnest_locale', value: 'zh', url: base }]);
await context.addInitScript(() => localStorage.setItem('labnest.locale', 'zh'));
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

// Both planners re-fit the plate a frame after a resize; measure wells only after that.
async function resize(width, height) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(400);
}

async function shot(name) {
  const file = path.join(evidence, `${name}.png`);
  await page.screenshot({ path: file });
  report.screenshots.push(file);
}

async function center(locator) {
  const box = await locator.boundingBox();
  assert.ok(box, 'well must be visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function pressAndDrag(from, to) {
  const a = await center(from);
  const b = await center(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 8, a.y + 8, { steps: 2 });
  await page.mouse.move(b.x, b.y, { steps: 10 });
}

async function hintClasses(frame, selector, ids, pattern) {
  return frame.locator('body').evaluate((body, { selector, ids, pattern }) => Object.fromEntries(ids.map((id) => {
    const element = body.querySelector(selector.replace('$', id));
    return [id, element ? [...element.classList].filter((name) => new RegExp(pattern).test(name)) : null];
  })), { selector, ids, pattern });
}

async function minFontAndOverflow(frame) {
  return frame.locator('body').evaluate((body) => {
    const sizes = [...body.querySelectorAll('*')]
      .filter((element) => element.getClientRects().length && [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()))
      .map((element) => parseFloat(getComputedStyle(element).fontSize));
    return { minFont: Math.min(...sizes), overflowX: body.scrollWidth > innerWidth + 1 };
  });
}

// ---------- Free plate layout ----------
{
  // The free planner is served as a static page, not inside a host frame.
  await page.goto(`${base}/tools/free-plate-layout/index.html`);
  const frame = page;
  await frame.locator('.plate-option[data-size="96"]').click();
  const well = (id) => frame.locator(`[data-well="${id}"]`);
  const sample = async (id) => (await well(id).locator('.well-primary').allInnerTexts())[0] ?? '';
  async function assign(ids, value) {
    await well(ids[0]).click();
    for (const id of ids.slice(1)) await well(id).click({ modifiers: [mod] });
    await frame.locator('.parameter-input-row').filter({ hasText: '样本' }).locator('.parameter-value').fill(value);
    await frame.locator('#applyParametersButton').click();
  }
  for (const [id, value] of [['A1', '合成样本甲-处理组-长名称'], ['A2', '合成样本乙'], ['A3', '合成样本丙'], ['A4', '合成样本丁'], ['C1', '对照-1']]) await assign([id], value);

  await well('A1').click();
  await well('A3').click({ modifiers: ['Shift'] });
  let preview;
  for (const [width, height] of sizes) {
    await resize(width, height);
    await pressAndDrag(well('A2'), well('A3'));
    preview ??= await hintClasses(frame, '[data-well="$"]', ['A1', 'A2', 'A3', 'A4'], '^drop-');
    await shot(`free-drag-preview-${width}`);
    // Escape abandons the drag; nothing may change.
    await page.keyboard.press('Escape');
    await page.mouse.up();
  }
  assert.equal(await sample('A1'), '合成样本甲-处理组-长名称', 'Escape must cancel the drag');
  await pressAndDrag(well('A2'), well('A3'));
  await page.mouse.up();
  report.free.dragPreview = preview;
  assert.deepEqual(preview.A1, []);
  assert.ok(preview.A2.includes('drop-landing') && preview.A4.includes('drop-swap'), JSON.stringify(preview));
  report.free.afterRotate = [await sample('A1'), await sample('A2'), await sample('A3'), await sample('A4')];
  assert.deepEqual(report.free.afterRotate, ['合成样本丁', '合成样本甲-处理组-长名称', '合成样本乙', '合成样本丙']);

  await page.keyboard.press(`${mod}+c`);
  await assign(['E6'], '已有内容');
  await well('A2').click();
  await well('A4').click({ modifiers: ['Shift'] });
  await page.keyboard.press(`${mod}+c`);
  const target = await center(well('E5'));
  await page.mouse.move(target.x, target.y);
  report.free.pastePreview = await hintClasses(frame, '[data-well="$"]', ['E5', 'E6', 'E7', 'E8'], '^paste-');
  for (const [width, height] of sizes) {
    await resize(width, height);
    const point = await center(well('E5'));
    await page.mouse.move(point.x, point.y);
    await shot(`free-paste-preview-${width}`);
    report.free[`metrics${width}`] = await minFontAndOverflow(frame);
  }
  assert.ok(report.free.pastePreview.E6.includes('paste-overwrite'), JSON.stringify(report.free.pastePreview));
  await page.keyboard.press(`${mod}+v`);
  report.free.afterPaste = [await sample('E5'), await sample('E6'), await sample('E7')];
  assert.deepEqual(report.free.afterPaste, ['合成样本甲-处理组-长名称', '合成样本乙', '合成样本丙']);
  await page.keyboard.press('Escape');
  assert.equal(await frame.locator('.paste-target, .paste-overwrite').count(), 0);
}

// ---------- qPCR plate layout ----------
{
  await resize(1440, 900);
  await page.goto(`${base}/tools/qpcr-plate-layout`);
  const frame = page.frameLocator('iframe').first();
  await frame.getByRole('button', { name: '载入示例', exact: true }).click();
  await frame.getByRole('button', { name: '生成布局', exact: true }).click();
  const cell = (id) => frame.locator(`button[data-well-id="${id}"]`);
  await cell('A1').waitFor();
  const label = async (id) => (await cell(id).getAttribute('aria-label')).replace(/^[A-P]\d+，/, '');
  const before = {};
  for (const id of ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'H12']) before[id] = await label(id);
  report.qpcr.before = before;

  await cell('A1').click();
  await cell('A3').click({ modifiers: ['Shift'] });
  for (const [width, height] of sizes) {
    await resize(width, height);
    await pressAndDrag(cell('A2'), cell('B2'));
    report.qpcr.dragPreview ??= await hintClasses(frame, 'button[data-well-id="$"]', ['A1', 'A2', 'B1', 'B2', 'B3'], '^well-(drop|move)-');
    await shot(`qpcr-drag-preview-${width}`);
    await page.keyboard.press('Escape');
    await page.mouse.up();
  }
  assert.equal(await label('A1'), before.A1, 'Escape must cancel the drag');
  await pressAndDrag(cell('A2'), cell('B2'));
  await page.mouse.up();
  assert.ok(report.qpcr.dragPreview.B2.includes('well-drop-landing'), JSON.stringify(report.qpcr.dragPreview));
  const swapped = {};
  for (const id of ['A1', 'A2', 'A3', 'B1', 'B2', 'B3']) swapped[id] = await label(id);
  report.qpcr.afterSwap = swapped;
  for (const [a, b] of [['A1', 'B1'], ['A2', 'B2'], ['A3', 'B3']]) {
    assert.equal(swapped[b].replace(/，手动.*$/, ''), before[a].replace(/，手动.*$/, ''), `${a} content should now be at ${b}`);
    assert.equal(swapped[a].replace(/，手动.*$/, ''), before[b].replace(/，手动.*$/, ''), `${b} content should now be at ${a}`);
  }

  // Text selected earlier in a field must not block copying wells after a click on the plate.
  const field = frame.locator('.sample-list .sample-name-input').first();
  await field.focus();
  await page.keyboard.press(`${mod}+a`);
  await cell('B1').click();
  await cell('B3').click({ modifiers: ['Shift'] });
  await page.keyboard.press(`${mod}+c`);
  const target = await center(cell('D5'));
  await page.mouse.move(target.x, target.y);
  report.qpcr.pastePreview = await hintClasses(frame, 'button[data-well-id="$"]', ['D5', 'D6', 'D7', 'D8'], '^well-paste-');
  for (const [width, height] of sizes) {
    await resize(width, height);
    const point = await center(cell('D5'));
    await page.mouse.move(point.x, point.y);
    await shot(`qpcr-paste-preview-${width}`);
    report.qpcr[`metrics${width}`] = await minFontAndOverflow(frame);
  }
  assert.ok(['D5', 'D6', 'D7'].every((id) => report.qpcr.pastePreview[id].length === 1), JSON.stringify(report.qpcr.pastePreview));
  const edge = await center(cell('H12'));
  await page.mouse.move(edge.x, edge.y);
  report.qpcr.edgePreview = await hintClasses(frame, 'button[data-well-id="$"]', ['H12'], '^well-paste-');
  assert.deepEqual(report.qpcr.edgePreview.H12, ['well-paste-invalid']);
  await page.keyboard.press(`${mod}+v`);
  assert.equal(await label('H12'), before.H12, 'off-plate paste must not change the plate');
  const d5Before = await label('D5');
  const d5 = await center(cell('D5'));
  await page.mouse.move(d5.x, d5.y);
  await page.keyboard.press(`${mod}+v`);
  report.qpcr.afterPaste = [await label('D5'), await label('D6'), await label('D7')];
  for (const [index, id] of ['B1', 'B2', 'B3'].entries()) {
    assert.equal(report.qpcr.afterPaste[index].replace(/，手动.*$/, ''), swapped[id].replace(/，手动.*$/, ''));
  }
  await page.keyboard.press('Escape');
  assert.equal(await frame.locator('.well-paste-target, .well-paste-overwrite').count(), 0);
  assert.equal(await frame.getByRole('button', { name: /^平移$|点选目标孔/ }).count(), 0, 'the old move-mode button is gone');
  await page.keyboard.press(`${mod}+z`);
  assert.equal(await label('D5'), d5Before, 'undo must revert the paste in one step');
}

// ---------- Free planner: paste onto a new plate that lacks the copied parameter ----------
{
  await resize(1440, 900);
  await page.goto(`${base}/tools/free-plate-layout/index.html`);
  await page.evaluate(() => { localStorage.removeItem('plate-layout-studio:workspace:v2'); localStorage.removeItem('plate-layout-studio:project:v1'); });
  await page.reload();
  await page.locator('.plate-option[data-size="96"]').click();
  const well = (id) => page.locator(`[data-well="${id}"]`);
  await page.locator('#newDimensionName').fill('合成细胞系');
  await page.locator('#addDimensionForm').evaluate((form) => form.requestSubmit());
  await well('B2').click();
  await well('B4').click({ modifiers: ['Shift'] });
  await page.locator('.parameter-input-row').filter({ hasText: '合成细胞系' }).locator('.parameter-value').fill('HEK-合成');
  await page.locator('#applyParametersButton').click();
  await page.keyboard.press(`${mod}+c`);
  await page.locator('#addPlateButton').click();
  await page.locator('.plate-option[data-size="96"]').click();
  const before = await page.locator('.parameter-input-row').filter({ hasText: '合成细胞系' }).count();
  const target = await center(well('D5'));
  await page.mouse.move(target.x, target.y);
  await page.keyboard.press(`${mod}+v`);
  const after = await page.locator('.parameter-input-row').filter({ hasText: '合成细胞系' }).count();
  const values = await page.evaluate(() => ['D5', 'D6', 'D7'].map((id) => document.querySelector(`[data-well="${id}"]`).textContent.trim()));
  report.free.crossPlateNewParameter = { parameterRowsBefore: before, parameterRowsAfter: after, values };
  assert.equal(after, 1, 'the pasted parameter exists on the new plate');
  assert.ok(values.every((text) => text.includes('HEK-合成')), JSON.stringify(values));
  await shot('free-cross-plate-new-parameter-1440');
}

// ---------- Free planner: a number never lands in a same-named parameter with another unit ----------
{
  await page.evaluate(() => { localStorage.removeItem('plate-layout-studio:workspace:v2'); localStorage.removeItem('plate-layout-studio:project:v1'); });
  await page.reload();
  await page.locator('.plate-option[data-size="96"]').click();
  const well = (id) => page.locator(`[data-well="${id}"]`);
  const setDoseUnit = async (unit) => {
    await page.locator('.dimension-row[data-dimension="dose"] .dimension-unit-input').fill(unit);
    await page.locator('.dimension-row[data-dimension="dose"] .dimension-unit-input').press('Tab');
  };
  await setDoseUnit('µM');
  await well('B2').click();
  await well('B4').click({ modifiers: ['Shift'] });
  await page.locator('.parameter-input-row').filter({ hasText: '剂量' }).first().locator('.parameter-value').fill('10');
  await page.locator('#applyParametersButton').click();
  await page.keyboard.press(`${mod}+c`);
  await page.locator('#addPlateButton').click();
  await page.locator('.plate-option[data-size="96"]').click();
  await setDoseUnit('nM');
  const target = await center(well('D5'));
  await page.mouse.move(target.x, target.y);
  await page.keyboard.press(`${mod}+v`);
  const doses = await page.locator('.dimension-row').evaluateAll((rows) => rows
    .filter((row) => row.querySelector('.dimension-name-input').value === '剂量')
    .map((row) => ({ id: row.dataset.dimension, unit: row.querySelector('.dimension-unit-input').value })));
  report.free.unitMismatchPaste = doses;
  assert.deepEqual(doses.map((dose) => dose.unit).sort(), ['nM', 'µM'], 'the µM values get their own parameter instead of the nM one');
  await shot('free-paste-unit-mismatch-1440');
}

// ---------- qPCR planner: 384-well plate ----------
{
  await resize(1440, 900);
  await page.goto(`${base}/tools/qpcr-plate-layout`);
  const frame = page.frameLocator('iframe').first();
  // Loading the example resets the plate type, so pick 384 afterwards.
  await frame.getByRole('button', { name: '载入示例', exact: true }).click();
  await frame.getByRole('button', { name: /384 孔板/ }).click();
  await frame.getByRole('button', { name: '生成布局', exact: true }).click();
  const cell = (id) => frame.locator(`button[data-well-id="${id}"]`);
  await cell('P24').waitFor({ state: 'attached' });
  const label = async (id) => (await cell(id).getAttribute('aria-label')).replace(/^[A-P]\d+，/, '').replace(/，手动.*$/, '');
  const before = {};
  for (const id of ['A1', 'A2', 'C1', 'C2', 'K10', 'K11']) before[id] = await label(id);
  await cell('A1').click();
  await cell('A2').click({ modifiers: ['Shift'] });
  const started = Date.now();
  await pressAndDrag(cell('A1'), cell('C1'));
  const preview = await hintClasses(frame, 'button[data-well-id="$"]', ['C1', 'C2'], '^well-drop-');
  await page.mouse.up();
  const dragMs = Date.now() - started;
  const swapped = { A1: await label('A1'), C1: await label('C1'), A2: await label('A2'), C2: await label('C2') };
  assert.equal(swapped.C1, before.A1); assert.equal(swapped.A1, before.C1);
  assert.equal(swapped.C2, before.A2); assert.equal(swapped.A2, before.C2);
  await page.keyboard.press(`${mod}+c`);
  const target = await center(cell('K10'));
  await page.mouse.move(target.x, target.y);
  const pastePreview = await hintClasses(frame, 'button[data-well-id="$"]', ['K10', 'K11'], '^well-paste-');
  await page.keyboard.press(`${mod}+v`);
  const pasted = [await label('K10'), await label('K11')];
  assert.deepEqual(pasted, [swapped.C1, swapped.C2]);
  const wellBox = await cell('A1').boundingBox();
  report.qpcr.plate384 = { preview, pastePreview, dragMs, pasted, wellPx: Math.round(wellBox.width) };
  for (const [width, height] of sizes) {
    await resize(width, height);
    await shot(`qpcr-384-${width}`);
    report.qpcr[`metrics384-${width}`] = await minFontAndOverflow(frame);
  }
}

report.errors = errors;
await writeFile(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
await browser.close();
assert.deepEqual(errors, []);
console.log(JSON.stringify({ ok: true, evidence, free: report.free.afterPaste, qpcr: report.qpcr.afterPaste }, null, 2));
