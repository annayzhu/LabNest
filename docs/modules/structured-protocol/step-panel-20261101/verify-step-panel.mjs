// Q243–Q247 on the 3002 clone (labnest_steppanel_20261101). EXP-008's copy carries two QA rules: step 8 optional,
// step 9 asks for "Volume plated" (required, µL) and "Incubator temperature". Writes only to that clone.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.LABNEST_BASE_URL ?? 'http://127.0.0.1:3002';
assert(new URL(base).port === '3002', 'Clone server only');
const out = new URL('./evidence/', import.meta.url);
await mkdir(out, { recursive: true });
const run = '/experiments/cmvtb3dd1000d6cplxvnb0ehy/run';
const checks = [], errors = [];
const browser = await chromium.launch();
const shot = (page, name) => page.screenshot({ path: new URL(`${name}.png`, out).pathname });
const step = (page, text) => page.locator('.ln-bench-steps button', { hasText: text }).first().click();
const panel = page => page.locator('section:has([data-run-tools])').first();
try {
  // Desktop, field mode.
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await desktop.addCookies([{ name: 'labnest_locale', value: 'zh', url: base }]);
  let page = await desktop.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(`1440 ${error.message}`));
  await page.goto(base + run + '?view=bench', { waitUntil: 'networkidle' });
  // Field mode opens at the first unfinished step.
  let text = await panel(page).innerText();
  for (const gone of ['必需操作', '跳过操作', '可选操作']) assert(!text.includes(gone), `still shows ${gone}`);
  assert.equal(await panel(page).locator('details:not([class*="group"])').count(), 0, 'no bare skip fold');
  const complete = panel(page).getByRole('button', { name: '确认完成本步骤' });
  const skipToggle = panel(page).getByRole('button', { name: '跳过本步…' });
  assert((await skipToggle.boundingBox()).y > (await complete.boundingBox()).y, 'skip sits under the completion button');
  assert.equal(await panel(page).locator('[data-run-tools] > button:visible').count(), 3, 'three tools: calculator, timer, record');
  await panel(page).scrollIntoViewIfNeeded(); await shot(page, 'desktop-current-step');
  checks.push('1440 current step: no status line, skip under completion');

  await panel(page).getByRole('button', { name: '记录' }).click();
  const menu = page.locator('.ln-actions-menu:popover-open');
  assert.deepEqual((await menu.locator('a, button').allInnerTexts()).map(item => item.trim()), ['添加观察', '测量值', '填写实验结果']);
  await shot(page, 'desktop-record-menu');
  await menu.getByRole('button', { name: '测量值' }).click();
  const dialog = page.locator('[aria-labelledby=measurement-title]');
  await dialog.waitFor({ state: 'visible' });
  await dialog.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
  const box = await dialog.boundingBox();
  assert(Math.abs(box.x + box.width / 2 - 720) < 4 && box.y > 50, `measurement centred on desktop: ${JSON.stringify(box)}`);
  assert(!(await dialog.innerText()).match(/Value \*|Note · optional/), 'measurement labels translated');
  await shot(page, 'desktop-measurement');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), '记录', 'focus returns to 记录');
  checks.push('1440 record menu: three items; measurement opens centred; Escape returns focus');

  await skipToggle.click();
  const reason = panel(page).getByLabel('跳过原因');
  assert(await reason.evaluate(element => element === document.activeElement), 'reason field takes focus');
  await shot(page, 'desktop-skip-open');
  await panel(page).getByRole('button', { name: '取消' }).click();
  await skipToggle.waitFor();
  checks.push('1440 skip opens in place with focus; cancel closes');

  await step(page, 'Plate some or all');
  assert((await panel(page).locator('.ln-step-tag').innerText()).trim() === '可选', 'optional step tagged');
  await panel(page).getByRole('button', { name: '跳过本步…' }).click();
  await panel(page).getByLabel('跳过原因').fill('QA 跳过：本次只铺一块板');
  await panel(page).getByRole('button', { name: '记录跳过' }).click();
  await panel(page).getByRole('button', { name: '撤销跳过' }).waitFor();
  assert.equal((await panel(page).locator('.ln-step-tag').innerText()).trim(), '已跳过');
  assert.match(await panel(page).locator('.ln-step-note').innerText(), /已跳过 · QA 跳过：本次只铺一块板（不计为完成）/);
  assert(await panel(page).getByRole('button', { name: '确认完成本步骤' }).isDisabled());
  await shot(page, 'desktop-step8-skipped');
  await panel(page).getByRole('button', { name: '撤销跳过' }).click();
  await panel(page).getByRole('button', { name: '跳过本步…' }).waitFor();
  assert.equal((await panel(page).locator('.ln-step-tag').innerText()).trim(), '可选');
  checks.push('1440 step 8: 可选 tag; skip shows 已跳过 tag, note above completion, 撤销跳过; undo restores');

  await step(page, 'Incubate plates at 37');
  const colonies = panel(page).getByLabel('Volume plated');
  const row = await panel(page).locator('.ln-step-field').first().evaluate(element => { const label = element.querySelector('span').getBoundingClientRect(), input = element.querySelector('input').getBoundingClientRect(); return { sameLine: Math.abs(label.top + label.height / 2 - (input.top + input.height / 2)) < 6, inputRight: input.left > label.left, font: getComputedStyle(element).fontSize }; });
  assert(row.sameLine && row.inputRight, `label left, input right: ${JSON.stringify(row)}`);
  // The clone keeps earlier runs' values; an empty required value must block completion.
  if (!await colonies.inputValue()) assert(await panel(page).getByRole('button', { name: '确认完成本步骤' }).isDisabled(), 'required value blocks completion');
  await colonies.fill(String(100 + Date.now() % 50));
  await panel(page).getByRole('button', { name: '保存实际值' }).click();
  await panel(page).locator('.ln-step-field small', { hasText: '已保存' }).first().waitFor();
  await panel(page).scrollIntoViewIfNeeded(); await shot(page, 'desktop-step9-values');
  checks.push(`1440 step 9: value rows (${row.font}), required value saved`);
  await desktop.close();

  // Phone, field mode.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await phone.addCookies([{ name: 'labnest_locale', value: 'zh', url: base }]);
  page = await phone.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(`390 ${error.message}`));
  await page.goto(base + run + '?view=bench', { waitUntil: 'networkidle' });
  text = await panel(page).innerText();
  assert(!text.includes('必需操作') && !text.includes('跳过操作'));
  await panel(page).getByRole('button', { name: '跳过本步…' }).scrollIntoViewIfNeeded(); await shot(page, 'phone-step');
  await panel(page).getByRole('button', { name: '记录' }).click();
  await page.locator('.ln-actions-menu:popover-open').waitFor(); await shot(page, 'phone-record-menu');
  assert((await page.locator('.ln-actions-menu:popover-open a').first().boundingBox()).height >= 44, 'touch-height menu rows');
  await page.locator('.ln-actions-menu:popover-open').getByRole('button', { name: '测量值' }).click();
  const sheet = page.locator('[aria-labelledby=measurement-title]'); await sheet.waitFor({ state: 'visible' });
  await sheet.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
  const sheetBox = await sheet.boundingBox();
  assert(Math.abs(sheetBox.y + sheetBox.height - 844) < 2 && sheetBox.width === 390, `bottom sheet on phone: ${JSON.stringify(sheetBox)}`);
  await shot(page, 'phone-measurement');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll');
  checks.push('390: no status line; menu; measurement as bottom sheet; no horizontal scroll');
  await phone.close();

  // Desktop list view: record per step in the side column.
  const list = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await list.addCookies([{ name: 'labnest_locale', value: 'zh', url: base }]);
  page = await list.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(`list ${error.message}`));
  await page.goto(base + run, { waitUntil: 'networkidle' });
  const optional = page.locator('[id^="step-"]:has([data-structured-step-record])', { hasText: 'Plate some or all' }).first();
  if (await optional.count()) {
    assert.equal((await optional.locator('.ln-step-tag').innerText()).trim(), '可选');
    await optional.getByRole('button', { name: '跳过本步…' }).waitFor();
    await optional.scrollIntoViewIfNeeded(); await shot(page, 'desktop-list-step8');
    checks.push('1440 list view: 可选 tag and 跳过本步… in the step record');
  } else throw new Error('list view step 8 not found');
  await list.close();
} finally { await browser.close(); }
const report = { base, passed: errors.length === 0, checks, errors };
await writeFile(new URL('report.json', out), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
if (!report.passed) process.exit(1);
