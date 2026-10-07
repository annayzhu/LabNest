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
}[], parameters?: unknown, snapshot?:unknown): ScientificDocument {
  const document = normalizeScientificDocument(contentJson, experimentSections);
  const blocks: ScientificDocument['sections'][number]['blocks'] = [];
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
    const rich=runStepContent(snapshot,{...step,groupKey:step.groupKey??'manual',protocolStepRef:step.protocolStepRef??null,description:step.description??''},(parameters??{}) as Record<string,string|number|boolean>);
    if (group !== step.groupOrder) {
      group = step.groupOrder;
      if(rich.common.length)blocks.push(...rich.common.map(block=>scientific(block,`run-derived:info:${group}:`)));
      blocks.push({id:`run-derived:group:${group}`,type:'heading',text:step.groupTitle,execution:{role:'group',title:step.groupTitle}});
    }
    const execution = {role:runStepIsConfirmation(snapshot,step)?'confirmation' as const:'step' as const,stepId:step.id,title:step.title,completed:step.completed,...(step.completed&&step.completedAt?{completedAt:step.completedAt.toISOString()}:{})};
    const title = `${step.completed ? '✓' : '未完成'} ${step.title}`;
    if (step.deviationNote?.trim()) {
      blocks.push({id:`run-derived:${step.id}`,type:'callout',tone:'critical',execution:{...execution,deviationLabel:['abnormal','incident'].includes(step.deviationType ?? '')?'异常':'偏差',deviationNote:step.deviationNote.trim(),impact:step.deviationImpact??undefined,author:step.deviationAuthor??undefined},text:[title,`${['abnormal','incident'].includes(step.deviationType ?? '') ? '异常' : '偏差'}：${step.deviationNote.trim()}`,step.deviationImpact ? `影响评估：${step.deviationImpact}` : null,step.deviationAuthor ? `记录人：${step.deviationAuthor}` : null].filter(Boolean).join('\n')});
    } else blocks.push({id:`run-derived:${step.id}`,type:'text',text:title,execution});
    blocks.push(...rich.blocks.map(block=>scientific(block,`run-derived:${step.id}:body:`)));
    if(!rich.blocks.length && step.description?.trim())blocks.push({id:`run-derived:${step.id}:description`,type:"text",text:step.description});
    blocks.push(...(step.evidence??[]).map((block,index)=>({...block,id:`run-derived:${step.id}:evidence:${index}`})));
  }
  return {...document,sections:document.sections.map(section=>section.key==='execution' ? {...section,blocks:[...section.blocks.filter(block=>!block.id.startsWith('run-derived:')),...blocks]}:section)};
}
