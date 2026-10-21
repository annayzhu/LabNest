import 'dotenv/config';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import sharp from 'sharp';
import pg from 'pg';

const base = process.env.LABNEST_E2E_BASE_URL ?? 'http://127.0.0.1:3219';
const database = new URL(process.env.DATABASE_URL);
assert.equal(database.pathname, '/labnest_mobile_qa');
assert(['localhost', '127.0.0.1'].includes(database.hostname));
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const dir = process.env.CAPTURE_RELEASE_EVIDENCE ?? '.local-runtime/capture-release-evidence';
await mkdir(dir, { recursive: true });
const db = new pg.Client({ connectionString: database.toString() });
await db.connect();
const checks = [];
try {
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch();
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await context.addCookies([{ name: 'labnest_locale', value: 'en', url: base }]);
      const page = await context.newPage();
      await page.goto(base + '/entries/new?mode=capture', { waitUntil: 'networkidle' });
      const editor = page.locator('[contenteditable=true]:visible').last();
      await editor.fill('Synthetic capture 中文 25 µL');
      assert(Number.parseFloat(await editor.evaluate(el => getComputedStyle(el).fontSize)) >= 16);
      await page.getByRole('textbox', { name: 'Entry title', exact: true }).filter({ visible: true }).fill(`Synthetic release capture ${name}`);
      assert.equal(await page.getByText('Add files', { exact: true }).count(), 0);
      let failFirst = true;
      await page.route('**/api/attachments', async route => {
        if (route.request().method() === 'POST' && failFirst) {
          failFirst = false;
          await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic retry check' }) });
        } else await route.continue();
      });
      for (let i = 0; i < 4; i++) {
        const buffer = await sharp({ create: { width: 100 + i, height: 75, channels: 3, background: '#345678' } }).png().toBuffer();
        await page.locator('input[type=file][capture]').setInputFiles({ name: `capture-${name}-${i}.png`, mimeType: 'image/png', buffer });
        if (i === 0) await page.getByRole('button', { name: '重试 / Retry', exact: true }).filter({ visible: true }).click();
        await page.waitForFunction(() => ![...document.querySelectorAll('[data-document-media] [role=status]')].some(el => el.getClientRects().length));
        assert.equal(await editor.locator('[data-document-media]').count(), i + 1);
      }
      await page.keyboard.insertText('After photos 中文');
      await page.screenshot({ path: `${dir}/${name}-capture.png`, fullPage: true });
      await page.getByRole('button', { name: 'Save Entry', exact: true }).filter({ visible: true }).click();
      await page.waitForURL(/\/entries\/(?!new)[^/?]+$/);
      const id = new URL(page.url()).pathname.split('/').pop();
      const result = await db.query('select "contentMarkdown" from "Entry" where id=$1', [id]);
      const content = result.rows[0].contentMarkdown;
      const media = [...content.matchAll(/<!--labnest-media:([^\s]+)-->/g)].map(match => JSON.parse(decodeURIComponent(match[1])));
      assert.equal(media.length, 4);
      assert.equal(new Set(media.map(item => item.attachmentId)).size, 4);
      assert(content.includes('After photos 中文'));
      const assets = await db.query('select count(*)::int as count from "Attachment" where id=any($1)', [media.map(item => item.attachmentId)]);
      assert.equal(assets.rows[0].count, 4);
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.locator('main .ln-protocol-media-preview img').count(), 4);
      await page.goto(base + `/entries/${id}/edit`, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('[contenteditable=true]:visible [data-document-media]').count(), 4);
      for (const width of [390, 820, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} ${width}: page overflow`);
      }
      checks.push({ browser: name, passed: true, photos: 4, retry: true, saveRefreshEdit: true, databaseReadback: true, viewportWidths: [390, 820, 1440] });
      await context.close();
    } finally { await browser.close(); }
  }
  console.log(JSON.stringify(checks));
} finally {
  await writeFile(`${dir}/report.json`, JSON.stringify({ synthetic: true, checks }, null, 2));
  await db.end();
}
