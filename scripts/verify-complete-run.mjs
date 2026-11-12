// 完成执行 from the experiment record (Q462), through the pages, on a test database only: it completes runs.
// Usage: LABNEST_BASE_URL=http://127.0.0.1:3009 LABNEST_QA_DIR=<folder> \
//   LABNEST_COMPLETE_STRUCTURED=<id> LABNEST_COMPLETE_PLAIN=<id> LABNEST_COMPLETE_OPEN=<id> LABNEST_COMPLETE_PHONE=<id> node scripts/verify-complete-run.mjs
// STRUCTURED: every step ticked, with use to record (asks about stock). PLAIN: every step ticked, no use (plain confirmation).
// OPEN: steps still to do (no button). PHONE: every step ticked, completed from 现场模式 at phone width.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.env.LABNEST_BASE_URL, out = process.env.LABNEST_QA_DIR ?? '.';
const ids = { structured: process.env.LABNEST_COMPLETE_STRUCTURED, plain: process.env.LABNEST_COMPLETE_PLAIN, open: process.env.LABNEST_COMPLETE_OPEN, phone: process.env.LABNEST_COMPLETE_PHONE };
if (!base || Object.values(ids).some(id => !id)) throw new Error('Set LABNEST_BASE_URL and the four LABNEST_COMPLETE_* ids');
if (/:3001\b/.test(base)) throw new Error('This check writes; never run it on 3001');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const checks = [], errors = [];
const check = (name, passed, detail) => { checks.push({ name, status: passed ? '通过' : '失败', detail }); console.log(passed ? 'PASS' : 'FAIL', name, JSON.stringify(detail)); };

async function open(width, height, phone) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone, serviceWorkers: 'block' });
  await context.addCookies([{ name: 'labnest_locale', value: 'zh', url: base }]);
  await context.addInitScript(() => localStorage.setItem('labnest.locale', 'zh'));
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(String(error).slice(0, 200)));
  return { context, page };
}
// The record's 执行管理 card: its status pill and the button, if any.
const card = (page) => page.evaluate(() => {
  const aside = document.querySelector('aside.document-preview-sidebar');
  const button = [...aside.querySelectorAll('button')].find(b => b.textContent.trim() === '完成执行');
  const r = button?.getBoundingClientRect();
  return { status: [...aside.querySelectorAll('*')].find(e => !e.children.length && ['计划中', '进行中', '已完成', '失败'].includes(e.textContent.trim()))?.textContent.trim(),
    button: r ? { bottom: Math.round(r.bottom), width: Math.round(r.width), font: getComputedStyle(button).fontSize } : null, viewport: innerHeight, hScroll: document.documentElement.scrollWidth > innerWidth };
});
const settle = async (page) => { await page.waitForLoadState('networkidle'); await page.waitForTimeout(300); };

// Computer, 1440×900: a structured run asks about this run's use, then completes.
{
  const { context, page } = await open(1440, 900, false);
  await page.goto(`${base}/experiments/${ids.structured}`, { waitUntil: 'networkidle' });
  const before = await card(page);
  check('结构化执行：步骤勾完后状态处出现“完成执行”，首屏可见', before.status === '进行中' && before.button && before.button.bottom <= before.viewport && !before.hScroll, before);
  await page.getByRole('button', { name: '完成执行' }).click();
  const dialog = page.locator('dialog[open]');
  await dialog.waitFor();
  check('结构化执行：先询问本次用量', /按本次用量扣减库存/.test(await dialog.innerText()), (await dialog.innerText()).slice(0, 80));
  await dialog.getByRole('button', { name: /完成并记录用量/ }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('aside.document-preview-sidebar *')].some(e => !e.children.length && e.textContent.trim() === '已完成'), null, { timeout: 20000 });
  await settle(page);
  const after = await card(page);
  check('结构化执行：完成后显示已完成，按钮消失', after.status === '已完成' && !after.button, after);
  await page.screenshot({ path: `${out}/structured-1440.png` });
  await context.close();
}

// Computer, 1366×768: a plain run without use gets a plain confirmation.
{
  const { context, page } = await open(1366, 768, false);
  await page.goto(`${base}/experiments/${ids.plain}`, { waitUntil: 'networkidle' });
  const before = await card(page);
  check('普通执行：1366×768 首屏可见“完成执行”', before.status === '进行中' && before.button && before.button.bottom <= before.viewport && !before.hScroll, before);
  await page.getByRole('button', { name: '完成执行' }).click();
  const dialog = page.locator('dialog[open]');
  await dialog.waitFor();
  const text = await dialog.innerText();
  check('普通执行：确认弹窗说明取消勾选会重新进行', /完成本次执行/.test(text) && /重新变为进行中/.test(text), text.replace(/\s+/g, ' '));
  await dialog.getByRole('button', { name: '完成执行' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('aside.document-preview-sidebar *')].some(e => !e.children.length && e.textContent.trim() === '已完成'), null, { timeout: 20000 });
  await settle(page);
  const after = await card(page);
  check('普通执行：完成后显示已完成，按钮消失', after.status === '已完成' && !after.button, after);
  await context.close();
}

// A run with steps still to do offers nothing.
{
  const { context, page } = await open(1920, 1080, false);
  await page.goto(`${base}/experiments/${ids.open}`, { waitUntil: 'networkidle' });
  const state = await card(page);
  check('步骤未勾完：不显示“完成执行”', !state.button, state);
  await context.close();
}

// Phone, 390×844: the record's side card is hidden, so 现场模式 finishes the run.
{
  const { context, page } = await open(390, 844, true);
  await page.goto(`${base}/experiments/${ids.phone}/run`, { waitUntil: 'networkidle' });
  const finish = page.locator('button[name=intent][value=complete]').filter({ visible: true });
  check('手机现场模式：有一个可见的“完成执行”', await finish.count() === 1, await finish.count());
  await page.getByLabel('已核对实验记录和未解决的偏差').check();
  await finish.click();
  await page.getByText('已完成执行。').first().waitFor({ timeout: 20000 });
  await page.goto(`${base}/experiments/${ids.phone}`, { waitUntil: 'networkidle' });
  const status = await page.evaluate(() => [...document.querySelectorAll('aside.document-preview-sidebar *')].find(e => !e.children.length && ['进行中', '已完成'].includes(e.textContent.trim()))?.textContent.trim());
  check('手机现场模式：完成后实验为已完成', status === '已完成', status);
  await context.close();
}

await browser.close();
const passed = checks.length === 9 && checks.every(c => c.status === '通过') && !errors.length;
writeFileSync(`${out}/browser-report.json`, JSON.stringify({ passed, checks, pageErrors: errors }, null, 2));
console.log(JSON.stringify({ passed, checks: checks.length, pageErrors: errors.length }));
process.exit(passed ? 0 : 1);
