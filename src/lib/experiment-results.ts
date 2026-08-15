import { normalizeResultTemplates } from "./result-templates";
import type { ResultTemplate } from "./types";

export type ExperimentResultTemplateSource = {
  protocolVersionId: string;
  protocolCode?: string | null;
  protocolTitle: string;
  displayVersion: string;
  resultTemplatesJson: unknown;
};

export type ExperimentResultRecordSummary = {
  id: string;
  title: string;
  resultType: string;
  sourceType: string;
  status: string;
  recordStatus: string;
  qualityStatus: string;
  validationStatus: string;
  protocolVersionId: string | null;
  templateKey: string | null;
};

export type ExperimentResultTemplateSlot = {
  protocolVersionId: string;
  protocolLabel: string;
  displayVersion: string;
  template: ResultTemplate;
  records: ExperimentResultRecordSummary[];
};

export type ExperimentResultRecording = {
  slots: ExperimentResultTemplateSlot[];
  additionalResults: ExperimentResultRecordSummary[];
};

export function isSingleResultTemplate(template: ResultTemplate) {
  return ["single", "per_run"].includes(template.cardinality ?? "per_run");
}

export function buildExperimentResultRecording(
  sources: ExperimentResultTemplateSource[],
  results: ExperimentResultRecordSummary[],
): ExperimentResultRecording {
  const availableResults = results.filter((result) => result.status !== "archived");
  const matchedResultIds = new Set<string>();
  const slots = sources.flatMap((source) => normalizeResultTemplates(source.resultTemplatesJson).map((template) => {
    const records = availableResults.filter((result) => {
      const matches = result.sourceType === "protocol_template"
        && result.protocolVersionId === source.protocolVersionId
        && result.templateKey === template.templateKey;
      if (matches) matchedResultIds.add(result.id);
      return matches;
    });
    return {
      protocolVersionId: source.protocolVersionId,
      protocolLabel: source.protocolCode?.trim() || source.protocolTitle,
      displayVersion: source.displayVersion,
      template,
      records,
    };
  }));

  return {
    slots,
    additionalResults: availableResults.filter((result) => !matchedResultIds.has(result.id)),
  };
}

export function existingResultHref(result: ExperimentResultRecordSummary) {
  const editable = result.status !== "archived" && ["draft", "recorded"].includes(result.recordStatus);
  return editable ? `/results/${result.id}/edit` : `/results/${result.id}`;
}

export function newTemplateResultHref(experimentId: string, slot: ExperimentResultTemplateSlot) {
  const templateKey = encodeURIComponent(slot.template.templateKey ?? "");
  const protocolVersionId = encodeURIComponent(slot.protocolVersionId);
  return `/results/new?experiment=${encodeURIComponent(experimentId)}&template=${templateKey}&protocolVersionId=${protocolVersionId}`;
}

export function preferredResultRecordingHref(experimentId: string, recording: ExperimentResultRecording) {
  if (recording.slots.length !== 1) return recording.slots.length ? "#result-recording" : `/results/new?experiment=${encodeURIComponent(experimentId)}&manual=1`;
  const slot = recording.slots[0];
  if (!isSingleResultTemplate(slot.template)) return "#result-recording";
  return slot.records[0] ? existingResultHref(slot.records[0]) : newTemplateResultHref(experimentId, slot);
}
