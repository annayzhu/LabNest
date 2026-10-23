import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { prisma } from '../src/lib/db';
import { createExperimentWithProtocolSnapshot } from '../src/lib/experiments';
import { projectProtocolDocument } from '../src/lib/protocol-document';
import { updateRunSystemSelection, recordStructuredStep } from '../src/lib/structured-run.server';
import { updateExperiment } from '../src/app/experiments/actions';
import { createScientificDocument, experimentSections } from '../src/lib/scientific-document';
import { POST as completeStep } from '../src/app/api/mobile/step-completions/route';
import sharp from 'sharp';
import { POST as upload } from '../src/app/api/attachments/route';
import { structuredProtocolFixture } from './fixtures/structured-protocol';

async function main() {
const db = new URL(process.env.DATABASE_URL!);
assert(['127.0.0.1', 'localhost'].includes(db.hostname) && ((db.port === '55439' && db.pathname === '/labnest_structured_20261014') || (process.env.CI === 'true' && db.port === '5432' && db.pathname === '/labnest_protocol_consistency_ci')), 'Use the dedicated synthetic database only.');
const out = 'docs/modules/structured-protocol/20261014/evidence';
await mkdir(out, { recursive: true });
try {
  const key = randomUUID();
  const project = await prisma.project.create({ data: { name: `合成体系验收 ${key}` } });
  const plan = await prisma.researchPlan.create({ data: { projectId: project.id, code: `SYN-${key}`, title: '合成规程完整链验证' } });
  const document = structuredProtocolFixture();
  const attachmentIds: string[] = [];
  for (let index = 0; index < 4; index++) {
    const bytes = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="180"><rect width="600" height="180" fill="#edf2f0"/><circle cx="90" cy="90" r="48" fill="#315d78"/><text x="170" y="100" font-size="28" fill="#202e31">Synthetic image ${index + 1}</text></svg>`)).png().toBuffer();
    const form = new FormData(), mutationId = randomUUID(); form.set('file', new File([Uint8Array.from(bytes)], `合成图片${index + 1}.png`, { type: 'image/png' })); form.set('clientMutationId', mutationId);
    const request = () => new Request('http://localhost/api/attachments', { method: 'POST', body: form });
    const result = await upload(request()); assert.equal(result.status, 201);
    const { attachment } = await result.json(); attachmentIds.push(attachment.id);
    const replay = await upload(request()); assert.equal((await replay.json()).attachment.id, attachment.id);
    assert.equal(await prisma.attachment.count({ where: { clientMutationId: mutationId } }), 1);
    document.sections.find(s => s.key === 'steps')!.blocks.splice(5 + index, 0, { id: `sample-photo-${index}`, type: 'media', mediaType: 'image', attachmentId: attachment.id, url: '', filename: attachment.originalFilename, caption: `中文图注 ${index + 1} · 合成验收`, widthPercent: 70, execution: { role: 'detail', stepId: 'dose' } });
  }
  const projection = projectProtocolDocument(document);
  const protocol = await prisma.protocol.create({ data: { humanCode: `SYN-${key}`, title: '350／600 µL 合成规程', canonicalTitle: '350／600 µL 合成规程' } });
  const version = await prisma.protocolVersion.create({ data: { protocolId: protocol.id, revision: 1, displayVersion: '1.0', title: protocol.title, contentJson: JSON.parse(JSON.stringify(document)), stepsJson: JSON.parse(JSON.stringify(projection.steps)) } });
  const experiment = await createExperimentWithProtocolSnapshot({ creationKey: key, researchPlanId: plan.id, title: '体系执行验收', date: new Date(), status: 'planned', recordStatus: 'draft', tags: ['synthetic'], contentJson: {}, methodMode: 'protocol', protocolVersionIds: [version.id], customSteps: [] });
  const before = await prisma.experiment.findUniqueOrThrow({ where: { id: experiment.id }, include: { steps: true, protocolRun: true } });
  assert.equal(before.steps.length, 4);
  await updateRunSystemSelection({ experimentId: experiment.id, versionId: version.id, expectedRevision: 0, selections: { volume: 'small', sample: 'normal' }, confirmCalculations: ['take'], actualInputs: { target: { value: 10, unit: 'µM' } } });
  const after = await prisma.experiment.findUniqueOrThrow({ where: { id: experiment.id }, include: { steps: true, protocolRun: true } });
  assert.equal((after.protocolRun!.executionPlanJson as { revision: number }).revision, 1);
  assert.deepEqual(after.steps.map(s => s.id), before.steps.map(s => s.id));
  assert.deepEqual(after.protocolSnapshotJson, before.protocolSnapshotJson);
  await assert.rejects(updateRunSystemSelection({ experimentId: experiment.id, versionId: version.id, expectedRevision: 0, selections: { volume: 'large' }, actualInputs: { target: { value: 10, unit: 'µM' } } }), /变更|changed/);
  const dose = after.steps.find(s => s.protocolStepRef === `${version.id}:dose`)!;
  const mutation = { experimentId: experiment.id, stepId: dose.id, expectedRevision: 1, clientMutationId: randomUUID(), intent: 'actual' as const, values: { 'actual-proteinase': { value: 50, unit: 'µL' } } };
  await recordStructuredStep(mutation); await recordStructuredStep(mutation);
  assert.equal(await prisma.experimentStepEvent.count({ where: { clientMutationId: mutation.clientMutationId } }), 1);
  const completion = { experimentId: experiment.id, experimentStepId: dose.id, executionPlanRevision: 2, clientMutationId: randomUUID(), deviceCreatedAt: new Date().toISOString() };
  assert.equal((await completeStep(new Request('http://localhost/api/mobile/step-completions', { method: 'POST', body: JSON.stringify(completion) }))).status, 201);
  await assert.rejects(updateRunSystemSelection({ experimentId: experiment.id, versionId: version.id, expectedRevision: 3, selections: { volume: 'large', sample: 'normal' }, actualInputs: { target: { value: 10, unit: 'µM' } } }), /继续实例|continuation/);
  const continuationKey = randomUUID();
  const continued = await updateRunSystemSelection({ experimentId: experiment.id, versionId: version.id, expectedRevision: 3, selections: { volume: 'large', sample: 'normal' }, actualInputs: { target: { value: 10, unit: 'µM' } }, continuationKey, continuationStartRef: `${version.id}:incubate` });
  assert.notEqual(continued.experimentId, experiment.id);
  const repeat = await updateRunSystemSelection({ experimentId: experiment.id, versionId: version.id, expectedRevision: 3, selections: { volume: 'large', sample: 'normal' }, actualInputs: { target: { value: 10, unit: 'µM' } }, continuationKey, continuationStartRef: `${version.id}:incubate` });
  assert.equal(repeat.experimentId, continued.experimentId);
  const continuation = await prisma.experiment.findUniqueOrThrow({ where: { id: continued.experimentId }, include: { steps: true, protocolRun: true } });
  assert(continuation.steps.every(s => !s.completed && !s.timerStartedAt));
  assert.equal(continuation.steps[0].protocolStepRef, `${version.id}:incubate`);
  assert.equal(continuation.steps.length, 2);
  assert.equal((continuation.protocolRun!.executionPlanJson as { continuation: { experimentId: string } }).continuation.experimentId, experiment.id);
  assert((await prisma.experimentStep.findUniqueOrThrow({ where: { id: dose.id } })).completed);
  for (const [initialStatus, attemptedStatus] of [['planned', 'completed'], ['completed', 'running']] as const) {
    // Synthetic status fixtures exercise the public document save action, including forged forms.
    await prisma.experiment.update({ where: { id: continued.experimentId }, data: { status: initialStatus, recordStatus: 'recorded' } });
    const fresh = await prisma.experiment.findUniqueOrThrow({ where: { id: continued.experimentId } });
    const form = new FormData();
    for (const [name, value] of Object.entries({ id: fresh.id, researchPlanId: fresh.researchPlanId, title: fresh.title, date: fresh.date.toISOString(), status: attemptedStatus, recordStatus: 'recorded', methodMode: 'protocol', expectedUpdatedAt: fresh.updatedAt.toISOString(), contentJson: JSON.stringify(createScientificDocument(experimentSections)) })) form.set(name, value ?? '');
    const response = await updateExperiment({}, form);
    assert(response.error?.includes('执行状态由 Run'), response.error);
    assert.equal((await prisma.experiment.findUniqueOrThrow({ where: { id: fresh.id } })).status, initialStatus);
  }
  await prisma.experiment.update({ where: { id: continued.experimentId }, data: { status: 'planned', recordStatus: 'draft' } });
  const timerExperiment = await createExperimentWithProtocolSnapshot({ creationKey: randomUUID(), researchPlanId: plan.id, title: '合成活动计时器保护', date: new Date(), status: 'planned', recordStatus: 'draft', tags: ['synthetic'], contentJson: {}, methodMode: 'protocol', protocolVersionIds: [version.id], customSteps: [] });
  await updateRunSystemSelection({ experimentId: timerExperiment.id, versionId: version.id, expectedRevision: 0, selections: { volume: 'small', sample: 'normal' }, confirmCalculations: ['take'], actualInputs: { target: { value: 10, unit: 'µM' } } });
  const timerStep = await prisma.experimentStep.findFirstOrThrow({ where: { experimentId: timerExperiment.id, protocolStepRef: `${version.id}:dose` } });
  // Seed only the clock fact; exercise cancellation and continuation through the public service.
  const clock = new Date(Date.now() - 1000);
  await prisma.experimentStep.update({ where: { id: timerStep.id }, data: { timerStartedAt: clock, timerDurationSeconds: 600, timerRemainingSeconds: 600 } });
  const timerChange = { experimentId: timerExperiment.id, versionId: version.id, expectedRevision: 1, selections: { volume: 'large', sample: 'normal' }, actualInputs: { target: { value: 10, unit: 'µM' } }, continuationKey: randomUUID(), continuationStartRef: `${version.id}:dose` };
  await assert.rejects(updateRunSystemSelection(timerChange), /活动计时器/);
  assert.equal((await prisma.experimentStep.findUniqueOrThrow({ where: { id: timerStep.id } })).timerStartedAt?.toISOString(), clock.toISOString());
  const timerContinuation = await updateRunSystemSelection({ ...timerChange, cancelAffectedTimers: true });
  const cancelled = await prisma.experimentStep.findUniqueOrThrow({ where: { id: timerStep.id } });
  assert.equal(cancelled.timerStartedAt, null); assert(cancelled.timerPausedAt); assert(cancelled.timerRemainingSeconds! > 0);
  assert.equal(await prisma.experimentStepEvent.count({ where: { experimentStepId: timerStep.id, eventType: 'timer_cancelled_for_continuation' } }), 1);
  assert.equal((await updateRunSystemSelection({ ...timerChange, cancelAffectedTimers: true })).experimentId, timerContinuation.experimentId);
  const skipStep = await prisma.experimentStep.findFirstOrThrow({ where: { experimentId: timerContinuation.experimentId, protocolStepRef: `${version.id}:incubate` } });
  const skip = { experimentId: timerContinuation.experimentId, stepId: skipStep.id, expectedRevision: 1, clientMutationId: randomUUID(), intent: 'skip' as const };
  await assert.rejects(recordStructuredStep(skip), /原因/);
  await recordStructuredStep({ ...skip, reason: '合成测试：样本不足，记录偏差' });
  await recordStructuredStep({ ...skip, reason: '合成测试：样本不足，记录偏差' });
  await assert.rejects(recordStructuredStep({ ...skip, reason: '不同的请求不能复用同一ID' }), /不一致/);
  assert.equal((await prisma.experimentStep.findUniqueOrThrow({ where: { id: skipStep.id } })).completed, false);
  console.log('PASS: active timer rejects implicit cancellation, explicit cancellation is audited and replay-safe; required skip needs a reason and does not mark completion');
  await writeFile(`${out}/fixtures.json`, JSON.stringify({ projectId: project.id, planId: plan.id, protocolId: protocol.id, versionId: version.id, protocolCode: protocol.humanCode, displayVersion: version.displayVersion, experimentId: experiment.id, continuationId: continued.experimentId, attachmentIds }, null, 2));
  console.log('PASS: real isolated database creation, confirmation, stable IDs, frozen source, stale rejection, idempotent actual values, guarded public completion, linked continuation and preserved prior records');
} finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
