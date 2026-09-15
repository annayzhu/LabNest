import {openCalculatorDisclosure} from './calculator-ui-test-helpers.mjs';
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const browser = await chromium.launch();
const page = await browser.newPage();
const base = process.env.LABNEST_E2E_BASE_URL || 'http://localhost:3223';
const report = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), checks: [] };
try {
  await page.goto(base + '/tools/calculator/dilution', { waitUntil: 'networkidle' });
  await openCalculatorDisclosure(page,'Offline use');
  await page.getByRole('button', { name: /^(Prepare offline|Update offline content|Retry)$/ }).click();
  await page.getByText(/^Available offline:/).waitFor({ timeout: 60000 });
  const before = await page.evaluate(() => caches.keys());
  // Inject only the worker's negative acknowledgement. Actual page/button/error UI remains intact.
  await page.evaluate(() => {
    const original = ServiceWorker.prototype.postMessage;
    window.restoreWorkerMessaging = () => { ServiceWorker.prototype.postMessage = original; };
    ServiceWorker.prototype.postMessage = function (data, ports) {
      if (data.type === 'CLEAR_CALCULATOR') {
        ports[0].postMessage({ ok: false, kind: 'resource', detail: 'synthetic storage deletion denied' });
        return;
      }
      return original.call(this, data, ports);
    };
  });
  await page.getByRole('button', { name: 'Clear offline caches', exact: true }).click();
  await page.getByText('Could not clear caches; retry clearing.', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => caches.keys()), before);
  report.checks.push('Negative worker reply displays failure, retains real prepared caches, never reports cleared');
  await page.evaluate(() => window.restoreWorkerMessaging());
  await page.getByRole('button', { name: 'Clear offline caches', exact: true }).click();
  await page.getByText('Offline caches cleared; drafts, presets, history and sync queue retained.', { exact: true }).waitFor();
  assert(!(await page.evaluate(() => caches.keys())).some(name => name.startsWith('labnest-calculator')));
  report.checks.push('Retry with actual worker deletes tool cache and then reports success');
} catch (error) {
  report.error = String(error);
  throw error;
} finally {
  await writeFile('docs/calculator/v1.3/evidence/cache-clear-report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
