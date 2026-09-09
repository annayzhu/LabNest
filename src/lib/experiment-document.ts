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
  id: string; groupOrder: number; order: number; groupTitle: string; title: string;
  completed: boolean; deviationNote?: string | null; deviationType?: string | null;
  deviationImpact?: string | null; deviationAuthor?: string | null;
}[]): ScientificDocument {
  const document = normalizeScientificDocument(contentJson, experimentSections);
  const blocks: ScientificDocument['sections'][number]['blocks'] = [];
  let group: number | undefined;
  for (const step of [...steps].sort((a,b)=>a.groupOrder-b.groupOrder || a.order-b.order)) {
    if (group !== step.groupOrder) {
      group = step.groupOrder;
      blocks.push({id:`run-derived:group:${group}`,type:'heading',text:step.groupTitle});
    }
    const title = `${step.completed ? '✓' : '未完成'} ${step.title}`;
    if (step.deviationNote?.trim()) {
      blocks.push({id:`run-derived:${step.id}`,type:'callout',tone:'critical',text:[title,`${['abnormal','incident'].includes(step.deviationType ?? '') ? '异常' : '偏差'}：${step.deviationNote.trim()}`,step.deviationImpact ? `影响评估：${step.deviationImpact}` : null,step.deviationAuthor ? `记录人：${step.deviationAuthor}` : null].filter(Boolean).join('\n')});
    } else blocks.push({id:`run-derived:${step.id}`,type:'text',text:title});
  }
  return {...document,sections:document.sections.map(section=>section.key==='execution' ? {...section,blocks:[...section.blocks.filter(block=>!block.id.startsWith('run-derived:')),...blocks]}:section)};
}
