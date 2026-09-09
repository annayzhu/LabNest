import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const { experimentId } = JSON.parse(readFileSync('docs/debug-20260909/evidence/run-fixture.json'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await page.goto(`http://localhost:3232/experiments/${experimentId}/run`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '添加', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('名称', { exact: true }).fill('延迟保存草稿');
  let release;
  let intercepted;
  const started = new Promise(resolve => { intercepted = resolve; });
  const delayed = new Promise(resolve => { release = resolve; });
  await page.route('**/api/experiments/*/materials', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    intercepted();
    await delayed;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '合成延迟失败' }) });
  });
  await dialog.getByRole('button', { name: '保存使用记录', exact: true }).click();
  await started;
  assert.equal(await dialog.getByRole('button', { name: '关闭', exact: true }).isDisabled(), true);
  await page.keyboard.press('Escape');
  assert.equal(await dialog.isVisible(), true);
  assert.equal(await dialog.getByLabel('名称', { exact: true }).inputValue(), '延迟保存草稿');
  release();
  await dialog.getByRole('alert').filter({ hasText: '合成延迟失败' }).waitFor();
  assert.equal(await dialog.getByLabel('名称', { exact: true }).inputValue(), '延迟保存草稿');
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '添加', exact: true }).click();
  assert.equal(await dialog.getByLabel('名称', { exact: true }).inputValue(), '延迟保存草稿');
  writeFileSync('docs/debug-20260909/evidence/final-save-race.json', JSON.stringify({ checks: ['Pending request disables close', 'Escape keeps current session', 'Failed response retains draft', 'Reopen restores draft'], result: 'passed' }, null, 2));
} finally { await browser.close(); }
