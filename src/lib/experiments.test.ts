import { expect, it, vi } from 'vitest';
import type { Prisma } from '@/generated/prisma/client';
import { createExperimentWithProtocolSnapshotInTransaction, type ExperimentSnapshotInput } from './experiments';
import { createScientificDocument, experimentSections } from './scientific-document';
import { createEmptyProtocolDocument } from './protocol-document';

vi.mock('./db', () => ({ prisma: {} }));
vi.mock('./document-media.server', () => ({ associateDocumentMedia: async () => {} }));
const input: ExperimentSnapshotInput = { runCode: 'EXP-991', title: 'Unassigned experiment', date: new Date('2026-10-14'), status: 'planned', recordStatus: 'draft', tags: [], contentJson: createScientificDocument(experimentSections), methodMode: 'custom', protocolVersionIds: [], customSteps: [] };
function database() {
  return { researchPlan: { findUnique: vi.fn().mockResolvedValue(null) }, protocolVersion: { findMany: vi.fn().mockResolvedValue([]) }, experiment: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => ({ id: 'exp', ...data })) }, projectProtocol: { createMany: vi.fn() }, researchPlanProtocol: { createMany: vi.fn() }, protocolRun: { create: vi.fn() }, itemLink: { createMany: vi.fn() }, activityLog: { create: vi.fn() } };
}
it('creates a custom experiment without a plan or a project', async () => {
  const tx = database();
  const saved = await createExperimentWithProtocolSnapshotInTransaction(tx as unknown as Prisma.TransactionClient, input);
  expect(saved).toMatchObject({ researchPlanId: null, projectId: null, protocolSnapshotJson: { researchPlanTitle: null } });
  expect(tx.researchPlan.findUnique).not.toHaveBeenCalled();
});
it('captures protocol steps without fabricating plan relationships', async () => {
  const tx = database(), doc = createEmptyProtocolDocument(); doc.executionConfirmed = true;
  doc.sections.find(s => s.key === 'steps')!.blocks = [{ id: 'h', type: 'heading', text: 'Inspect', execution: { role: 'step', stepId: 'inspect', title: 'Inspect' } }];
  tx.protocolVersion.findMany.mockResolvedValue([{ id: 'v1', title: 'Inspection v1.0', protocolId: 'p1', revision: 1, displayVersion: '1.0', reviewStage: 'draft', parametersJson: [], materialsJson: [], equipmentJson: [], resultTemplatesJson: [], contentJson: doc, protocol: { id: 'p1', title: 'Inspection', humanCode: 'PRT-991' } }]);
  const saved = await createExperimentWithProtocolSnapshotInTransaction(tx as unknown as Prisma.TransactionClient, { ...input, methodMode: 'protocol', protocolVersionIds: ['v1'] });
  expect(saved).toMatchObject({ researchPlanId: null, steps: { create: [expect.objectContaining({ protocolStepRef: 'v1:inspect' })] } });
  expect(tx.projectProtocol.createMany).not.toHaveBeenCalled();
  expect(tx.researchPlanProtocol.createMany).not.toHaveBeenCalled();
  expect(tx.protocolRun.create).toHaveBeenCalled();
});
it('still rejects an invalid explicitly selected research plan', async () => {
  const tx = database();
  await expect(createExperimentWithProtocolSnapshotInTransaction(tx as unknown as Prisma.TransactionClient, { ...input, researchPlanId: 'missing' })).rejects.toThrow('does not exist');
  expect(tx.experiment.create).not.toHaveBeenCalled();
});
