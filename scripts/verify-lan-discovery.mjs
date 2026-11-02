import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import sharp from 'sharp';
import { BinaryBitmap, HybridBinarizer, RGBLuminanceSource, QRCodeReader } from '@zxing/library';

const base = process.env.LABNEST_E2E_BASE_URL || 'http://localhost:3001';
const output = process.env.LABNEST_E2E_OUTPUT || '/tmp/labnest-lan-qa';
await mkdir(output, { recursive: true });
const result = [];
for (const [engine, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await browserType.launch({ headless: true });
  try {
    for (const [locale, width] of [['en', 1440], ['zh', 390]]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addCookies([{ name: 'labnest_locale', value: locale, url: base }]);
      await context.addInitScript(locale => {
        localStorage.setItem('labnest.locale', locale);
        localStorage.setItem('labnest:lan-origin', 'http://192.168.99.99:9999');
      }, locale);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/protocol-run`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: locale === 'zh' ? '其他设备' : 'Other devices', exact: true }).first().click();
      const dialog = page.locator('dialog');
      const live = await (await context.request.get(`${base}/api/network-addresses`)).json();
      assert(live.addresses.length > 0, 'Host discovery must return a real LAN address');
      await dialog.locator('.ln-field-url').waitFor();
      const liveUrl = await dialog.locator('.ln-field-url').textContent();
      assert(live.addresses.includes(new URL(liveUrl).hostname));
      assert(!liveUrl.includes('192.168.99.99'), 'Previously saved IP must be ignored');
      assert.equal(await dialog.locator('input').count(), 1, 'Only a port field should be present');
      await dialog.locator('input').fill('3001');
      await page.waitForTimeout(100);
      const expected = await dialog.locator('.ln-field-url').textContent();
      const screenshot = await dialog.locator('.ln-field-qr').first().screenshot();
      const { data, info } = await sharp(screenshot).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
      const qr = new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(new Uint8ClampedArray(data), info.width, info.height)))).getText();
      assert.equal(qr, expected);
      assert.equal(new URL(qr).port, '3001');
      await dialog.locator('input').fill('65536');
      assert.equal(await dialog.locator('.ln-field-qr').count(), 0, 'Invalid port hides QR');
      await dialog.locator('input').fill('3001');
      // Simulate switching Wi-Fi while the panel stays open, then loss of discovery.
      let addresses = ['10.12.0.8'];
      await page.route('**/api/network-addresses', route => route.fulfill({ json: { addresses } }));
      await page.waitForFunction(() => document.querySelector('.ln-field-url')?.textContent?.includes('10.12.0.8'), null, { timeout: 10000 });
      addresses = [];
      await page.waitForFunction(() => !document.querySelector('.ln-field-qr'), null, { timeout: 10000 });
      addresses = live.addresses;
      await dialog.getByRole('button', { name: locale === 'zh' ? '重新识别' : 'Detect again', exact: true }).click();
      await dialog.locator('.ln-field-qr').first().waitFor();
      assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1));
      await dialog.screenshot({ path: `${output}/${engine}-${locale}-${width}.png` });
      assert.deepEqual(errors, []);
      result.push({ engine, locale, width, liveUrl, decodedQr: qr, checks: 'automatic host, stale storage ignored, editable port, QR decoding, network change, failure, retry, no horizontal overflow' });
      await context.close();
    }
  } finally { await browser.close(); }
}
await writeFile(`${output}/verification.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
