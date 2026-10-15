import { format } from 'date-fns';
import { runStepNotes, stepExecutionBlocker, stepMixes, stepVersion, structuredRunView } from './structured-run';
import { mixPer, mixSummary, mixTitle } from './protocol-mix';
import { chipAmount, mapChipReferences, optionMarks, parameterLongName, protocolChipText } from './protocol-chips';
import { readableError } from './form-actions';
import { experimentStepGroupHeading } from './experiment-planning';
import { calculationInputSummary, protocolCalculations } from './protocol-calculations';
import { runStepContent, runStepIsConfirmation } from "./run-step-content";
import { scientificContentBlockSchema, type ScientificContentBlock } from "./scientific-document";
import { executionBlockText } from "./protocol-execution";
import type { ProtocolContentBlock } from "./protocol-document";
import { protocolDocumentSchema } from "./protocol-document";
import {
  createScientificDocument,
  documentPlainText,
  experimentSections,
  normalizeScientificDocument,
  type ScientificDocument,
} from "./scientific-document";

export type ExperimentNarrativeFields = {
  background?: string | null;
  materials?: string | null;
  steps?: string | null;
  observations?: string | null;
  deviations?: string | null;
  resultSummary?: string | null;
  conclusion?: string | null;
};

function sectionPlainText(document: ScientificDocument, key: string) {
  const section = document.sections.find((item) => item.key === key);
  return section ? documentPlainText({ schemaVersion: 1, sections: [section] }) : "";
}

/** Convert portable import fields into the canonical Experiment document. */
export function experimentDocumentFromNarrative(
  fields: ExperimentNarrativeFields,
): ScientificDocument {
  const document = createScientificDocument(experimentSections);
  const section = (key: string) => document.sections.find((item) => item.key === key)!;
  const addText = (key: string, id: string, value: string | null | undefined) => {
    const text = value?.trim();
    if (text) section(key).blocks.push({ id, type: "text", text });
  };

  addText("background", "background-import-1", fields.background);
  addText("setup", "setup-import-1", fields.materials);
  addText("execution", "execution-import-1", fields.steps);
  addText("observations", "observations-import-1", fields.observations);
  addText("deviations", "deviations-import-1", fields.deviations);
  // Keep the two legacy meanings as distinct blocks when both are supplied.
  addText("conclusion", "result-summary-import-1", fields.resultSummary);
  addText("conclusion", "conclusion-import-1", fields.conclusion);
  return document;
}

/** Project the document back onto stable structured export field names. */
export function experimentNarrativeFromDocument(contentJson: unknown) {
  const document = normalizeScientificDocument(contentJson, experimentSections);
  return {
    background: sectionPlainText(document, "background"),
    materials: sectionPlainText(document, "setup"),
    steps: sectionPlainText(document, "execution"),
    observations: sectionPlainText(document, "observations"),
    deviations: sectionPlainText(document, "deviations"),
    conclusion: sectionPlainText(document, "conclusion"),
  };
}

/**
 * Build the derived full-text mirror for Experiment search. The structured
 * document remains the source of truth; this value is safe to regenerate.
 */
export function experimentSearchText(
  purpose: string | null | undefined,
  contentJson: unknown,
) {
  const document = normalizeScientificDocument(contentJson, experimentSections);
  const text = [purpose?.trim(), documentPlainText(document)]
    .filter(Boolean)
    .join("\n")
    .trim();
  return text || null;
}

/** Append a timestamped on-bench observation without replacing earlier blocks. */
export function appendExperimentObservation(
  contentJson: unknown,
  input: { id: string; text: string; recordedAt: Date },
): ScientificDocument {
  const document = normalizeScientificDocument(contentJson, experimentSections);
  const text = input.text.trim();
  if (!text) return document;

  return {
    ...document,
    sections: document.sections.map((section) => section.key === "observations"
      ? {
          ...section,
          blocks: [
            ...section.blocks,
            {
              id: input.id,
              type: "text" as const,
              text: `[${input.recordedAt.toISOString()}]\n${text}`,
            },
          ],
        }
      : section),
  };
}

const deviationTypeLabels: Record<string, string> = { method: '方法变更', timing: '时间', material: '材料或试剂', equipment: '设备', incident: '异常事件', abnormal: '异常', other: '其他' };
export const deviationTypeOptions = ['method', 'timing', 'material', 'equipment', 'incident', 'other'] as const;
export function deviationTypeLabel(type: string | null | undefined) { return deviationTypeLabels[type ?? 'other'] ?? '其他'; }
const recordTime = (value: Date | string) => format(new Date(value), 'yyyy-MM-dd HH:mm');

type ExecutionRecordStep = {
  id: string; description?:string; protocolStepRef?:string|null;groupKey?:string;groupOrder: number; order: number; groupTitle: string; title: string;
  completed: boolean; completedAt?: Date | null; deviationNote?: string | null; deviationType?: string | null;
  deviationImpact?: string | null; deviationAuthor?: string | null; deviationAt?: Date | null; allowsDeviation?: boolean; timerStartedAt?: Date | null;
  evidence?: ScientificDocument['sections'][number]['blocks'];
};

/**
 * Derived at read/export time from the persisted Run, never authored prose: the execution report.
 * 执行记录 gets one part per Protocol (and group) with its steps in order, showing only this run's system and adopted values;
 * other systems' steps are folded and the Protocol's notes keep their place among the steps. 偏差与事件 gets one short line per
 * step deviation, above the handwritten notes.
 * The reserved ID prefix lets the projection refresh without accumulating.
 */
export function experimentExecutionDocument(contentJson: unknown, steps: readonly ExecutionRecordStep[], parameters?: unknown, snapshot?:unknown, executionPlan?:unknown): ScientificDocument {
  const document = normalizeScientificDocument(contentJson, experimentSections);
  const blocks: ScientificContentBlock[] = [], deviations: ScientificContentBlock[] = [];
  const structured = structuredRunView(snapshot, executionPlan, steps.map(step => ({ ...step, groupKey: step.groupKey ?? 'manual', protocolStepRef: step.protocolStepRef ?? null })));
  if (structured.plan.continuation) {
    const prior = structured.plan.continuation;
    blocks.push({ id: 'run-derived:continuation', type: 'text', text: `继续执行自 ${prior.experimentId}；继续位置来源：${prior.startSourceRef ?? '旧记录未记载'}。以下为此前处理历史，不属于本次已完成操作。` });
    for (const [index, step] of prior.history.entries()) blocks.push({ id: `run-derived:history-${index}`, type: 'text', text: [step.title, step.completed ? `此前已完成 ${step.completedAt ?? ''}` : '此前未完成', step.description, ...Object.values(step.actualValues).map(value => `原实际记录：${value.value} ${value.unit} · ${value.recordedAt}`), step.deviationNote ?? ''].filter(Boolean).join('\n') });
  }
  if(parameters && typeof parameters==='object' && !Array.isArray(parameters)) {
    const rows=Object.entries(parameters).filter(([,value])=>['string','number','boolean'].includes(typeof value)).map(([key,value])=>[key,String(value)]);
    if(rows.length)blocks.push({id:'run-derived:parameters',type:'table',caption:'本次执行参数（实验级记录，不推定属于某一步骤）',rows:[['原记录参数','值'],...rows]});
  }
  const scientific = (block:ProtocolContentBlock, prefix:string): ScientificContentBlock => {
    const content=Object.fromEntries(Object.entries(block).filter(([key])=>key!=='execution'));
    if((block.type==='text'||block.type==='heading') && block.nodes)return {id:prefix+block.id,type:'rich_text',nodes:block.nodes};
    if(block.type==='checklist' && block.itemNodes)return {id:prefix+block.id,type:'rich_text',nodes:block.itemNodes.flatMap(nodes=>nodes.map(node=>({...node,type:'bullet' as const})))};
    const parsed=scientificContentBlockSchema.safeParse({...content,id:prefix+block.id});
    return parsed.success?parsed.data:{id:prefix+block.id,type:'text',text:executionBlockText(block)};
  };
  const detail = (block: ScientificContentBlock, stepId?: string, fold?: string): ScientificContentBlock => ({ ...block, execution: { role: 'detail', title: '', ...(stepId ? { stepId } : {}), ...(fold ? { fold } : {}) } });
  const note = (block: ScientificContentBlock): ScientificContentBlock => ({ ...block, execution: { role: 'note', title: '' } });
  const stepContent = (step: ExecutionRecordStep) => runStepContent(snapshot,{...step,groupKey:step.groupKey??'manual',protocolStepRef:step.protocolStepRef??null,description:step.description??''},(parameters??{}) as Record<string,string|number|boolean>);
  const notes = runStepNotes(structured);
  // Preserve a captured documentation-only Protocol in preview/export too. It
  // has no completion control and must not disappear merely because its count is zero.
  const versions=(snapshot as {versions?:Array<{protocolVersionId:string;protocolTitle?:string;displayVersion?:string;contentJson?:unknown}>})?.versions??[];
  for(const version of versions.filter(version=>!steps.some(step=>step.groupKey===version.protocolVersionId))) {
    const parsed=protocolDocumentSchema.safeParse(version.contentJson);
    if(!parsed.success)continue;
    blocks.push({id:`run-derived:reference:${version.protocolVersionId}`,type:'heading',text:version.protocolTitle??'Protocol reference'});
    blocks.push(...(parsed.data.sections.find(section=>section.key==='steps')?.blocks??[]).map(block=>scientific(block,`run-derived:reference:${version.protocolVersionId}:`)));
  }
  const groupIndex = (id: string) => structured.plan.stepGroups[id] === 'shared' ? -1 : structured.plan.groups.findIndex(group => group.id === structured.plan.stepGroups[id]);
  const parts = new Map<string, ExecutionRecordStep[]>();
  for (const step of [...steps].sort((a,b)=>a.groupOrder-b.groupOrder || groupIndex(a.id)-groupIndex(b.id) || a.order-b.order)) {
    const key = `${step.groupOrder}:${structured.steps[step.id]?.groupId ?? ''}`;
    parts.set(key, [...(parts.get(key) ?? []), step]);
  }
  let partIndex = 0;
  for (const [key, partSteps] of parts) {
    partIndex++;
    const first = partSteps[0], adoptedFirst = structured.steps[first.id];
    const captured = versions.find(version => version.protocolVersionId === first.groupKey);
    const protocolTitle = captured?.protocolTitle ?? experimentStepGroupHeading(first.groupTitle).title;
    const title = [adoptedFirst?.groupLabel, protocolTitle].filter(Boolean).join(' · ');
    const applicable = partSteps.filter(step => structured.steps[step.id]?.applicability !== 'not-applicable');
    const required = applicable.filter(step => !structured.steps[step.id]?.optional);
    const meta = [captured?.displayVersion ? `v${captured.displayVersion}` : undefined, `已完成 ${required.filter(step => step.completed).length}/${required.length} 步`].filter(Boolean).join(' · ');
    blocks.push({ id: `run-derived:group:${key}`, type: 'heading', text: `${partIndex}. ${title}`, execution: { role: 'group', title, index: partIndex, meta } });
    // Shared preparation belongs to every group; its system is each group's own, so it shows none.
    const version = adoptedFirst && adoptedFirst.groupId !== 'shared' ? structured.versions.find(item => item.id === adoptedFirst.versionId) : undefined;
    if (version) {
      const adopted = structured.plan.versions[version.id], systems = version.document.systems!;
      const marks = optionMarks(systems);
      const choice = systems.dimensions.map(d => { const option = d.options.find(o => o.id === adopted?.selections[d.id]); return `${d.label}：${option ? [marks.get(`${d.id}:${option.id}`)?.glyph, option.label].filter(Boolean).join(' ') : '待选择'}`; }).join('；');
      if (systems.dimensions.length || !adopted) blocks.push(detail({ id: `run-derived:system:${key}`, type: 'text', text: adopted ? `本次体系 · ${choice || '无需选择'}（确认于 ${recordTime(adopted.confirmedAt)}）` : '尚未确认本次体系' }));
    }
    for (const step of applicable) {
      const adoptedStep = structured.steps[step.id];
      const content = stepContent(step);
      blocks.push(...(adoptedStep ? notes.before[step.id] ?? [] : content.notesBefore).map(block => note(scientific(block, `run-derived:note:${step.id}:`))));
      const body = adoptedStep ? adoptedStep.content_blocks ?? [] : content.blocks;
      const derivedTitle = adoptedStep ? adoptedStep.title_source === 'derived' : 'derivedTitle' in content && Boolean(content.derivedTitle);
      const stepTitle = derivedTitle ? '' : adoptedStep?.title ?? step.title;
      const skipped = structured.plan.skips[step.id];
      const status = skipped ? `已跳过：${skipped.reason}` : !step.completed && adoptedStep?.blocked ? '待确定' : adoptedStep?.optional ? '可选' : undefined;
      const blocker = step.completed ? null : step.timerStartedAt && adoptedStep ? '计时进行中，请先结束计时' : stepExecutionBlocker(structured, step.id, true);
      const deviation = step.deviationNote?.trim();
      const label = ['abnormal','incident'].includes(step.deviationType ?? '') ? '异常' as const : '偏差' as const;
      blocks.push({ id: `run-derived:${step.id}`, type: 'text', text: [`${step.order}.`, step.completed ? '✓' : skipped ? '' : '未完成', stepTitle, status, deviation ? `${label}（见偏差与事件）` : ''].filter(Boolean).join(' '), execution: {
        role: runStepIsConfirmation(snapshot, step) ? 'confirmation' : 'step', stepId: step.id, title: stepTitle, number: step.order, completed: step.completed,
        ...(step.completed && step.completedAt ? { completedAt: step.completedAt.toISOString() } : {}),
        ...(status ? { status } : {}), ...(blocker ? { blockedReason: blocker } : {}), allowsDeviation: step.allowsDeviation ?? true,
        ...(deviation ? { deviationLabel: label, deviationNote: deviation, deviationType: step.deviationType ?? 'other', ...(step.deviationImpact ? { impact: step.deviationImpact } : {}), ...(step.deviationAuthor ? { author: step.deviationAuthor } : {}), ...(step.deviationAt ? { deviationAt: step.deviationAt.toISOString() } : {}) } : {}),
      } });
      blocks.push(...body.filter(block => block.type !== 'mix').map(block => detail(scientific(block, `run-derived:${step.id}:body:`), step.id)));
      if (!body.length && step.description?.trim()) blocks.push(detail({ id: `run-derived:${step.id}:description`, type: 'text', text: step.description }, step.id));
      // A mix card reads as what was confirmed: its totals and the aliquot; until then, its per-reaction recipe and that it is unconfirmed.
      for (const mix of stepMixes(structured, step.id)) {
        const receipt = structured.plan.mixes[`${step.id}:${mix.id}`], per = mixPer(mix);
        const bench = (structured.plan.runMixes[step.id] ?? []).some(item => item.id === mix.id) ? '（执行时补充）' : '';
        if (!receipt) { const source = stepVersion(structured, step.id); blocks.push(detail({ id: `run-derived:mix:${step.id}:${mix.id}`, type: 'text', text: `${mixSummary(mapChipReferences(mix, id => protocolChipText(id, source?.document.systems, source?.parameters)))}${bench}（尚未确认）` }, step.id)); continue; }
        blocks.push(detail({ id: `run-derived:mix:${step.id}:${mix.id}`, type: 'table', caption: `${mixTitle(mix)}${bench} · ${receipt.quantity} ${per} · 余量 ${receipt.overagePercent}% · 确认于 ${recordTime(receipt.confirmedAt)}`, rows: [['组分', `每${per}`, '合计'], ...receipt.lines.map(line => [`${line.name}${line.mode === 'separate' ? '（单独加）' : ''}`, chipAmount(line.perReaction, line.unit), chipAmount(Number(line.total.toPrecision(6)), line.unit)])] }, step.id));
        blocks.push(detail({ id: `run-derived:mix-aliquot:${step.id}:${mix.id}`, type: 'text', text: `分装：${receipt.aliquot}` }, step.id));
      }
      const values = Object.entries(structured.plan.actualValues[step.id] ?? {});
      if (values.length) blocks.push(detail({ id: `run-derived:actual:${step.id}`, type: 'table', caption: '实际记录（不覆盖规定用量）', rows: [['记录项', '实际值', '记录时间'], ...values.map(([id, v]) => [adoptedStep?.actualFields.find(f => f.id === id)?.label ?? id, `${v.value} ${v.unit}`, recordTime(v.recordedAt)])] }, step.id));
      blocks.push(...(step.evidence ?? []).map((block, index) => detail({ ...block, id: `run-derived:${step.id}:evidence:${index}` }, step.id)));
      if (deviation) deviations.push({ id: `run-derived:deviation:${step.id}`, type: 'text', text: [parts.size > 1 ? `${partIndex}. ${protocolTitle}` : '', `第 ${step.order} 步`, deviationTypeLabel(step.deviationType), step.deviationImpact ? `${deviation}（影响：${step.deviationImpact}）` : deviation, step.deviationAt ? recordTime(step.deviationAt) : '', step.deviationAuthor ?? ''].filter(Boolean).join(' · '), execution: { role: 'deviation', stepId: step.id, title: `第 ${step.order} 步`, number: step.order, deviationLabel: label, deviationNote: deviation, deviationType: step.deviationType ?? 'other' } });
    }
    const last = applicable.at(-1);
    if (last) blocks.push(...(structured.steps[last.id] ? notes.after[last.id] ?? [] : stepContent(last).notesAfter).map(block => note(scientific(block, `run-derived:note-after:${last.id}:`))));
    // Provenance of this run's values: the frozen source version, the plan revision, each parameter's adopted value and where it came from, and the calculations behind them.
    if (version) {
      const adopted = structured.plan.versions[version.id], systems = version.document.systems!;
      const sourceLabel = { fixed: '规程固定值', lookup: '按本次体系', actual: '本次填写', calculator: '计算后确认' } as const;
      blocks.push(detail({ id: `run-derived:parameters:${key}`, type: 'table', caption: `源版本 ${captured?.displayVersion ? `v${captured.displayVersion}` : ''}（${version.sourceVersionId}）· 执行方案修订 ${structured.plan.revision}${adopted ? ` · 体系确认于 ${recordTime(adopted.confirmedAt)}` : ''}`,
        rows: [['参数', '本次值', '来源'], ...systems.parameters.filter(parameter => !parameter.ownerToolId || version.parameters[parameter.id]?.status === 'resolved').map(parameter => { const value = version.parameters[parameter.id]; return [parameterLongName(parameter, systems), value?.status === 'resolved' ? chipAmount(value.value!, value.unit, parameter.source.kind === 'calculator') : readableError(value?.message ?? '待确定'), sourceLabel[parameter.source.kind]]; })] }, undefined, '采用参数与来源'));
      for (const [id, receipt] of Object.entries(adopted?.calculations ?? {})) {
        const parameter = systems.parameters.find(p => p.id === id), calculatorId = parameter?.source.kind === 'calculator' ? parameter.source.calculatorId : undefined;
        const used = calculatorId ? calculationInputSummary(calculatorId, receipt.snapshot.rawInputs ?? {}) : JSON.stringify(receipt.snapshot.rawInputs);
        blocks.push(detail({ id: `run-derived:calculation:${version.id}:${id}`, type: 'text', text: `${parameter?.label || '计算结果'}：${receipt.value} ${receipt.unit} · ${calculatorId ? protocolCalculations[calculatorId].label : receipt.snapshot.calculatorId} ${receipt.snapshot.methodVersion} · 确认于 ${recordTime(receipt.confirmedAt)}\n输入：${used}${[...receipt.snapshot.notes, ...receipt.snapshot.warnings].length ? `\n${[...receipt.snapshot.notes, ...receipt.snapshot.warnings].join('\n')}` : ''}` }, undefined, '计算记录'));
      }
    }
    const other = partSteps.filter(step => structured.steps[step.id]?.applicability === 'not-applicable');
    if (other.length) blocks.push(detail({ id: `run-derived:inapplicable:${key}`, type: 'text', text: other.map(step => `${step.order}. ${structured.steps[step.id]?.title_source === 'derived' ? stepOpening(structured.steps[step.id]?.content_blocks) : structured.steps[step.id]?.title ?? step.title}`).join('\n') }, undefined, `其他体系的步骤 · 不适用 · ${other.length} 步`));
  }
  return {...document,sections:document.sections.map(section=>section.key==='execution' ? {...section,blocks:[...section.blocks.filter(block=>!block.id.startsWith('run-derived:')),...blocks]}
    : section.key==='deviations' ? {...section,blocks:[...deviations,...section.blocks.filter(block=>!block.id.startsWith('run-derived:'))]} : section)};
}

/** A step's opening words, for listing steps another system uses. */
const stepOpening = (blocks: ProtocolContentBlock[] | undefined) => (blocks ?? []).map(executionBlockText).join(' ').slice(0, 120);

/**
 * How run-derived blocks read: a step with the details that belong to it, consecutive details that share a `fold` label as one
 * collapsed group, and everything else as it is. The document itself stays flat for exports.
 */
export function executionSegments<T extends { id: string; execution?: { role: string; fold?: string; stepId?: string; number?: number } }>(blocks: readonly T[]) {
  const segments: Array<{ kind: 'block'; block: T } | { kind: 'fold'; label: string; blocks: T[] } | { kind: 'step'; block: T; details: T[] }> = [];
  for (const block of blocks) {
    const execution = block.execution, last = segments.at(-1);
    if (execution?.role === 'detail' && !execution.fold && execution.stepId && last?.kind === 'step' && last.block.execution?.stepId === execution.stepId) last.details.push(block);
    else if (execution?.role === 'detail' && execution.fold) {
      if (last?.kind === 'fold' && last.label === execution.fold) last.blocks.push(block);
      else segments.push({ kind: 'fold', label: execution.fold, blocks: [block] });
    } else if ((execution?.role === 'step' || execution?.role === 'confirmation') && execution.number !== undefined) segments.push({ kind: 'step', block, details: [] });
    else segments.push({ kind: 'block', block });
  }
  return segments;
}
