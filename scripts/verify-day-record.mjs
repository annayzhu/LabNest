// Real-path checks for the day-by-day experiment record (Q426–Q434), on synthetic experiments only:
// EXP-901 (five days, a Protocol across two days, an item, an empty day, a step on no day), EXP-902 (no schedule) and EXP-903 (twelve days).
// Seed them with docs/modules/structured-protocol/day-record-20261109/seed.sql into a test database, then:
//   BASE_URL=http://localhost:3002 node scripts/verify-day-record.mjs
// Reads only; it never ticks a step.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { useChineseInterface as chineseInterface } from './qpcr-browser-helpers.mjs';

const base = process.env.BASE_URL ?? 'http://localhost:3002';
assert.notEqual(new URL(base).port, '3001', '3001 is the formal service.');
const out = process.env.EVIDENCE_DIR ?? '.local-runtime/day-record-20261109';
mkdirSync(out, { recursive: true });
const sizes = [[1366, 768], [1440, 900], [1920, 1080], [768, 1024], [375, 812]];
const report = [];

/** Sizes, fonts and overflow of the summary and the day headings, as the page lays them out. */
const measure = page => page.evaluate(() => {
  const summary = document.querySelector('.ln-day-summary');
  const texts = [...document.querySelectorAll('.ln-day-summary *, .ln-execution-day *')].filter(element => [...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim()));
  const tiles = [...document.querySelectorAll('.ln-day-summary-tile')];
  return {
    summaryHeight: summary ? Math.round(summary.getBoundingClientRect().height) : 0,
    tiles: tiles.length,
    columns: new Set(tiles.map(tile => Math.round(tile.getBoundingClientRect().left))).size,
    minFontPx: texts.length ? Math.min(...texts.map(element => parseFloat(getComputedStyle(element).fontSize))) : null,
    clipped: texts.filter(element => element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflow !== 'visible').length,
    pageScrollsSideways: document.documentElement.scrollWidth > innerWidth,
    days: [...document.querySelectorAll('.ln-execution-day')].map(day => day.innerText.replace(/\n/g, ' | ')),
  };
});

const browser = await chromium.launch();
try {
  for (const [width, height] of sizes) {
    const context = await browser.newContext({ viewport: { width, height } });
    await chineseInterface(context, base);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto(`${base}/experiments/syn-dr-1`);
    await page.locator('#execution-day-1').waitFor();
    const five = await measure(page);
    assert.deepEqual(five.days.map(day => day.split(' | ')[0]), ['第 1 天 · 11/09 周一', '第 2 天 · 11/10 周二', '第 3 天 · 11/11 周三', '第 4 天 · 11/12 周四', '第 5 天 · 11/13 周五', '未安排的步骤']);
    assert.equal(five.tiles, 5, 'one tile per day');
    assert(five.minFontPx >= 12, `smallest text ${five.minFontPx}px`);
    assert.equal(five.clipped, 0, 'no clipped text');
    assert.equal(five.pageScrollsSideways, false, 'no sideways page scroll');
    // A Protocol across two days reads by its steps on each; the sidebar no longer repeats the schedule.
    assert.match(await page.locator('#section-execution').innerText(), /质粒转染 · 第 1–2 步[\s\S]*质粒转染 · 第 3–4 步/);
    assert.doesNotMatch(await page.locator('.document-preview-sidebar').innerText(), /日程 \d/);
    // A tile jumps to its day.
    await page.locator('.ln-day-summary-tile').nth(3).click();
    await page.waitForFunction(() => location.hash === '#execution-day-4');
    const top = await page.locator('#execution-day-4').evaluate(element => Math.round(element.getBoundingClientRect().top));
    assert(top >= 0 && top < height / 2, `day 4 scrolled into view (top ${top}px)`);
    await page.evaluate(() => scrollTo(0, 0));
    await page.locator('.ln-day-summary').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/five-days-${width}.png` });

    await page.goto(`${base}/experiments/syn-dr-3`);
    await page.locator('#execution-day-1').waitFor();
    const twelve = await measure(page);
    assert.deepEqual(twelve.days.map(day => day.split(' | ')[0]), ['第 1 天 · 11/02 周一', '第 2–3 天 · 11/03–11/04', '第 4 天 · 11/05 周四', '第 5–7 天 · 11/06–11/08', '第 8 天 · 11/09 周一', '第 9–11 天 · 11/10–11/12', '第 12 天 · 11/13 周五']);
    assert.equal(twelve.tiles, 7, 'empty days in a row share a tile');
    await page.locator('.ln-day-summary').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/twelve-days-${width}.png` });

    await page.goto(`${base}/experiments/syn-dr-2`);
    await page.locator('#section-execution').waitFor();
    const none = await measure(page);
    assert.equal(none.tiles + none.days.length, 0, 'an experiment without a schedule reads as before');

    if (width === 1440) {
      await page.goto(`${base}/experiments/syn-dr-1`);
      await page.locator('#execution-day-1').waitFor();
      await page.emulateMedia({ media: 'print' });
      await page.pdf({ path: `${out}/five-days-print.pdf`, format: 'A4', printBackground: true });
      await page.emulateMedia({ media: 'screen' });
      await page.goto(`${base}/experiments/syn-dr-1/edit`);
      await page.locator('.ln-execution-day').first().waitFor();
      assert.equal(await page.locator('.ln-execution-day').count(), 6, 'the edit page shows the same days');
    }
    assert.deepEqual(errors, [], `page errors at ${width}`);
    report.push({ viewport: `${width}x${height}`, fiveDays: { ...five, days: five.days.length }, twelveDays: { summaryHeight: twelve.summaryHeight, tiles: twelve.tiles, columns: twelve.columns, headings: twelve.days.length } });
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
