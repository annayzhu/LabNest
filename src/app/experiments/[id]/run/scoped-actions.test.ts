import { beforeEach, expect, it, vi } from "vitest";
import { saveProtocolRunProgress } from "./actions";
import { createEmptyProtocolDocument } from "@/lib/protocol-document";

const state = vi.hoisted(() => {
  const step = (id: string, completed: boolean) => ({ id, order: id === 'A' ? 1 : 2, groupKey: 'v1', protocolStepRef: `v1:${id}`, completed, completedAt: completed ? new Date('2026-09-01') : null, allowsDeviation: true, deviationNote: `${id} 原备注`, deviationType: 'other', deviationImpact: '原影响', deviationAuthor: '作者', timerStartedAt: null as Date | null });
  return { step, steps: [step('A', true), step('B', false)], snapshot: {} as unknown, plan: {} as unknown, recordStatus: 'draft', update: vi.fn(), event: vi.fn() };
});
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => {} }));
vi.mock("@/lib/db", () => {
  const tx = {
    $queryRaw: async () => [],
    experiment: {
      findUnique: async () => ({ id: 'experiment', status: 'running', updatedAt: new Date('2026-10-14T00:00:00Z'), recordStatus: state.recordStatus, purpose: '', contentJson: {}, protocolSnapshotJson: state.snapshot, protocolRun: { executionPlanJson: state.plan }, steps: state.steps }),
      update: state.update,
    },
    experimentStep: { update: async ({ where, data }: { where: { id: string }; data: object }) => Object.assign(state.steps.find(step => step.id === where.id)!, data) },
    experimentStepEvent: { findUnique: async () => null, create: state.event },
    protocolRun: { update: async () => ({}) },
    activityLog: { create: async () => ({}) },
  };
  return { prisma: { $transaction: async (run: (database: typeof tx) => unknown) => run(tx) } };
});
beforeEach(() => {
  state.steps = [state.step('A', true), state.step('B', false)];
  state.snapshot = {}; state.plan = {}; state.recordStatus = 'draft';
  state.update.mockReset().mockResolvedValue({ updatedAt: new Date('2026-10-14T00:01:00Z') });
  state.event.mockReset().mockResolvedValue({});
});
function command(intent: string, id = 'B') {
  const form = new FormData();
  Object.entries({ experimentId: 'experiment', changedStepId: id, stepIntent: intent, expectedUpdatedAt: '2026-10-14T00:00:00.000Z', clientMutationId: 'ec3b7b56-82ec-4a73-a4f5-83a302a3d50e', executionPlanRevision: '0' }).forEach(([key, value]) => form.set(key, value));
  return form;
}
it('completes only the addressed step and preserves both deviation records', async () => {
  const beforeA = structuredClone(state.steps[0]);
  expect(await saveProtocolRunProgress({}, command('complete'))).toMatchObject({ completedStepIds: ['A', 'B'], updatedAt: '2026-10-14T00:01:00.000Z' });
  expect(state.steps[0]).toEqual(beforeA);
  expect(state.steps[1]).toMatchObject({ completed: true, deviationNote: 'B 原备注', deviationImpact: '原影响' });
});
it('records a deviation without changing completion or overwriting impact and author', async () => {
  const form = command('deviation'); form.set('deviationNote', '实际延长 5 分钟');
  expect((await saveProtocolRunProgress({}, form)).error).toBeUndefined();
  expect(state.steps.map(step => step.completed)).toEqual([true, false]);
  expect(state.steps[1]).toMatchObject({ deviationNote: '实际延长 5 分钟', deviationImpact: '原影响', deviationAuthor: '作者' });
  expect(state.event).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: 'deviation_recorded', experimentStepId: 'B' }) }));
});
it('reopens only the addressed operation', async () => {
  state.steps[1].completed = true;
  expect((await saveProtocolRunProgress({}, command('reopen', 'A'))).error).toBeUndefined();
  expect(state.steps.map(step => step.completed)).toEqual([false, true]);
});
it('rejects a stale editor version before any write', async () => {
  const form = command('complete'); form.set('expectedUpdatedAt', '2026-10-13T00:00:00.000Z');
  expect((await saveProtocolRunProgress({}, form)).error).toContain('另一窗口');
  expect(state.update).not.toHaveBeenCalled();
});
it('rejects a foreign step and a locked record', async () => {
  expect((await saveProtocolRunProgress({}, command('complete', 'foreign'))).error).toContain('does not belong');
  state.recordStatus = 'submitted';
  expect((await saveProtocolRunProgress({}, command('complete'))).error).toBeTruthy();
  expect(state.update).not.toHaveBeenCalled();
});
it('blocks a dependent step before system confirmation in both scoped and mobile commands', async () => {
  const document = createEmptyProtocolDocument(); document.executionConfirmed = true;
  document.sections.find(s => s.key === 'steps')!.blocks = ['A', 'B'].map(id => ({ id: `heading-${id}`, type: 'heading', text: id, execution: { role: 'step', stepId: id, title: id } }));
  document.systems = { schemaVersion: 1, dimensions: [{ id: 'volume', label: '体积', options: [{ id: 'large', label: '大体系' }] }], parameters: [], presets: [], restrictions: [], rules: [{ id: 'only-large', target: 'step', targetId: 'B', when: { all: [{ dimensionId: 'volume', optionId: 'large' }] }, parameterIds: [], optional: false, actualFields: [] }] };
  state.snapshot = { versions: [{ protocolVersionId: 'v1', contentJson: document }] };
  expect((await saveProtocolRunProgress({}, command('complete'))).error).toContain('确认');
  const mobile = new FormData(); mobile.set('experimentId', 'experiment'); mobile.set('completedCurrentStepId', 'B'); mobile.set('executionPlanRevision', '0');
  expect((await saveProtocolRunProgress({}, mobile)).error).toContain('确认');
  expect(state.update).not.toHaveBeenCalled();
});
