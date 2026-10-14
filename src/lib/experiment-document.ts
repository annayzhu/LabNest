import { structuredRunView } from './structured-run';
import { resolveProtocolSystem } from './structured-protocol';
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

/** Derived at read/export time: current persisted Run evidence, never authored prose.
 * The reserved ID prefix permits refreshing the projection without accumulating it. */
export function experimentExecutionDocument(contentJson: unknown, steps: readonly {
  id: string; description?:string; protocolStepRef?:string|null;groupKey?:string;groupOrder: number; order: number; groupTitle: string; title: string;
  completed: boolean; completedAt?: Date | null; deviationNote?: string | null; deviationType?: string | null;
  deviationImpact?: string | null; deviationAuthor?: string | null;
  evidence?: ScientificDocument['sections'][number]['blocks'];
}[], parameters?: unknown, snapshot?:unknown, executionPlan?:unknown): ScientificDocument {
  const document = normalizeScientificDocument(contentJson, experimentSections);
  const blocks: ScientificDocument['sections'][number]['blocks'] = [];
  const structured = structuredRunView(snapshot, executionPlan, steps.map(step => ({ ...step, groupKey: step.groupKey ?? 'manual', protocolStepRef: step.protocolStepRef ?? null })));
  for (const version of structured.versions) {
    const adopted = structured.plan.versions[version.id], systems = version.document.systems!;
    const resolution = resolveProtocolSystem(systems, adopted?.selections ?? {}, adopted?.actualInputs ?? {}, adopted?.calculations);
    const choice = systems.dimensions.map(d => `${d.label}：${d.options.find(o => o.id === adopted?.selections[d.id])?.label ?? '待选择'}`).join('；');
    blocks.push({ id: `run-derived:system:${version.id}`, type: 'text', text: `本次执行记录 · 当前实验组 · 源版本 ${version.title} v${version.displayVersion}（${version.id}）\n${choice}\n${adopted ? '采用确认时间：' + adopted.confirmedAt : '尚未确认体系'} · 计划修订 ${structured.plan.revision}` });
    blocks.push({ id: `run-derived:system-parameters:${version.id}`, type: 'table', rows: [['采用参数', '值', '来源'], ...systems.parameters.map(p => { const value = resolution.parameters[p.id]; return [p.label, value?.status === 'resolved' ? `${value.value} ${value.unit}` : value?.message ?? '待确定', { fixed: '固定值', lookup: '体系查表', actual: '本次填写', calculator: '计算后确认' }[p.source.kind]]; })] });
    for (const [id, receipt] of Object.entries(adopted?.calculations ?? {})) blocks.push({ id: `run-derived:calculation:${version.id}:${id}`, type: 'text', text: `${systems.parameters.find(p => p.id === id)?.label} · ${receipt.snapshot.calculatorId} ${receipt.snapshot.methodVersion} · 确认 ${receipt.confirmedAt}\n输入：${JSON.stringify(receipt.snapshot.rawInputs)}\n当时计算结果：${receipt.value} ${receipt.unit}\n${[...receipt.snapshot.notes, ...receipt.snapshot.warnings].join('\n')}` });
  }
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
  let group: number | undefined;
  // Preserve a captured documentation-only Protocol in preview/export too. It
  // has no completion control and must not disappear merely because its count is zero.
  const versions=(snapshot as {versions?:Array<{protocolVersionId:string;protocolTitle?:string;contentJson?:unknown}>})?.versions??[];
  for(const version of versions.filter(version=>!steps.some(step=>step.groupKey===version.protocolVersionId))) {
    const parsed=protocolDocumentSchema.safeParse(version.contentJson);
    if(!parsed.success)continue;
    blocks.push({id:`run-derived:reference:${version.protocolVersionId}`,type:'heading',text:version.protocolTitle??'Protocol reference'});
    blocks.push(...(parsed.data.sections.find(section=>section.key==='steps')?.blocks??[]).map(block=>scientific(block,`run-derived:reference:${version.protocolVersionId}:`)));
  }
  for (const step of [...steps].sort((a,b)=>a.groupOrder-b.groupOrder || a.order-b.order)) {
    let rich=runStepContent(snapshot,{...step,groupKey:step.groupKey??'manual',protocolStepRef:step.protocolStepRef??null,description:step.description??''},(parameters??{}) as Record<string,string|number|boolean>);
    const adoptedStep = structured.steps[step.id];
    if (adoptedStep) rich = { ...rich, blocks: adoptedStep.content_blocks ?? [], common: structured.versions.find(v => v.id === adoptedStep.versionId)?.commonBlocks ?? [] };
    if (adoptedStep?.applicability === 'not-applicable') {
      blocks.push({ id: `run-derived:inapplicable:${step.id}`, type: 'text', text: `${step.title} · 不适用于本次实验（来源 ${step.protocolStepRef}）` });
      continue;
    }
    if (group !== step.groupOrder) {
      group = step.groupOrder;
      if(rich.common.length)blocks.push(...rich.common.map(block=>scientific(block,`run-derived:info:${group}:`)));
      blocks.push({id:`run-derived:group:${group}`,type:'heading',text:step.groupTitle,execution:{role:'group',title:step.groupTitle}});
    }
    const execution = {role:runStepIsConfirmation(snapshot,step)?'confirmation' as const:'step' as const,stepId:step.id,title:step.title,completed:step.completed,...(step.completed&&step.completedAt?{completedAt:step.completedAt.toISOString()}:{})};
    const skipped = structured.plan.skips[step.id];
    const title = `${step.completed ? '✓' : skipped ? '已跳过：' + skipped.reason : adoptedStep?.blocked ? '待确定' : '未完成'} ${adoptedStep?.title ?? step.title}`;
    if (step.deviationNote?.trim()) {
      blocks.push({id:`run-derived:${step.id}`,type:'callout',tone:'critical',execution:{...execution,deviationLabel:['abnormal','incident'].includes(step.deviationType ?? '')?'异常':'偏差',deviationNote:step.deviationNote.trim(),impact:step.deviationImpact??undefined,author:step.deviationAuthor??undefined},text:[title,`${['abnormal','incident'].includes(step.deviationType ?? '') ? '异常' : '偏差'}：${step.deviationNote.trim()}`,step.deviationImpact ? `影响评估：${step.deviationImpact}` : null,step.deviationAuthor ? `记录人：${step.deviationAuthor}` : null].filter(Boolean).join('\n')});
    } else blocks.push({id:`run-derived:${step.id}`,type:'text',text:title,execution});
    const values = Object.entries(structured.plan.actualValues[step.id] ?? {});
    if (values.length) blocks.push({ id: `run-derived:actual:${step.id}`, type: 'table', caption: '实际记录（不覆盖规定用量）', rows: [['记录项', '实际值', '记录时间'], ...values.map(([id, v]) => [adoptedStep?.actualFields.find(f => f.id === id)?.label ?? id, `${v.value} ${v.unit}`, v.recordedAt])] });
    blocks.push(...rich.blocks.map(block=>scientific(block,`run-derived:${step.id}:body:`)));
    if(!rich.blocks.length && step.description?.trim())blocks.push({id:`run-derived:${step.id}:description`,type:"text",text:step.description});
    blocks.push(...(step.evidence??[]).map((block,index)=>({...block,id:`run-derived:${step.id}:evidence:${index}`})));
  }
  return {...document,sections:document.sections.map(section=>section.key==='execution' ? {...section,blocks:[...section.blocks.filter(block=>!block.id.startsWith('run-derived:')),...blocks]}:section)};
}
