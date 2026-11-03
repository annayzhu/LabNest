import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.BASE_URL ?? 'http://localhost:3002';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto(`${base}/research-plans/new`);
  await page.locator('.tiptap').waitFor();
  assert.equal(await page.getByRole('button', { name: 'qPCR 板布局', exact: true }).count(), 0, 'qPCR is offered on demand, not as a fixed section action');
  const section = page.locator('.tiptap section[data-section-key]').first();
  const sectionKey = await section.getAttribute('data-section-key');
  await section.locator('p').first().click();
  await page.keyboard.type('/qpcr');
  await page.getByRole('option', { name: 'qPCR 板布局', exact: true }).click();
  const frame = page.frameLocator('iframe[title="qPCR 板布局"]');
  await frame.getByRole('button', { name: '载入示例', exact: true }).click();
  await frame.getByRole('button', { name: '生成布局', exact: true }).click();
  await page.getByRole('button', { name: '保存到计划', exact: true }).click();
  await page.locator('.qpcr-output').waitFor();
  assert.equal(await page.locator('.qpcr-output').evaluate(el => el.closest('[data-section-key]')?.dataset.sectionKey), sectionKey, 'output stays in the section where slash was used');
  assert.doesNotMatch(await page.locator('.tiptap').innerText(), /\/qpcr/);
  await page.getByRole('button', { name: '编辑布局', exact: true }).click();
  await frame.getByRole('button', { name: '复制配液', exact: true }).waitFor();
  await page.getByRole('button', { name: '返回记录', exact: true }).click();
  console.log('PASS slash insertion, selected section, existing output editing');
} finally {
  await browser.close();
}
