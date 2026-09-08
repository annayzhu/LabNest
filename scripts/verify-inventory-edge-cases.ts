import 'dotenv/config';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { prisma } from '../src/lib/db';

async function main() {
  if (new URL(process.env.DATABASE_URL!).pathname !== '/labnest_stage_a_acceptance') throw new Error('Isolated synthetic database only');
  const base = 'http://localhost:3233';
  const f = JSON.parse(readFileSync('docs/stage-20260908/A/run-fixture.json', 'utf8'));
  const browser = await chromium.launch(); const page = await browser.newPage(); const checks: string[] = [];
  try {
    const id = crypto.randomUUID();
    const endpoint = `${base}/api/experiments/${f.experimentId}/materials`;
    const before = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItemId } });
    await page.request.post(endpoint, { data: { action: 'save', id, name: 'Synthetic missing concentration', actual: 1, unit: 'mg', source: 'manual', inventoryItemId: f.inventoryItemId } });
    const confirmed = await (await page.request.post(endpoint, { data: { action: 'confirm', ids: [id] } })).json();
    assert.equal(confirmed[0].status, 'pending'); assert.ok(confirmed[0].error);
    assert.equal((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItemId } })).currentQuantity, before.currentQuantity);
    checks.push('Cross-dimension mg to mL without concentration stays pending with saved row; stock unchanged');

    const project = await prisma.project.create({ data: { name: 'Synthetic failure regression' } });
    const plan = await prisma.researchPlan.create({ data: { projectId: project.id, code: 'SYN-FAIL-' + Date.now(), title: 'Synthetic failure regression' } });
    await prisma.experiment.update({ where: { id: f.experimentId }, data: { researchPlanId: plan.id, projectId: project.id } });
    const transactionCount = await prisma.inventoryTransaction.count({ where: { experimentId: f.experimentId } });
    await page.goto(`${base}/experiments/${f.experimentId}/edit`);
    await page.getByRole('tab', { name: 'Metadata', exact: true }).click();
    await page.locator('input[name="status"][value="failed"]').check();
    await page.getByRole('button', { name: 'Save Experiment', exact: true }).click();
    await page.waitForURL(u => u.pathname === `/experiments/${f.experimentId}`);
    assert.equal((await prisma.experiment.findUniqueOrThrow({ where: { id: f.experimentId } })).status, 'failed');
    assert.equal(await prisma.inventoryTransaction.count({ where: { experimentId: f.experimentId } }), transactionCount);
    assert.equal((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItemId } })).currentQuantity, before.currentQuantity);
    checks.push('Changing experiment to failed through edit page preserves consumption ledger and stock balance');

    const quote = await prisma.procurementQuoteLine.findFirstOrThrow({ where: { status: 'candidate', productName: { startsWith: 'Synthetic quote' } }, orderBy: { createdAt: 'desc' } });
    await page.goto(base + '/purchases');
    const row = page.getByRole('row').filter({ hasText: quote.productName });
    await row.getByLabel('采购决定').selectOption('not_selected'); await row.getByLabel('决定理由').fill('合成验收：保留未选报价');
    await row.getByRole('button', { name: '保存决定', exact: true }).click(); await row.getByRole('status').waitFor();
    await page.reload();
    assert.equal((await prisma.procurementQuoteLine.findUniqueOrThrow({ where: { id: quote.id } })).status, 'not_selected');
    const downloaded = page.waitForEvent('download'); await page.getByRole('link', { name: '导出报价比较', exact: true }).click(); assert.ok((await downloaded).suggestedFilename().endsWith('.csv'));
    checks.push('Quote decision saved through page and retained after reload; export link downloads CSV');
  } finally { writeFileSync('docs/stage-20260908/A/evidence/edge-cases.json', JSON.stringify({ checks }, null, 2)); await browser.close(); await prisma.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
