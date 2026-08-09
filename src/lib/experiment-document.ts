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
