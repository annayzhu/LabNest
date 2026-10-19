import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { prisma } from '../src/lib/db';
import { createEmptyProtocolDocument, projectProtocolDocument, type ProtocolDocument } from '../src/lib/protocol-document';
import { createExperimentWithProtocolSnapshot } from '../src/lib/experiments';
import { confirmRunMix } from '../src/lib/run-mix.server';
import { updateRunSystemSelection } from '../src/lib/structured-run.server';
import { mixState, stepMixes, structuredRunView } from '../src/lib/structured-run';

async function main() {
  const db = new URL(process.env.DATABASE_URL!);
  assert(['127.0.0.1', 'localhost'].includes(db.hostname) && ((db.port === '5543' && db.pathname === '/labnest_calculator_review') || (process.env.CI === 'true' && db.port === '5432' && db.pathname === '/labnest_test')), 'Dedicated synthetic database only');
  const base = process.env.LABNEST_E2E_BASE_URL ?? 'http://localhost:3339';
  assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname) && !['3001', '3002', '3005'].includes(new URL(base).port));
  const out = process.env.CALCULATOR_REVIEW_EVIDENCE_DIR ?? '/tmp/labnest-calculator-review-evidence';
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  await context.addInitScript(() => localStorage.setItem('labnest.locale', 'en'));
  const page = await context.newPage();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const checks: string[] = [];
  try {
    const key = randomUUID();
    const project = await prisma.project.create({ data: { name: `Synthetic Calculator review ${key}` } });
    const plan = await prisma.researchPlan.create({ data: { projectId: project.id, code: `SYN-${key}`, title: 'Calculator review' } });
    async function version(document: ProtocolDocument) {
      const protocol = await prisma.protocol.create({ data: { title: 'Synthetic mix review', canonicalTitle: 'Synthetic mix review', humanCode: `SYN-${randomUUID()}` } });
      return prisma.protocolVersion.create({ data: { protocolId: protocol.id, revision: 1, displayVersion: '1.0', title: protocol.title, contentJson: JSON.parse(JSON.stringify(document)), stepsJson: JSON.parse(JSON.stringify(projectProtocolDocument(document).steps)) } });
    }
    async function run(versionId: string) {
      return createExperimentWithProtocolSnapshot({ creationKey: randomUUID(), researchPlanId: plan.id, title: 'Synthetic mix run', date: new Date(), status: 'planned', recordStatus: 'draft', tags: ['synthetic'], contentJson: {}, methodMode: 'protocol', protocolVersionIds: [versionId], customSteps: [] });
    }
    const readRun = (id: string) => prisma.experiment.findUniqueOrThrow({ where: { id }, include: { protocolRun: true, steps: true } });
    const document = createEmptyProtocolDocument(); document.executionConfirmed = true;
    document.systems = { schemaVersion: 1, dimensions: [{ id: 'plate', label: 'Plate', options: [{ id: 'large', label: '6 wells' }, { id: 'small', label: '12 wells' }] }], presets: [], restrictions: [], rules: [], parameters: [250, 125].map((value, index) => ({ id: `amount-${index}`, label: 'Opti-MEM', unit: 'µL', origin: 'chip' as const, source: { kind: 'fixed' as const, value, unit: 'µL' } })) };
    document.sections.find(section => section.key === 'background')!.blocks = [{ id: 'background', type: 'rich_text', nodes: Array.from({ length: 20 }, (_, i) => ({ type: 'paragraph' as const, content: [{ text: `Synthetic context paragraph ${i + 1}. Preserve source and selected system amounts.` }] })) }];
    document.sections.find(section => section.key === 'steps')!.blocks = [
      { id: 'step', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: 'Prepare the selected system.' }] }], execution: { role: 'step', format: 'block', stepId: 'prepare' } },
      { id: 'recipe', type: 'table', rows: [['Reagent', '6 wells', '12 wells'], ['Opti-MEM', '{{amount-0}}', '{{amount-1}}']], columnConditions: [null, { dimensionId: 'plate', optionId: 'large' }, { dimensionId: 'plate', optionId: 'small' }], execution: { role: 'detail', stepId: 'prepare' } },
    ];
    const source = await version(document);
    await page.goto(`${base}/protocols/${source.protocolId}/versions/${source.id}/edit`, { waitUntil: 'networkidle' });
    await page.locator('#protocol-section-steps table td').first().click();
    await page.getByRole('toolbar', { name: 'Table', exact: true }).getByRole('button', { name: 'Turn into mix card', exact: true }).click();
    await page.locator('.ln-mix-editor').waitFor();
    await page.getByRole('button', { name: 'Save Protocol', exact: true }).click();
    await page.waitForURL(url => url.pathname === `/protocols/${source.protocolId}`);
    const saved = await prisma.protocolVersion.findUniqueOrThrow({ where: { id: source.id } });
    const converted = saved.contentJson as unknown as ProtocolDocument;
    assert(converted.sections.flatMap(section => section.blocks).some(block => block.type === 'mix'));
    await page.goto(`${base}/protocols/${source.protocolId}/versions/${source.id}/edit`, { waitUntil: 'networkidle' });
    const reopened = JSON.parse(await page.locator('input[name="contentJson"]').inputValue());
    assert(reopened.systems.parameters.some((parameter: { source: { kind: string; values?: { value: number }[] } }) => parameter.source.kind === 'lookup' && parameter.source.values?.some(value => value.value === 125)));
    checks.push('Actual table conversion, save and reopen retain both system values');

    const positive = await run(source.id);
    await updateRunSystemSelection({ experimentId: positive.id, versionId: source.id, expectedRevision: 0, selections: { plate: 'small' }, actualInputs: {} });
    let state = await readRun(positive.id);
    let view = structuredRunView(state.protocolSnapshotJson, state.protocolRun!.executionPlanJson, state.steps);
    const step = state.steps[0];
    const mix = stepMixes(view, step.id)[0]; assert(mix);
    // Use the public service, including a stale-value fingerprint computed for the submitted quantity.
    const { mixView } = await import('../src/lib/protocol-mix');
    const selected = mixState(view, step.id, mix);
    const live = mixView(mix, selected.version?.document.systems, selected.version?.parameters ?? {}, 6);
    assert(Math.abs(live.lines[0].total! - 825) < 1e-9);
    await confirmRunMix({ experimentId: positive.id, stepId: step.id, mixId: mix.id, expectedRevision: view.plan.revision, quantity: 6, quantitySource: 'card', fingerprint: live.fingerprint });
    state = await readRun(positive.id); view = structuredRunView(state.protocolSnapshotJson, state.protocolRun!.executionPlanJson, state.steps);
    assert(Math.abs(view.plan.mixes[`${step.id}:${mix.id}`].lines[0].total - 825) < 1e-9);
    for (const width of [1440, 820, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${base}/experiments/${positive.id}/run`, { waitUntil: 'networkidle' });
      assert.match(await page.locator('.ln-mix-card.is-run:visible').innerText(), /825\s*µL/);
      assert(await page.evaluate(() => window.document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: `${out}/mix-${width}.png`, fullPage: true });
    }
    checks.push('Selected second system confirms 825 µL; database receipt and desktop/tablet/phone views agree');

    const invalidDocument = structuredClone(converted);
    invalidDocument.systems!.dimensions = [];
    const amountId = /^\{\{(.+)\}\}$/.exec(mix.components[0].amount)![1];
    invalidDocument.systems!.parameters = [{ id: amountId, label: 'Invalid volume', unit: 'µL', source: { kind: 'fixed', value: -5, unit: 'µL' } }];
    const invalidVersion = await version(invalidDocument), invalid = await run(invalidVersion.id);
    const before = await readRun(invalid.id);
    const invalidView = structuredRunView(before.protocolSnapshotJson, before.protocolRun!.executionPlanJson, before.steps);
    const invalidStep = before.steps[0], invalidMix = stepMixes(invalidView, invalidStep.id)[0];
    await assert.rejects(confirmRunMix({ experimentId: invalid.id, stepId: invalidStep.id, mixId: invalidMix.id, expectedRevision: invalidView.plan.revision, quantity: 24, quantitySource: 'card', fingerprint: 'forged' }), /undetermined amounts/);
    assert.deepEqual((await readRun(invalid.id)).protocolRun!.executionPlanJson, before.protocolRun!.executionPlanJson);
    assert.equal(await prisma.experimentStepEvent.count({ where: { experimentId: invalid.id, eventType: 'mix_confirmed' } }), 0);
    await page.goto(`${base}/experiments/${invalid.id}/run`, { waitUntil: 'networkidle' });
    assert(await page.locator('.ln-mix-card.is-run:visible').getByRole('button', { name: 'Confirm mix card', exact: true }).isDisabled());
    assert(!/-132/.test(await page.locator('.ln-mix-card.is-run:visible').innerText()));
    checks.push('Server rejects negative volume without changing the plan or writing a confirmation event');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/tools/calculator/unit-converter?locale=en`, { waitUntil: 'networkidle' });
    await page.locator('.calculator-workbench[aria-busy="false"]').waitFor();
    await page.locator('[data-field-key="dimension"] select').selectOption('mass');
    await page.locator('[data-field-key="value"] input').fill('1');
    await page.locator('[data-field-key="fromUnit"] select').selectOption('pg');
    await page.locator('[data-field-key="toUnit"] select').selectOption('kg');
    await page.getByRole('button', { name: 'Calculate', exact: true }).click();
    assert.match(await page.locator('.calculator-result-values').innerText(), /1e-15/);
    await page.getByRole('button', { name: 'Copy', exact: true }).click();
    assert.match(await page.evaluate(() => navigator.clipboard.readText()), /1e-15 kg/);
    await page.screenshot({ path: `${out}/picogram-conversion.png`, fullPage: true });
    checks.push('1 pg → kg stays nonzero on screen and in actual clipboard');
    assert.deepEqual(errors, []);
    await writeFile(`${out}/report.json`, JSON.stringify({ checks, sourceVersion: source.id, positiveRun: positive.id, invalidRun: invalid.id }, null, 2));
    console.log(checks.join('\n'));
  } catch (error) { await page.screenshot({ path: `${out}/failure.png`, fullPage: true }); throw error; }
  finally { await browser.close(); await prisma.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
