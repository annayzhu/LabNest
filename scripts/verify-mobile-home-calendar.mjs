import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import pg from 'pg';

const database = new URL(process.env.DATABASE_URL ?? '');
assert(['localhost', '127.0.0.1'].includes(database.hostname) && database.pathname === '/labnest_mobile_qa', 'Use only the disposable mobile QA database.');
const base = process.env.LABNEST_E2E_BASE_URL ?? 'http://127.0.0.1:3219';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname) && new URL(base).port === '3219');
const evidence = `${process.env.MOBILE_REPAIR_EVIDENCE ?? '.local-runtime/mobile-calendar'}/calendar`;
await mkdir(evidence, { recursive: true });
const db = new pg.Client({ connectionString: database.toString() });
const fixtures = [
  ['neighbor-september', '2026-09-28', 'QA calendar September neighbor'],
  ['first-day', '2026-10-01', 'QA calendar First day'],
  ['neighbor-november', '2026-11-01', 'QA calendar November neighbor'],
  ...Array.from({ length: 6 }, (_, index) => [`agenda-${index}`, '2026-10-21', `QA calendar agenda ${index}`]),
].map(([id, date, title]) => ({ id: `qa-home-calendar-${id}`, date: new Date(`${date}T12:00:00`), title }));
const report = { synthetic: true, checks: [], physicalTouch: 'Not executed' };
await db.connect();
try {
  for (const row of fixtures) await db.query('INSERT INTO "Entry" (id,title,body,"occurredAt","updatedAt") VALUES ($1,$2,$3,$4,now()) ON CONFLICT (id) DO UPDATE SET "occurredAt"=$4', [row.id, row.title, 'Synthetic calendar acceptance', row.date]);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const agendaStart = new Date('2026-10-21T00:00:00');
  const agendaEnd = new Date('2026-10-22T00:00:00');
  const agendaCount = Number((await db.query('SELECT (SELECT count(*) FROM "Entry" WHERE "occurredAt">=$1 AND "occurredAt"<$2)+(SELECT count(*) FROM "Experiment" WHERE date>=$1 AND date<$2) AS count', [agendaStart, agendaEnd])).rows[0].count);
  const running = Number((await db.query('SELECT count(*) FROM "Experiment" WHERE status=\'running\'')).rows[0].count);
  const planned = Number((await db.query('SELECT count(*) FROM "Experiment" WHERE status=\'planned\' AND date >= $1 AND date < $2', [start, end])).rows[0].count);
  for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await type.launch();
    try {
      for (const [width, locale] of [[320, 'en'], [390, 'zh'], [820, 'en'], [1440, 'en']]) {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, isMobile: width < 1024, hasTouch: width < 1024, locale: locale === 'zh' ? 'zh-CN' : 'en-US', timezoneId: 'America/Los_Angeles', reducedMotion: 'reduce' });
        await context.addCookies([{ name: 'labnest_locale', value: locale, url: base }]);
        const page = await context.newPage(); page.setDefaultTimeout(15_000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        try {
          await page.goto(`${base}/?month=2026-10`, { waitUntil: 'networkidle' });
          const home = page.locator('.bench-mobile');
          if (width >= 1024) {
            assert(await page.locator('.overview-desktop').isVisible()); assert(await home.isHidden());
          } else {
            assert.deepEqual(await home.locator(':scope > header dd').allTextContents(), [String(running), String(planned)]);
            const actions = home.locator('nav a');
            assert.deepEqual(await actions.evaluateAll(nodes => nodes.map(node => node.getAttribute('href'))), ['/protocol-run', '/entries/new?mode=capture', '/tools/calculator', '/tools']);
            assert((await actions.nth(2).innerText()).includes(locale === 'zh' ? '配液与单位换算' : 'Mixes and conversions'));
            const today = home.locator('section[aria-labelledby="mobile-today-title"]');
            assert((await today.innerText()).includes('QA overnight experiment')); assert(!(await today.innerText()).includes('QA completed experiment'));
            const calendar = home.locator('section[aria-labelledby="mobile-calendar-title"]');
            const openDays = calendar.locator('.ln-mobile-calendar-week:not([inert]) button');
            assert.equal(await openDays.count(), 7);
            const expand = calendar.getByRole('button', { name: locale === 'zh' ? '展开整月' : 'Show month', exact: true });
            await expand.click(); assert.equal(await openDays.count(), 42);
            for (const [label, title] of [
              [locale === 'zh' ? /9月28日 / : /September 28,/, 'QA calendar September neighbor'],
              [locale === 'zh' ? /11月1日 / : /November 1,/, 'QA calendar November neighbor'],
              [locale === 'zh' ? /10月1日 / : /October 1,/, 'QA calendar First day'],
            ]) {
              await calendar.getByRole('button', { name: label }).click();
              await calendar.getByRole('link', { name: new RegExp(title) }).waitFor();
            }
            await calendar.getByRole('button', { name: locale === 'zh' ? /10月21日 / : /October 21,/ }).click();
            assert.equal(await calendar.locator('ul > li > a').count(), 4);
            assert.equal(await calendar.locator('h3 + span').textContent(), `${agendaCount} ${locale === 'zh' ? '项' : 'items'}`);
            await calendar.getByRole('link', { name: locale === 'zh' ? /还有 .*项，在月历中查看/ : /more in the monthly calendar/ }).waitFor();
            await calendar.getByRole('button', { name: locale === 'zh' ? '收起为一周' : 'Show week', exact: true }).click();
            assert.equal(await openDays.count(), 7);
            const next = calendar.getByRole('button', { name: locale === 'zh' ? '下一周' : 'Next week', exact: true });
            const before = await calendar.locator('button[aria-pressed="true"]').getAttribute('aria-label');
            await next.click(); assert.notEqual(await calendar.locator('button[aria-pressed="true"]').getAttribute('aria-label'), before);
            await calendar.getByRole('button', { name: locale === 'zh' ? '上一周' : 'Previous week', exact: true }).click();
            await page.screenshot({ path: `${evidence}/${engine}-${width}-${locale}.png`, fullPage: true });
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          }
          assert.deepEqual(errors, [], 'No hydration or browser errors when the phone timezone differs from the server.');
          report.checks.push({ engine, width, locale, passed: true });
        } catch (error) {
          report.failure = { engine, width, locale, message: error.message, body: (await page.locator('body').innerText()).slice(0, 5000) };
          await page.screenshot({ path: `${evidence}/failure.png`, fullPage: true }); throw error;
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
  console.log(`PASS ${report.checks.length} mobile home/calendar browser cases`);
} finally {
  await db.query('DELETE FROM "Entry" WHERE id = ANY($1::text[])', [fixtures.map(row => row.id)]);
  await db.end(); await writeFile(`${evidence}/report.json`, JSON.stringify(report, null, 2));
}
