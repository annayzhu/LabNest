// Safe on production: 完成执行 (Q462) read from real pages without saving anything; every request other than GET/HEAD is aborted.
// Usage: LABNEST_LIVE_BASE_URL=http://127.0.0.1:3001 LABNEST_COMPLETE_READY=<id> node scripts/verify-complete-live.mjs <folder>
// READY is an experiment whose steps are all ticked but which is not completed: the record offers 完成执行 at its status,
// opening it asks first (the dialog is closed, never confirmed), and a phone finds the one completion button in 现场模式.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.env.LABNEST_LIVE_BASE_URL, ready = process.env.LABNEST_COMPLETE_READY;
if (!base || !ready) throw new Error('Set LABNEST_LIVE_BASE_URL and LABNEST_COMPLETE_READY');
const out = `${process.argv[2] ?? '.'}/complete-evidence-${new URL(base).port}`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const blocked = [], errors = [], checks = [];
const check = (name, passed, detail) => { checks.push({ name, status: passed ? '通过' : '失败', detail }); console.log(passed ? 'PASS' : 'FAIL', name, JSON.stringify(detail)); };

async function open(width, height, phone) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone, serviceWorkers: 'block' });
  await context.addCookies([{ name: 'labnest_locale', value: 'zh', url: base }]);
  await context.addInitScript(() => localStorage.setItem('labnest.locale', 'zh'));
  await context.route('**/*', (route) => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : (blocked.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`), route.abort()));
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(String(error).slice(0, 200)));
  return { context, page };
}

for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080]]) {
  const { context, page } = await open(width, height, false);
  await page.goto(`${base}/experiments/${ready}`, { waitUntil: 'networkidle' });
  const state = await page.evaluate(() => {
    const aside = document.querySelector('aside.document-preview-sidebar');
    const button = [...aside.querySelectorAll('button')].find(b => b.textContent.trim() === '完成执行');
    const r = button?.getBoundingClientRect();
    return { status: [...aside.querySelectorAll('*')].find(e => !e.children.length && ['计划中', '进行中', '已完成'].includes(e.textContent.trim()))?.textContent.trim(),
      steps: [...aside.querySelectorAll('span')].map(s => s.textContent).find(t => /^步骤/.test(t)), button: r ? { bottom: Math.round(r.bottom), width: Math.round(r.width), font: getComputedStyle(button).fontSize } : null,
      viewport: innerHeight, hScroll: document.documentElement.scrollWidth > innerWidth };
  });
  check(`${width}×${height}：步骤勾完的进行中实验在状态处显示“完成执行”，首屏可见`, state.status === '进行中' && state.button && state.button.bottom <= state.viewport && !state.hScroll, state);
  if (width === 1440 && !state.button) check('点击后先询问（用量或确认），未直接完成', false, 'no button');
  else if (width === 1440) {
    await page.getByRole('button', { name: '完成执行' }).click();
    const dialog = page.locator('dialog[open]');
    await dialog.waitFor();
    const text = (await dialog.innerText()).replace(/\s+/g, ' ');
    check('点击后先询问（用量或确认），未直接完成', /按本次用量扣减库存|完成本次执行/.test(text), text.slice(0, 80));
    await page.screenshot({ path: `${out}/record-1440.png` });
    await page.keyboard.press('Escape');
  }
  await context.close();
}
{
  const { context, page } = await open(390, 844, true);
  await page.goto(`${base}/experiments/${ready}/run`, { waitUntil: 'networkidle' });
  const count = await page.locator('button[name=intent][value=complete]').filter({ visible: true }).count();
  check('手机现场模式：有一个可见的“完成执行”', count === 1, count);
  await page.screenshot({ path: `${out}/phone-run.png`, fullPage: true });
  await context.close();
}
await browser.close();
const passed = checks.length === 5 && checks.every(c => c.status === '通过') && !blocked.length && !errors.length;
writeFileSync(`${out}/report.json`, JSON.stringify({ passed, checks, mutations: blocked, pageErrors: errors }, null, 2));
console.log(JSON.stringify({ passed, checks: checks.length, mutations: blocked.length, pageErrors: errors.length }));
process.exit(passed ? 0 : 1);
