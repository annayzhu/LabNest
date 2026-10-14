import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { prisma } from '../src/lib/db';
import { createExperimentWithProtocolSnapshot } from '../src/lib/experiments';
import { projectProtocolDocument } from '../src/lib/protocol-document';
import { updateRunSystemSelection, recordStructuredStep } from '../src/lib/structured-run.server';
import { POST as completeStep } from '../src/app/api/mobile/step-completions/route';
import { structuredProtocolFixture } from './fixtures/structured-protocol';

async function main() {
const db = new URL(process.env.DATABASE_URL!);
assert(['127.0.0.1', 'localhost'].includes(db.hostname) && db.port === '55439' && db.pathname === '/labnest_structured_20261014', 'Use the dedicated synthetic database only.');
const out = 'docs/structured-protocol/20261014/evidence';
await mkdir(out, { recursive: true });
try {
  const key = randomUUID();
  const project = await prisma.project.create({ data: { name: `合成体系验收 ${key}` } });
  const plan = await prisma.researchPlan.create({ data: { projectId: project.id, code: `SYN-${key}`, title: '合成规程完整链验证' } });
  const document = structuredProtocolFixture(), projection = projectProtocolDocument(document);
  const protocol = await prisma.protocol.create({ data: { humanCode: `SYN-${key}`, title: '350／600 µL 合成规程', canonicalTitle: '350／600 µL 合成规程' } });
  const version = await prisma.protocolVersion.create({ data: { protocolId: protocol.id, revision: 1, displayVersion: '1.0', title: protocol.title, contentJson: JSON.parse(JSON.stringify(document)), stepsJson: JSON.parse(JSON.stringify(projection.steps)) } });
  const experiment = await createExperimentWithProtocolSnapshot({ creationKey: key, researchPlanId: plan.id, title: '体系执行验收', date: new Date(), status: 'planned', recordStatus: 'draft', tags: ['synthetic'], contentJson: {}, methodMode: 'protocol', protocolVersionIds: [version.id], customSteps: [] });
  const before = await prisma.experiment.findUniqueOrThrow({ where: { id: experiment.id }, include: { steps: true, protocolRun: true } });
  assert.equal(before.steps.length, 4);
  await updateRunSystemSelection({ experimentId: experiment.id, versionId: version.id, expectedRevision: 0, selections: { volume: 'small', sample: 'normal' }, actualInputs: {} });
  const after = await prisma.experiment.findUniqueOrThrow({ where: { id: experiment.id }, include: { steps: true, protocolRun: true } });
  assert.equal((after.protocolRun!.executionPlanJson as { revision: number }).revision, 1);
  assert.deepEqual(after.steps.map(s => s.id), before.steps.map(s => s.id));
  assert.deepEqual(after.protocolSnapshotJson, before.protocolSnapshotJson);
  await assert.rejects(updateRunSystemSelection({ experimentId: experiment.id, versionId: version.id, expectedRevision: 0, selections: { volume: 'large' }, actualInputs: {} }), /变更|changed/);
  const dose = after.steps.find(s => s.protocolStepRef === `${version.id}:dose`)!;
  const mutation = { experimentId: experiment.id, stepId: dose.id, expectedRevision: 1, clientMutationId: randomUUID(), intent: 'actual' as const, values: { 'actual-proteinase': { value: 50, unit: 'µL' } } };
  await recordStructuredStep(mutation); await recordStructuredStep(mutation);
  assert.equal(await prisma.experimentStepEvent.count({ where: { clientMutationId: mutation.clientMutationId } }), 1);
  const completion = { experimentId: experiment.id, experimentStepId: dose.id, executionPlanRevision: 2, clientMutationId: randomUUID(), deviceCreatedAt: new Date().toISOString() };
  assert.equal((await completeStep(new Request('http://localhost/api/mobile/step-completions', { method: 'POST', body: JSON.stringify(completion) }))).status, 201);
  await assert.rejects(updateRunSystemSelection({ experimentId: experiment.id, versionId: version.id, expectedRevision: 2, selections: { volume: 'large', sample: 'normal' }, actualInputs: {} }), /继续实例|continuation/);
  const continued = await updateRunSystemSelection({ experimentId: experiment.id, versionId: version.id, expectedRevision: 2, selections: { volume: 'large', sample: 'normal' }, actualInputs: {}, continuationKey: randomUUID() });
  assert.notEqual(continued.experimentId, experiment.id);
  const continuation = await prisma.experiment.findUniqueOrThrow({ where: { id: continued.experimentId }, include: { steps: true, protocolRun: true } });
  assert(continuation.steps.every(s => !s.completed && !s.timerStartedAt));
  assert.equal((continuation.protocolRun!.executionPlanJson as { continuation: { experimentId: string } }).continuation.experimentId, experiment.id);
  assert((await prisma.experimentStep.findUniqueOrThrow({ where: { id: dose.id } })).completed);
  await writeFile(`${out}/fixtures.json`, JSON.stringify({ projectId: project.id, planId: plan.id, protocolId: protocol.id, versionId: version.id, experimentId: experiment.id }, null, 2));
  console.log('PASS: real isolated database creation, confirmation, stable IDs, frozen source, stale rejection, idempotent actual values, guarded public completion, linked continuation and preserved prior records');
} finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
