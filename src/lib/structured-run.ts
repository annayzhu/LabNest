import { z } from 'zod';
import { normalizeProtocolDocument, type ProtocolDocument } from './protocol-document';
import { convert } from './calculators/quantities';
import { resolveProtocolDocument, type ProtocolSelection } from './structured-protocol';
import { chipParameterIds } from './protocol-chips';
import type { CalculatorResult } from './calculators/calculator-engine';
import { mixQuantityLabel, mixTitle, mixView, type ProtocolMix } from './protocol-mix';
import { notesAmongSteps } from './protocol-execution';

const quantity = z.object({ value: z.number().finite(), unit: z.string().min(1) });
export const executionPlanSchema = z.object({
  schemaVersion: z.literal(1), revision: z.number().int().nonnegative(),
  groups: z.array(z.object({ id: z.string().regex(/^[\w-]+$/), label: z.string().trim().min(1).max(100) })).max(24).default([]),
  stepGroups: z.record(z.string(), z.string()).default({}),
  versions: z.record(z.string(), z.object({ selections: z.record(z.string(), z.string()), confirmedAt: z.string(), actualInputs: z.record(z.string(), quantity), calculations: z.record(z.string(), z.object({ fingerprint: z.string(), value: z.number().finite(), unit: z.string(), confirmedAt: z.string(), snapshot: z.custom<CalculatorResult>(value => Boolean(value && typeof value === 'object' && 'methodVersion' in value)) })).default({}) })),
  actualValues: z.record(z.string(), z.record(z.string(), quantity.extend({ recordedAt: z.string() }))),
  skips: z.record(z.string(), z.object({ reason: z.string().min(1), recordedAt: z.string() })),
  /** Which time chip a step's countdown was started from (one countdown per step). */
  timerSources: z.record(z.string(), z.string()).default({}),
  /** 本次数量 per adopted version (group), by label: 反应数, 孔数… */
  quantities: z.record(z.string(), z.record(z.string(), z.number().positive().max(1_000_000))).default({}),
  /** Confirmed mix cards, keyed "stepId:mixId": what was confirmed, for how many, and when. */
  mixes: z.record(z.string(), z.object({
    fingerprint: z.string(), quantity: z.number().positive(), quantitySource: z.enum(['run', 'card']), overagePercent: z.number(),
    lines: z.array(z.object({ id: z.string(), name: z.string(), mode: z.enum(['premix', 'separate']), unit: z.string(), perReaction: z.number(), total: z.number() })),
    aliquot: z.string(), confirmedAt: z.string(),
  })).default({}),
  /** Lines crossed off while pipetting ("stepId:mixId" → line ids). A bench aid only: not progress, no revision. */
  mixStrikes: z.record(z.string(), z.array(z.string())).default({}),
  /** Mix cards made at the bench from a step's chips: recorded for this run only. */
  runMixes: z.record(z.string(), z.array(z.custom<ProtocolMix>(value => Boolean(value && typeof value === 'object' && (value as { type?: unknown }).type === 'mix')))).default({}),
  continuation: z.object({
    experimentId: z.string(), createdAt: z.string(), affectedSourceRefs: z.array(z.string()),
    startSourceRef: z.string().optional(), priorRecord: z.unknown(),
    history: z.array(z.object({
      sourceRef: z.string(), title: z.string(), completed: z.boolean(),
      completedAt: z.string().nullable(), description: z.string(),
      actualValues: z.record(z.string(), quantity.extend({ recordedAt: z.string() })),
      deviationNote: z.string().nullable(),
    })).default([]),
  }).optional(),
});
export type ExecutionPlan = z.infer<typeof executionPlanSchema>;
export const emptyExecutionPlan = (): ExecutionPlan => ({ schemaVersion: 1, revision: 0, groups: [], stepGroups: {}, versions: {}, actualValues: {}, skips: {}, timerSources: {}, quantities: {}, mixes: {}, mixStrikes: {}, runMixes: {} });
export function parseExecutionPlan(value: unknown): ExecutionPlan {
  if (!value || typeof value === 'object' && !Object.keys(value).length) return emptyExecutionPlan();
  // A corrupt/newer plan must not silently become an unconfirmed empty legacy plan.
  return executionPlanSchema.parse(value);
}
type SourceStep = { id: string; protocolStepRef: string | null; groupKey: string; completed: boolean };
type ResolvedStep = ReturnType<typeof resolveProtocolDocument>['steps'][number] & { versionId: string; groupId?: string; groupLabel?: string; timerDurationSeconds?: number };
export type StructuredRunView = {
  plan: ExecutionPlan; hasSystems: boolean;
  versions: Array<{ id: string; sourceVersionId: string; groupId?: string; groupLabel?: string; title: string; displayVersion: string; document: ProtocolDocument; commonBlocks: ReturnType<typeof resolveProtocolDocument>['commonBlocks']; notePlacement: ReturnType<typeof resolveProtocolDocument>['notePlacement']; stepRefs: string[]; parameters: ReturnType<typeof resolveProtocolDocument>['parameters'] }>;
  steps: Record<string, ResolvedStep>;
};

/** Fixed values are part of the frozen source; per-system, measured and calculated values need the confirmed plan. */
function dependsOnAdoptedValue(document: ProtocolDocument, stepId: string) {
  const ids = new Set<string>();
  JSON.stringify(document.sections.flatMap(s => s.blocks).filter(b => b.execution?.stepId === stepId)).replace(/\{\{([\w-]+)\}\}/g, (_, id: string) => { chipParameterIds(id, document.systems).forEach(p => ids.add(p)); return ''; });
  return [...ids].some(id => document.systems?.parameters.find(p => p.id === id)?.source.kind !== 'fixed');
}

export function structuredRunView(snapshot: unknown, planValue: unknown, steps: SourceStep[]): StructuredRunView {
  const plan = parseExecutionPlan(planValue);
  if (new Set(plan.groups.map(group => group.id)).size !== plan.groups.length || plan.groups.some(group => group.id === 'shared')) throw new Error('实验组标识重复或无效');
  if (Object.values(plan.stepGroups).some(id => id !== 'shared' && !plan.groups.some(group => group.id === id))) throw new Error('步骤引用了不存在的实验组');
  const view: StructuredRunView = { plan, hasSystems: false, versions: [], steps: {} };
  const versions = (snapshot && typeof snapshot === 'object' ? (snapshot as { versions?: unknown }).versions : []) as Array<{ protocolVersionId: string; protocolTitle?: string; title?: string; displayVersion?: string; contentJson: unknown }>;
  if (!Array.isArray(versions)) return view;
  for (const version of versions) {
    const document = normalizeProtocolDocument(version.contentJson);
    if (!document?.systems) continue;
    view.hasSystems = true;
    const scopes = plan.groups.length ? plan.groups : [{ id: '', label: '' }];
    const groupResolutions: Record<string, ReturnType<typeof resolveProtocolDocument>> = {};
    for (const scope of scopes) {
      const id = scope.id ? `${version.protocolVersionId}@${scope.id}` : version.protocolVersionId;
      const adopted = plan.versions[id];
      const resolved = resolveProtocolDocument(document, adopted?.selections ?? {}, adopted?.actualInputs ?? {}, adopted?.calculations ?? {});
      groupResolutions[scope.id] = resolved;
      view.versions.push({ id, sourceVersionId: version.protocolVersionId, groupId: scope.id || undefined, groupLabel: scope.label || undefined, document, title: version.protocolTitle ?? version.title ?? 'Protocol', displayVersion: version.displayVersion ?? '', commonBlocks: resolved.commonBlocks, notePlacement: resolved.notePlacement, stepRefs: resolved.steps.map(step => step.source_ref!), parameters: resolved.parameters });
      for (const step of steps.filter(s => s.groupKey === version.protocolVersionId && (!plan.groups.length || plan.stepGroups[s.id] === scope.id))) {
        const source = resolved.steps.find(s => step.protocolStepRef === `${version.protocolVersionId}:${s.source_ref}`);
        if (!source) throw new Error('执行快照缺少已保存步骤 / Captured operation is missing');
        const rules = document.systems.rules.filter(r => r.target === 'step' && r.targetId === source.source_ref);
        const timerId = rules.find(r => r.timerParameterId)?.timerParameterId;
        const timer = timerId ? resolved.parameters[timerId] : undefined;
        const timerDurationSeconds = timer?.status === 'resolved' ? Math.round(convert(timer.value!, timer.unit, 's')) : undefined;
        const dependsOnChoice = rules.some(r => [r.when.all, r.when.any, r.when.not].some(p => p?.length)) || dependsOnAdoptedValue(document, source.source_ref!);
        view.steps[step.id] = { ...source, versionId: id, groupId: scope.id || undefined, groupLabel: scope.label || undefined, blocked: source.blocked || Boolean(dependsOnChoice && !adopted?.confirmedAt), timerDurationSeconds };
      }
    }
    for (const step of steps.filter(s => s.groupKey === version.protocolVersionId && plan.groups.length && plan.stepGroups[s.id] === 'shared')) {
      const candidates = scopes.map(scope => groupResolutions[scope.id].steps.find(s => step.protocolStepRef === `${version.protocolVersionId}:${s.source_ref}`));
      if (candidates.some(candidate => !candidate)) throw new Error('共享操作缺少来源步骤');
      const first = candidates[0]!;
      const rules = document.systems.rules.filter(rule => rule.target === 'step' && rule.targetId === first.source_ref);
      const timerId = rules.find(rule => rule.timerParameterId)?.timerParameterId;
      const timers = scopes.map(scope => timerId ? groupResolutions[scope.id].parameters[timerId] : undefined);
      const consistent = candidates.every(candidate => JSON.stringify(candidate) === JSON.stringify(first)) && timers.every(timer => JSON.stringify(timer) === JSON.stringify(timers[0]));
      const timerDurationSeconds = timers[0]?.status === 'resolved' ? Math.round(convert(timers[0].value!, timers[0].unit, 's')) : undefined;
      const allConfirmed = scopes.every(scope => plan.versions[`${version.protocolVersionId}@${scope.id}`]?.confirmedAt);
      // Shared work must agree across every group. An unconfirmed/unknown group is never ignored.
      view.steps[step.id] = { ...first, versionId: version.protocolVersionId, groupId: 'shared', groupLabel: '共同准备', timerDurationSeconds, blocked: !consistent || !allConfirmed || candidates.some(s => s!.blocked), ...(!consistent ? { description: '各组的共同操作参数或适用条件不同；请在规程中拆为组级操作后创建新实验。', content_blocks: [] } : {}) };
    }
    for (const step of steps.filter(s => s.groupKey === version.protocolVersionId)) {
      if (!view.steps[step.id]) throw new Error('步骤的实验组归属缺失，请核对保存的执行方案。');
    }
  }
  return view;
}

/** Why a step cannot be done now, in the bench's words; null when it can. Legacy operations keep the captured contract. */
export function stepExecutionBlocker(view: StructuredRunView, stepId: string, requireActualValues = false): string | null {
  const step = view.steps[stepId];
  if (!step) return null;
  if (step.blocked || step.applicability !== 'applicable') return '请先确认体系并解决待确定参数 / Confirm the applicable system and resolve parameters first';
  if (view.plan.skips[stepId]) return '此步骤已记录跳过；请先撤销跳过 / Reopen the skipped operation first';
  if (requireActualValues) for (const field of step.actualFields.filter(f => f.required)) {
    const value = view.plan.actualValues[stepId]?.[field.id];
    if (!value) return `请记录实际值：${field.label}`;
    try { convert(value.value, value.unit, field.unit); } catch { return `实际值单位不兼容：${field.label}`; }
  }
  if (requireActualValues) for (const mix of stepMixes(view, stepId)) {
    const state = mixState(view, stepId, mix);
    if (!state.receipt) return `请先确认配液卡：${mixTitle(mix)}`;
    if (!state.current) return `配液卡数值已变化，请重新确认：${mixTitle(mix)}`;
  }
  return null;
}

/** Mix cards in a step: the Protocol's own, then those made at the bench for this run. */
export function stepMixes(view: Pick<StructuredRunView, 'steps' | 'plan'>, stepId: string): ProtocolMix[] {
  const step = view.steps[stepId];
  return [...(step?.source_blocks ?? []).filter((block): block is ProtocolMix => block.type === 'mix'), ...(view.plan.runMixes[stepId] ?? [])];
}
/** The version a step reads its values from; shared preparation agrees across groups. */
export function stepVersion(view: Pick<StructuredRunView, 'steps' | 'versions'>, stepId: string) {
  const step = view.steps[stepId];
  return step ? view.versions.find(version => version.id === step.versionId) ?? view.versions.find(version => version.sourceVersionId === step.versionId) : undefined;
}

type RunNote = StructuredRunView['versions'][number]['commonBlocks'][number];
/**
 * The Protocol's notes where they were written, by run step: shown before a step, or after the last step of its group.
 * Each group reads its own system's notes; a note before shared preparation shows once, with that step.
 */
export function runStepNotes(view: Pick<StructuredRunView, 'steps' | 'versions'>) {
  const before: Record<string, RunNote[]> = {}, after: Record<string, RunNote[]> = {};
  for (const version of view.versions) {
    // This group's steps of the Protocol, and the shared preparation every group goes through.
    const runStep = new Map<string, string>();
    for (const [id, step] of Object.entries(view.steps)) {
      if (step.source_ref && (step.versionId === version.id || (step.groupId === 'shared' && step.versionId === version.sourceVersionId))) runStep.set(step.source_ref, id);
    }
    const shown = (ref: string) => runStep.has(ref) && view.steps[runStep.get(ref)!].applicability !== 'not-applicable';
    const ours = (ref: string) => stepVersion(view, runStep.get(ref)!)?.id === version.id;
    const placed = notesAmongSteps(version.commonBlocks, version.notePlacement, version.stepRefs, shown);
    for (const [ref, notes] of placed.before) if (ours(ref)) before[runStep.get(ref)!] = notes;
    const last = version.stepRefs.findLast(shown);
    if (last && placed.after.length && ours(last)) after[runStep.get(last)!] = placed.after;
  }
  return { before, after };
}
/**
 * 本次数量 a step reads: its group's; for shared preparation (共同准备), done once for every group, the sum over the groups
 * (only counts every group has). Shared steps read their values from the first group, since they agree across groups.
 */
export function stepQuantities(view: Pick<StructuredRunView, 'steps' | 'plan'>, stepId: string): { versionId?: string; quantities: Record<string, number> } {
  const step = view.steps[stepId];
  if (!step) return { quantities: {} };
  if (step.groupId !== 'shared') return { versionId: step.versionId, quantities: view.plan.quantities[step.versionId] ?? {} };
  const keys = view.plan.groups.map(group => `${step.versionId}@${group.id}`);
  const labels = Object.keys(view.plan.quantities[keys[0]] ?? {}).filter(label => keys.every(key => view.plan.quantities[key]?.[label] !== undefined));
  return { versionId: keys[0], quantities: Object.fromEntries(labels.map(label => [label, keys.reduce((sum, key) => sum + view.plan.quantities[key][label], 0)])) };
}

/** A mix card as it stands now: its quantity (the card's own when changed there), its live view, and whether the confirmation still matches. */
export function mixState(view: Pick<StructuredRunView, 'steps' | 'plan' | 'versions'>, stepId: string, mix: ProtocolMix) {
  const version = stepVersion(view, stepId);
  const receipt = view.plan.mixes[`${stepId}:${mix.id}`];
  const runQuantity = stepQuantities(view, stepId).quantities[mixQuantityLabel(mix)];
  const quantity = receipt?.quantitySource === 'card' ? receipt.quantity : runQuantity;
  const live = mixView(mix, version?.document.systems, version?.parameters ?? {}, quantity);
  return { version, receipt, runQuantity, quantity, live, current: Boolean(receipt && receipt.fingerprint === live.fingerprint) };
}

export function assertStructuredStepExecutable(view: StructuredRunView, stepId: string, expectedRevision: number | undefined, requireActualValues = false) {
  if (!view.steps[stepId]) return;
  if (expectedRevision !== view.plan.revision) throw new Error('执行方案已变更，请刷新核对 / Execution plan changed; reload before continuing');
  const blocker = stepExecutionBlocker(view, stepId, requireActualValues);
  if (blocker) throw new Error(blocker);
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
