// Schedule Add item / Draft and recognition photos on 3004 with crypto.randomUUID removed, as on a plain-HTTP LAN phone.
// Nothing is saved: the schedule is left unsaved and photos are not sent.
import assert from 'node:assert/strict';
import { chromium } from '/Users/annayzhu/Developer/LabNest/node_modules/playwright/index.mjs';

const base = 'http://127.0.0.1:3004';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await context.addCookies([{ name: 'labnest_locale', value: 'zh', url: base }]);
await context.addInitScript(() => { delete Crypto.prototype.randomUUID; });
const mutations = [];
await context.route('**/*', route => { if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) { mutations.push(route.request().url()); return route.abort(); } return route.continue(); });
const page = await context.newPage(); page.setDefaultTimeout(30000);
const errors = []; page.on('pageerror', error => errors.push(error.message));
const out = [];
try {
  await page.goto(`${base}/experiments/cmvtb3dd1000d6cplxvnb0ehy/schedule`, { waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => typeof crypto.randomUUID), 'undefined', 'randomUUID removed');
  await page.locator('.ln-schedule-toolbar').getByRole('button', { name: '添加事项' }).click();
  await page.locator('.ln-schedule-panel').waitFor();
  assert.equal(await page.locator('.ln-schedule-card').count(), 1, 'one item card');
  await page.screenshot({ path: new URL('./lan-add-item-390.png', import.meta.url).pathname });
  out.push('toolbar Add item opens the item panel');
  await page.locator('.ln-schedule-panel').getByRole('button', { name: '关闭' }).or(page.locator('.ln-schedule-panel header button')).first().click();
  await page.locator('.ln-schedule-day').first().getByRole('button', { name: '添加事项' }).click();
  assert.equal(await page.locator('.ln-schedule-card').count(), 2, 'second item from the day');
  out.push('day Add item adds a second item');
  const draft = page.getByRole('button', { name: '按规程排出初稿' });
  if (await draft.count()) { await draft.last().click(); await page.locator('.ln-schedule-notice').waitFor(); out.push(`draft: ${await page.locator('.ln-schedule-notice').innerText()}`); }
  await page.goto(`${base}/protocols/import/recognize`, { waitUntil: 'networkidle' });
  const input = page.locator('input[type=file][accept*="image"]').first();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await input.setInputFiles({ name: 'step.png', mimeType: 'image/png', buffer: png });
  await page.waitForTimeout(1500);
  out.push(`recognition photos after picking one: ${await page.locator('.ln-photos img, [data-photo] img, figure img').count()} image(s)`);
} finally { await browser.close(); }
console.log(JSON.stringify({ passed: errors.length === 0 && mutations.length === 0, out, errors, mutations }, null, 1));
