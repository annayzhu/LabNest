import { chromium } from 'playwright';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

// Synthetic image, same bytes and detection controls on both production builds.
const svg = `<svg width="900" height="900" xmlns="http://www.w3.org/2000/svg"><rect width="900" height="900" fill="white"/>${Array.from({ length: 225 }, (_, i) => `<circle cx="${30 + i % 15 * 60}" cy="${30 + Math.floor(i / 15) * 60}" r="8" fill="black"/>`).join('')}</svg>`;
const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
const browser = await chromium.launch();
const report = { at: new Date().toISOString(), browser: browser.version(), fixture: '900×900, 225 synthetic circles', phases: [] };
try {
  for (const [phase, base] of [['before', process.env.LABNEST_OLD_BASE_URL || 'http://localhost:3000'], ['after', process.env.LABNEST_E2E_BASE_URL || 'http://localhost:3223']]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const samples = [];
    for (let iteration = 0; iteration < 10; iteration++) {
      await page.goto(base + '/tools/calculator/colony-counter', { waitUntil: 'networkidle' });
      const start = performance.now();
      await page.locator('input[type=file]').first().setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer });
      await page.waitForFunction(() => document.querySelector('canvas')?.width === 900);
      const inputMs = performance.now() - start;
      const detectionStart = performance.now();
      await page.getByRole('button', { name: 'Detect again', exact: true }).click();
      assert((await page.locator('main').innerText()).includes('225'));
      samples.push({ iteration, inputMs, calculateMs: performance.now() - detectionStart, count: 225 });
    }
    const stats = Object.fromEntries(['inputMs', 'calculateMs'].map(key => {
      const values = samples.map(sample => sample[key]).sort((a, b) => a - b);
      return [key, { median: (values[4] + values[5]) / 2, max: values[9], n: 10 }];
    }));
    report.phases.push({ phase, base, samples, stats });
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile('docs/calculator/v1.3/evidence/performance-image.json', JSON.stringify(report, null, 2));
}
