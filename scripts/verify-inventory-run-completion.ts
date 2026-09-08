import 'dotenv/config';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { prisma } from '../src/lib/db';

async function main() {
  if (new URL(process.env.DATABASE_URL!).pathname !== '/labnest_stage_a_acceptance') throw new Error('Synthetic acceptance database only');
  const base = process.env.LABNEST_ACCEPTANCE_URL ?? 'http://localhost:3233';
  if (base !== 'http://localhost:3233') throw new Error('Isolated production acceptance server only');
  const f = JSON.parse(readFileSync('docs/stage-20260908/A/run-fixture.json', 'utf8'));
  const independent = await prisma.experiment.create({ data: { runCode: 'SYN-INDEPENDENT-' + Date.now(), title: 'Synthetic independent Run', status: 'running' } });
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  try {
    for (const id of [independent.id, f.experimentId]) {
      const before = await prisma.inventoryTransaction.count({ where: { experimentId: id } });
      await page.goto(`${base}/experiments/${id}/run`);
      await page.getByRole('checkbox', { name: 'I reviewed the run evidence and unresolved deviations.' }).check();
      await page.getByRole('button', { name: 'Complete run', exact: true }).click();
      await page.getByText('completed', { exact: true }).first().waitFor();
      assert.equal((await prisma.experiment.findUniqueOrThrow({ where: { id } })).status, 'completed');
      assert.equal(await prisma.inventoryTransaction.count({ where: { experimentId: id } }), before);
    }
    writeFileSync('docs/stage-20260908/A/evidence/run-completion.json', JSON.stringify({ fixture: 'Synthetic Run creation via Prisma; completion through real mobile page', checks: ['Run with no purchases/inventory completes', 'Run with pending insufficient consumption completes without automatic deduction or losing saved material rows'] }, null, 2));
  } finally { await browser.close(); await prisma.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
