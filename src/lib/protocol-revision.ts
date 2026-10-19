import { chipAmount, parameterLongName } from './protocol-chips';
import type { ProtocolDocument } from './protocol-document';
import { evaluateProtocolCondition } from './structured-protocol';
import type { StructuredRunView } from './structured-run';

/** How a candidate's deviation reads; the Chinese interface translates it. Nothing here is written into the revision. */
const deviationKinds: Record<string, string> = { method: 'Method change', timing: 'Timing', material: 'Material or reagent', equipment: 'Equipment', incident: 'Incident', abnormal: 'Abnormal', other: 'Other' };

export type Adoption =
  | { kind: 'value'; parameterId: string; value: number; unit: string; selections: Record<string, string>; stepRef: string }
  | { kind: 'note'; stepRef: string; text: string; stepLabel?: string };
export type RevisionCandidate = { key: string; sourceVersionId: string; versionTitle: string; kind: Adoption['kind']; label: string; detail: string; adoption: Adoption };

/**
 * What this run recorded that differs from its Protocol: actual values other than the planned ones, and deviation notes.
 * Each is offered once per Protocol version; the latest recording of a value wins.
 */
export function revisionCandidates(view: Pick<StructuredRunView, 'steps' | 'plan' | 'versions'>, steps: Array<{ id: string; deviationNote?: string | null; deviationType?: string | null }>): RevisionCandidate[] {
  const candidates = new Map<string, RevisionCandidate & { recordedAt: string }>();
  for (const [stepId, step] of Object.entries(view.steps)) {
    const version = view.versions.find(item => item.id === step.versionId), systems = version?.document.systems;
    if (!version || !systems || !step.source_ref) continue;
    for (const [parameterId, actual] of Object.entries(view.plan.actualValues[stepId] ?? {})) {
      const parameter = systems.parameters.find(p => p.id === parameterId), planned = version.parameters[parameterId];
      if (!parameter || parameter.source.kind === 'actual' || parameter.source.kind === 'calculator' || planned?.status !== 'resolved') continue;
      if (planned.value === actual.value && planned.unit === actual.unit) continue;
      const key = `value:${version.sourceVersionId}:${parameterId}`;
      const current = candidates.get(key);
      if (current && current.recordedAt > actual.recordedAt) continue;
      candidates.set(key, { key, sourceVersionId: version.sourceVersionId, versionTitle: version.title, kind: 'value', recordedAt: actual.recordedAt, label: parameterLongName(parameter, systems),
        detail: `${chipAmount(planned.value!, planned.unit)} → ${chipAmount(actual.value, actual.unit)} (step ${step.order}${version.groupLabel ? ` · ${version.groupLabel}` : ''})`,
        adoption: { kind: 'value', parameterId, value: actual.value, unit: actual.unit, selections: view.plan.versions[version.id]?.selections ?? {}, stepRef: step.source_ref } });
    }
  }
  for (const source of steps) {
    const step = view.steps[source.id], version = step && view.versions.find(item => item.id === step.versionId);
    if (!version || !step?.source_ref || !source.deviationNote?.trim()) continue;
    const key = `note:${version.sourceVersionId}:${step.source_ref}`;
    if (candidates.has(key)) continue;
    candidates.set(key, { key, sourceVersionId: version.sourceVersionId, versionTitle: version.title, kind: 'note', recordedAt: '', label: `Step ${step.order} · ${deviationKinds[source.deviationType ?? 'other'] ?? 'Other'}`, detail: source.deviationNote.trim(),
      adoption: { kind: 'note', stepRef: step.source_ref, text: source.deviationNote.trim(), stepLabel: `第 ${step.order} 步` } });
  }
  return [...candidates.values()].map(({ recordedAt: _, ...candidate }) => { void _; return candidate; });
}

/**
 * A draft revision tidied from an Experiment: adopted actual values replace the planned ones (a fixed value, or the value of the
 * system the run used), deviation notes become 提示 blocks under their steps, and the Experiment is written down as a source.
 * The given document is never mutated; reviewed versions stay as they were used.
 */
export function revisionFromExperiment(document: ProtocolDocument, experiment: { id: string; runCode: string }, adoptions: Adoption[]) {
  const next: ProtocolDocument = JSON.parse(JSON.stringify(document));
  const changes: string[] = [];
  const systems = next.systems;
  for (const adoption of adoptions) {
    if (adoption.kind === 'value') {
      const parameter = systems?.parameters.find(p => p.id === adoption.parameterId);
      if (!parameter || !systems) continue;
      const name = parameterLongName(parameter, systems), after = chipAmount(adoption.value, adoption.unit);
      if (parameter.source.kind === 'fixed') {
        changes.push(`${name}：${chipAmount(parameter.source.value ?? 0, parameter.source.unit)} → ${after}`);
        parameter.source = { kind: 'fixed', value: adoption.value, unit: adoption.unit };
      } else if (parameter.source.kind === 'lookup') {
        // The value for the system this run used; a system without its own value gets one.
        const entry = parameter.source.values.find(value => evaluateProtocolCondition(value.when, adoption.selections) === 'applicable');
        if (entry) { changes.push(`${name}：${chipAmount(entry.value ?? 0, entry.unit)} → ${after}`); entry.value = adoption.value; entry.unit = adoption.unit; }
        else { parameter.source.values.push({ id: `${parameter.id}-${experiment.id.slice(-6)}`, when: { all: Object.entries(adoption.selections).map(([dimensionId, optionId]) => ({ dimensionId, optionId })) }, value: adoption.value, unit: adoption.unit }); changes.push(`${name}：新增本次体系的值 ${after}`); }
      }
    } else {
      const section = next.sections.find(item => item.key === 'steps');
      if (!section) continue;
      let at = -1;
      section.blocks.forEach((block, index) => { if ((block.execution?.stepId ?? (block.execution?.role === 'step' ? block.id : undefined)) === adoption.stepRef) at = index; });
      if (at < 0) continue;
      section.blocks.splice(at + 1, 0, { id: `note-${experiment.id.slice(-6)}-${adoption.stepRef}-${at}`, type: 'callout', tone: 'note', text: `${experiment.runCode} 偏差：${adoption.text}`, execution: { role: 'detail', stepId: adoption.stepRef } });
      // The step's number among the step blocks: a step reference is an internal id, never shown.
      const number = section.blocks.slice(0, at + 1).filter(block => block.execution?.role === 'step').length;
      changes.push(`${adoption.stepLabel ?? `第 ${number} 步`}增加偏差说明`);
    }
  }
  next.provenance = { ...next.provenance, fromExperimentIds: [...new Set([...(next.provenance?.fromExperimentIds ?? []), experiment.id])] };
  next.sources = [...(next.sources ?? []).filter(source => source.id !== `src-exp-${experiment.id}`), { id: `src-exp-${experiment.id}`, kind: 'experiment', title: experiment.runCode, accessedAt: new Date().toISOString(), note: changes.join('；') || undefined }];
  return { document: next, changes };
}
