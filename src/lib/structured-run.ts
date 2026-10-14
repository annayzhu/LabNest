import { z } from 'zod';
import { normalizeProtocolDocument, type ProtocolDocument } from './protocol-document';
import { convert } from './calculators/quantities';
import { resolveProtocolDocument, type ProtocolSelection } from './structured-protocol';
import type { CalculatorResult } from './calculators/calculator-engine';

const quantity = z.object({ value: z.number().finite(), unit: z.string().min(1) });
export const executionPlanSchema = z.object({
  schemaVersion: z.literal(1), revision: z.number().int().nonnegative(),
  versions: z.record(z.string(), z.object({ selections: z.record(z.string(), z.string()), confirmedAt: z.string(), actualInputs: z.record(z.string(), quantity), calculations: z.record(z.string(), z.object({ fingerprint: z.string(), value: z.number().finite(), unit: z.string(), confirmedAt: z.string(), snapshot: z.custom<CalculatorResult>(value => Boolean(value && typeof value === 'object' && 'methodVersion' in value)) })).default({}) })),
  actualValues: z.record(z.string(), z.record(z.string(), quantity.extend({ recordedAt: z.string() }))),
  skips: z.record(z.string(), z.object({ reason: z.string().min(1), recordedAt: z.string() })),
  continuation: z.object({ experimentId: z.string(), createdAt: z.string(), affectedSourceRefs: z.array(z.string()), priorRecord: z.unknown() }).optional(),
});
export type ExecutionPlan = z.infer<typeof executionPlanSchema>;
export const emptyExecutionPlan = (): ExecutionPlan => ({ schemaVersion: 1, revision: 0, versions: {}, actualValues: {}, skips: {} });
export function parseExecutionPlan(value: unknown): ExecutionPlan {
  if (!value || typeof value === 'object' && !Object.keys(value).length) return emptyExecutionPlan();
  // A corrupt/newer plan must not silently become an unconfirmed empty legacy plan.
  return executionPlanSchema.parse(value);
}
type SourceStep = { id: string; protocolStepRef: string | null; groupKey: string; completed: boolean };
type ResolvedStep = ReturnType<typeof resolveProtocolDocument>['steps'][number] & { versionId: string; timerDurationSeconds?: number };
export type StructuredRunView = {
  plan: ExecutionPlan; hasSystems: boolean;
  versions: Array<{ id: string; title: string; displayVersion: string; document: ProtocolDocument; commonBlocks: ReturnType<typeof resolveProtocolDocument>['commonBlocks'] }>;
  steps: Record<string, ResolvedStep>;
};

export function structuredRunView(snapshot: unknown, planValue: unknown, steps: SourceStep[]): StructuredRunView {
  const plan = parseExecutionPlan(planValue);
  const view: StructuredRunView = { plan, hasSystems: false, versions: [], steps: {} };
  const versions = (snapshot && typeof snapshot === 'object' ? (snapshot as { versions?: unknown }).versions : []) as Array<{ protocolVersionId: string; protocolTitle?: string; title?: string; displayVersion?: string; contentJson: unknown }>;
  if (!Array.isArray(versions)) return view;
  for (const version of versions) {
    const document = normalizeProtocolDocument(version.contentJson);
    if (!document?.systems) continue;
    view.hasSystems = true;
    const id = version.protocolVersionId;
    const adopted = plan.versions[id];
    const resolved = resolveProtocolDocument(document, adopted?.selections ?? {}, adopted?.actualInputs ?? {}, adopted?.calculations ?? {});
    view.versions.push({ id, document, title: version.protocolTitle ?? version.title ?? 'Protocol', displayVersion: version.displayVersion ?? '', commonBlocks: resolved.commonBlocks });
    for (const step of steps.filter(s => s.groupKey === id)) {
      const source = resolved.steps.find(s => step.protocolStepRef === `${id}:${s.source_ref}`);
      if (!source) throw new Error('执行快照缺少已保存步骤 / Captured operation is missing');
      const rules = document.systems.rules.filter(r => r.target === 'step' && r.targetId === source.source_ref);
      const timerId = rules.find(r => r.timerParameterId)?.timerParameterId;
      const timer = timerId ? resolved.parameters[timerId] : undefined;
      const timerDurationSeconds = timer?.status === 'resolved' ? Math.round(convert(timer.value!, timer.unit, 's')) : undefined;
      const dependsOnChoice = rules.some(r => [r.when.all, r.when.any, r.when.not].some(p => p?.length)) || JSON.stringify(document.sections.flatMap(s => s.blocks).filter(b => b.execution?.stepId === source.source_ref)).includes('{{');
      view.steps[step.id] = { ...source, versionId: id, blocked: source.blocked || Boolean(dependsOnChoice && !adopted?.confirmedAt), timerDurationSeconds };
    }
  }
  return view;
}

export function assertStructuredStepExecutable(view: StructuredRunView, stepId: string, expectedRevision: number | undefined, requireActualValues = false) {
  const step = view.steps[stepId];
  if (!step) return; // Legacy operations keep the existing captured contract.
  if (expectedRevision !== view.plan.revision) throw new Error('执行方案已变更，请刷新核对 / Execution plan changed; reload before continuing');
  if (step.blocked || step.applicability !== 'applicable') throw new Error('请先确认体系并解决待确定参数 / Confirm the applicable system and resolve parameters first');
  if (view.plan.skips[stepId]) throw new Error('此步骤已记录跳过；请先撤销跳过 / Reopen the skipped operation first');
  if (requireActualValues) for (const field of step.actualFields.filter(f => f.required)) {
    const value = view.plan.actualValues[stepId]?.[field.id];
    if (!value) throw new Error(`请记录实际值：${field.label}`);
    convert(value.value, value.unit, field.unit);
  }
}

export function changedStructuredSteps(before: StructuredRunView, after: StructuredRunView) {
  return Object.keys(before.steps).filter(id => {
    const signature = (step: ResolvedStep | undefined) => step && JSON.stringify({ applicability: step.applicability, blocked: step.blocked, title: step.title, optional: step.optional, content: step.content_blocks, timer: step.timerDurationSeconds, fields: step.actualFields });
    return signature(before.steps[id]) !== signature(after.steps[id]);
  });
}
export function proposedExecutionPlan(plan: ExecutionPlan, versionId: string, selections: ProtocolSelection, actualInputs: Record<string, { value: number; unit: string }>, confirmedAt: string): ExecutionPlan {
  return { ...plan, revision: plan.revision + 1, versions: { ...plan.versions, [versionId]: { selections, actualInputs, confirmedAt, calculations: plan.versions[versionId]?.calculations ?? {} } } };
}
