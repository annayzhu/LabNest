// Real-path checks for each day's method (Q427–Q433), on synthetic experiments in a test database only. It changes them, so it seeds
// them again first (docs/modules/structured-protocol/day-record-20261109/seed.sql):
//   DAY_RECORD_DB=labnest_dayrecord_20261109 BASE_URL=http://localhost:3002 node scripts/verify-day-methods.mjs
// Path: a day gets custom steps → an unscheduled part is placed on a day → a part with records refuses removal and says why → a day gets
// a Protocol → 换版本 → 移除 → a part moves from a chosen step → ＋ 加一天 → writing under days on the edit page, kept through a day put
// in on the schedule → a one-day experiment becomes two days. Then screenshots and measurements at the usual sizes.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { useChineseInterface as chineseInterface } from './qpcr-browser-helpers.mjs';

const base = process.env.BASE_URL ?? 'http://localhost:3002';
const database = process.env.DAY_RECORD_DB ?? 'labnest_dayrecord_20261109';
assert.notEqual(new URL(base).port, '3001', '3001 is the formal service.');
assert.notEqual(database, 'labnest', 'labnest is the formal database.');
const out = process.env.EVIDENCE_DIR ?? '.local-runtime/day-record-20261109/step2';
mkdirSync(out, { recursive: true });

const seed = spawnSync('docker', ['exec', '-i', 'labnest-postgres', 'psql', '-U', 'labnest', '-d', database, '-v', 'ON_ERROR_STOP=1', '-q'], { input: readFileSync('docs/modules/structured-protocol/day-record-20261109/seed.sql') });
assert.equal(seed.status, 0, `seed failed: ${seed.stderr}`);

/** 执行记录 as headings, parts and written lines (steps and their details left out). */
const outline = page => page.locator('#section-execution').evaluate(section => [...section.querySelectorAll('.document-block')].filter(block => !block.parentElement.closest('.document-block')).flatMap(block => {
  const heading = block.querySelector(':scope > .ln-execution-day h3');
  if (heading) return [`# ${heading.textContent}`];
  const part = block.querySelector(':scope > .ln-execution-protocol-heading h3');
  if (part) return [`  ${part.textContent}`];
  if (block.querySelector('.ln-execution-step-line, .ln-execution-detail, .ln-execution-note, .ln-execution-fold') || block.matches('.ln-execution-fold')) return [];
  return [`    ${block.innerText.trim()}`];
}));
const day = (page, index) => page.locator(`#execution-day-${index}`);
const partMenu = (page, title, nth = 0) => page.getByRole('button', { name: `${title}：移动、修改或移除` }).nth(nth);
const dialog = page => page.getByRole('dialog');
async function settle(page) { await page.waitForLoadState('networkidle'); await page.locator('.ln-day-dialog').waitFor({ state: 'detached' }).catch(() => {}); }

const browser = await chromium.launch();
const report = { path: [], sizes: [] };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await chineseInterface(context, base);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/experiments/syn-dr-1`);
  await day(page, 5).waitFor();

  // 1. An empty day: 自定义步骤.
  await day(page, 5).getByRole('button', { name: '自定义步骤' }).click();
  await dialog(page).getByLabel('名称 · 可不填').fill('收样');
  await dialog(page).getByLabel('步骤 · 每行一步').fill('收集上清 | 1500 g 离心 5 min\n提取 RNA');
  await dialog(page).getByRole('button', { name: '加入这一天' }).click();
  await settle(page);
  await day(page, 5).getByRole('button', { name: '加一份' }).waitFor();
  assert.match((await outline(page)).join('\n'), /# 第 5 天 · 11\/13 周五\n {2}收样/);
  report.path.push('custom steps on day 5');

  // 2. The part on no day: 安排到… day 3.
  await partMenu(page, '补充检查').click();
  await page.getByRole('menuitem', { name: '安排到…' }).click();
  await dialog(page).getByLabel('安排到').selectOption('2026-11-11');
  await dialog(page).getByRole('button', { name: '移动' }).click();
  await settle(page);
  await page.locator('#execution-day-unscheduled').waitFor({ state: 'detached' });
  assert.match((await outline(page)).join('\n'), /# 第 3 天 · 11\/11 周三\n {2}补充检查/);
  report.path.push('unscheduled part placed on day 3');

  // 3. A part with ticked steps: 移除 says why, beside the part.
  await partMenu(page, '质粒转染', 1).click();
  await page.getByRole('menuitem', { name: '移除' }).click();
  const refusal = await page.locator('.ln-day-part-message').innerText();
  assert.match(refusal, /质粒转染 第 1 步已勾选完成（第 2 天）。有记录的步骤不能移除。/);
  report.path.push(`removal refused: ${refusal}`);
  await page.locator('.ln-day-part-message button').click();

  // 4. A Protocol on day 3, its version fixed when added.
  await day(page, 3).getByRole('button', { name: '加一份' }).click();
  await dialog(page).getByPlaceholder('搜索名称、版本或编号…').fill('PRT-100007');
  await dialog(page).locator('.max-h-72 button').first().click();
  await dialog(page).getByRole('button', { name: '加入这一天' }).click();
  await settle(page);
  const transfection = page.locator('.ln-execution-protocol-heading', { hasText: 'Cell Transfection' });
  await transfection.waitFor();
  assert.match(await transfection.innerText(), /v0\.4-测试/);
  report.path.push('Protocol v0.4-测试 (latest) added to day 3');

  // 5. 换版本 → the earlier confirmed version.
  await transfection.getByRole('button').click();
  await page.getByRole('menuitem', { name: '换版本…' }).click();
  await dialog(page).locator('.max-h-72 button').first().click();
  await dialog(page).getByRole('button', { name: '保存' }).click();
  await settle(page);
  await transfection.getByText(/v0\.3 ·/).waitFor();
  report.path.push('version changed to v0.3');

  // 6. 移除 a part without records, after the confirmation.
  await transfection.getByRole('button').click();
  await page.getByRole('menuitem', { name: '移除' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '移除' }).click();
  await settle(page);
  await transfection.waitFor({ state: 'detached' });
  report.path.push('part without records removed');

  // 7. 移到另一天 from a chosen step: step 4 of the harvest goes to day 5.
  await partMenu(page, '质粒转染', 1).click();
  await page.getByRole('menuitem', { name: '移到另一天…' }).click();
  await dialog(page).getByLabel('移到').selectOption('2026-11-13');
  await dialog(page).getByLabel('从这一步起').selectOption({ label: '第 4 步' });
  await dialog(page).getByRole('button', { name: '移动' }).click();
  await settle(page);
  await page.locator('.ln-execution-protocol-heading', { hasText: '质粒转染 · 第 4 步' }).waitFor();
  const moved = (await outline(page)).join('\n');
  assert.match(moved, /# 第 4 天 · 11\/12 周四\n {2}质粒转染 · 第 3 步/);
  assert.match(moved, /# 第 5 天 · 11\/13 周五\n[\s\S]*质粒转染 · 第 4 步/);
  report.path.push('step 4 moved to day 5');

  // 8. ＋ 加一天.
  await page.locator('.ln-execution-add-day').getByRole('button', { name: '加一天' }).click();
  await day(page, 6).waitFor();
  assert.equal(await page.locator('.ln-day-summary-title').innerText(), '日程 · 6 天');
  report.path.push('day 6 added');

  // 9. Writing under days on the edit page; it reads under them on the record.
  await page.goto(`${base}/experiments/syn-dr-1/edit`);
  const lineAfter = key => page.locator(`.ProseMirror .react-renderer:has([data-day-break="${key}"]) + p`);
  await lineAfter('2026-11-10').click();
  await page.keyboard.type('合成记录：转染后 6 h 换液。');
  await lineAfter('2026-11-12').click();
  await page.keyboard.type('合成记录：收样前拍照。');
  await page.getByRole('button', { name: '保存实验' }).click();
  await page.waitForURL(/\/experiments\/syn-dr-1$/);
  const written = (await outline(page)).join('\n');
  assert.match(written, /# 第 2 天[^\n]*\n[\s\S]*?合成记录：转染后 6 h 换液。\n# 第 3 天/);
  assert.match(written, /# 第 4 天[^\n]*\n[\s\S]*?合成记录：收样前拍照。\n# 第 5 天/);
  report.path.push('writing saved under days 2 and 4');

  // 10. A day put in after day 2 on the schedule: day 4's writing moves to day 5 with its steps.
  await page.goto(`${base}/experiments/syn-dr-1/schedule`);
  const day2 = page.locator('.ln-schedule-day').nth(1);
  await day2.locator('.ln-schedule-day-menu button').first().click();
  await day2.getByRole('menuitem', { name: '在后面插入一天' }).click();
  await page.getByLabel('改期原因').fill('合成验收：第 2 天后插入一天');
  await page.getByRole('button', { name: '保存日程' }).click();
  await page.getByText('日程已保存。').waitFor();
  await page.goto(`${base}/experiments/syn-dr-1`);
  const shifted = (await outline(page)).join('\n');
  assert.match(shifted, /# 第 2 天[^\n]*\n[\s\S]*?合成记录：转染后 6 h 换液。\n# 第 3 天 · 11\/11 周三/);
  assert.match(shifted, /# 第 5 天 · 11\/13 周五\n {2}质粒转染 · 第 3 步[\s\S]*?合成记录：收样前拍照。\n# 第 6 天/);
  report.path.push('writing moved with its day after a day was put in');

  // 11. A one-day experiment becomes two days; its steps and what was written stay on day 1 when day 2 gets its own.
  await page.goto(`${base}/experiments/syn-dr-2`);
  await page.locator('.ln-execution-add-day').getByRole('button', { name: '加一天' }).click();
  await day(page, 2).waitFor();
  await day(page, 2).getByRole('button', { name: '自定义步骤' }).click();
  await dialog(page).getByLabel('步骤 · 每行一步').fill('换液\n拍照');
  await dialog(page).getByRole('button', { name: '加入这一天' }).click();
  await settle(page);
  await day(page, 2).getByRole('button', { name: '加一份' }).waitFor();
  const twoDays = (await outline(page)).join('\n');
  assert.match(twoDays, /# 第 1 天[^\n]*\n {2}自定义步骤[\s\S]*合成记录：缓冲液 pH 7\.4。\n# 第 2 天[^\n]*\n {2}自定义步骤/);
  assert.doesNotMatch(twoDays, /未分天的记录/);
  report.path.push('one-day experiment became two days');
  assert.deepEqual(errors, [], 'page errors on the path');
  await context.close();

  // Sizes: the record with its controls, and the chooser open.
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080], [768, 1024], [375, 812]]) {
    const sized = await browser.newContext({ viewport: { width, height } });
    await chineseInterface(sized, base);
    const view = await sized.newPage();
    await view.goto(`${base}/experiments/syn-dr-1`);
    await day(view, 3).waitFor();
    await day(view, 3).scrollIntoViewIfNeeded();
    const measured = await view.evaluate(() => {
      const texts = [...document.querySelectorAll('.ln-execution-day *, .ln-execution-protocol-heading *, .ln-execution-add-day *')].filter(element => [...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim()));
      return { minFontPx: Math.min(...texts.map(element => parseFloat(getComputedStyle(element).fontSize))), clipped: texts.filter(element => element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflow !== 'visible').length, sideways: document.documentElement.scrollWidth > innerWidth };
    });
    await view.screenshot({ path: `${out}/record-${width}.png` });
    await day(view, 7).getByRole('button', { name: '按规程执行' }).click();
    await view.locator('.ln-day-dialog .max-h-72').waitFor();
    const chooser = await view.evaluate(() => {
      const card = document.querySelector('.ln-day-dialog'), body = document.querySelector('.ln-day-dialog-body'), list = document.querySelector('.ln-day-dialog .max-h-72');
      const scrolls = element => element.scrollHeight > element.clientHeight + 1 && getComputedStyle(element).overflowY !== 'visible';
      return { width: Math.round(card.getBoundingClientRect().width), height: Math.round(card.getBoundingClientRect().height), scrollAreas: [body, list].filter(scrolls).length, listHeight: Math.round(list.getBoundingClientRect().height) };
    });
    await view.screenshot({ path: `${out}/chooser-${width}.png` });
    assert(measured.minFontPx >= 12, `smallest text ${measured.minFontPx}px at ${width}`);
    assert.equal(measured.clipped, 0, `clipped text at ${width}`);
    assert.equal(measured.sideways, false, `sideways scroll at ${width}`);
    assert(chooser.scrollAreas <= 1, `one scroll area in the chooser at ${width}`);
    report.sizes.push({ viewport: `${width}x${height}`, ...measured, chooser });
    await sized.close();
  }
  // The edit page: each day a fixed divider with its own line to write on.
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080]]) {
    const sized = await browser.newContext({ viewport: { width, height } });
    await chineseInterface(sized, base);
    const view = await sized.newPage();
    await view.goto(`${base}/experiments/syn-dr-1/edit`);
    const second = view.locator('.ProseMirror [data-day-break="2026-11-10"]');
    await second.waitFor();
    await second.scrollIntoViewIfNeeded();
    const editor = await view.evaluate(() => ({ days: document.querySelectorAll('.ProseMirror .ln-scientific-day').length, linesAfterDays: document.querySelectorAll('.ProseMirror .react-renderer:has(.ln-scientific-day) + p').length, sideways: document.documentElement.scrollWidth > innerWidth }));
    await view.screenshot({ path: `${out}/edit-${width}.png` });
    assert.equal(editor.days, editor.linesAfterDays, `a line under every day at ${width}`);
    assert.equal(editor.sideways, false, `sideways scroll on the edit page at ${width}`);
    report.sizes.push({ viewport: `${width}x${height}`, editPage: editor });
    await sized.close();
  }
  // Print: the controls stay off paper.
  const printing = await browser.newPage();
  await chineseInterface(printing.context(), base);
  await printing.goto(`${base}/experiments/syn-dr-1`);
  await day(printing, 3).waitFor();
  await printing.emulateMedia({ media: 'print' });
  report.printHidesControls = await printing.evaluate(() => [...document.querySelectorAll('.ln-execution-day-methods, .ln-execution-day-add, .ln-execution-add-day, .ln-day-part-menu')].every(element => getComputedStyle(element).display === 'none'));
  assert(report.printHidesControls, 'print hides the day controls');
  await printing.pdf({ path: `${out}/record-print.pdf`, format: 'A4', printBackground: true });
} finally {
  await browser.close();
}
writeFileSync(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
