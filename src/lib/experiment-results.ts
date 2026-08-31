import { normalizeResultTemplate, normalizeResultTemplates, stableResultKey } from "./result-templates";
import type { ResultTemplate } from "./types";

export const EXPERIMENT_RESULT_REPORT_KEY = "experiment_result_report";
export const EXPERIMENT_RESULT_TYPE = "Experiment result";

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

export type ExperimentResultModule = {
  id: string;
  protocolVersionId: string;
  protocolLabel: string;
  displayVersion: string;
  template: ResultTemplate;
};

export type ExperimentResultRecording = {
  slots: ExperimentResultTemplateSlot[];
  modules: ExperimentResultModule[];
  report?: ExperimentResultRecordSummary;
  legacyTemplateResults: ExperimentResultRecordSummary[];
  additionalResults: ExperimentResultRecordSummary[];
};

function evidenceKey(key: string | undefined, label: string | undefined, unit?: string) {
  const genericTokens = new Set(["sample", "measured", "measurement", "result", "value"]);
  const semantic = stableResultKey(label || key || "evidence")
    .split("_")
    .filter((token) => token && !genericTokens.has(token))
    .join("_") || stableResultKey(key || label || "evidence");
  return `${semantic}:${stableResultKey(unit || "unitless")}`;
}

function equivalentEvidenceKeys(left: string, right: string) {
  const [leftSemantic, leftUnit] = left.split(":");
  const [rightSemantic, rightUnit] = right.split(":");
  if (leftUnit !== rightUnit) return false;
  if (leftSemantic === rightSemantic) return true;
  const contextTokens = new Set(["rna", "dna", "protein", "nucleic", "acid"]);
  const base = (semantic: string) => semantic.split("_").filter((token) => !contextTokens.has(token)).join("_");
  const leftBase = base(leftSemantic);
  const rightBase = base(rightSemantic);
  return leftBase === rightBase && (leftSemantic === leftBase || rightSemantic === rightBase);
}

function datasetIdentityKey(dataset: NonNullable<ResultTemplate["datasets"]>[number]) {
  const identityColumns = dataset.columns.filter((column) => {
    const key = stableResultKey(`${column.key}_${column.label}`);
    return column.semanticRole === "identifier" || /(?:^|_)(?:sample|specimen|subject|aliquot)(?:_|$)/.test(key) && /(?:^|_)(?:id|code|name)(?:_|$)/.test(key);
  });
  return identityColumns.length
    ? `rows:${identityColumns.map((column) => evidenceKey(column.key, column.label, column.unit)).sort().join("|")}`
    : `dataset:${evidenceKey(dataset.key, dataset.label)}`;
}

export function experimentResultModules(sources: ExperimentResultTemplateSource[]): ExperimentResultModule[] {
  return sources.flatMap((source) => normalizeResultTemplates(source.resultTemplatesJson).map((template) => ({
    id: `${source.protocolVersionId}:${template.templateKey}`,
    protocolVersionId: source.protocolVersionId,
    protocolLabel: source.protocolCode?.trim() || source.protocolTitle,
    displayVersion: source.displayVersion,
    template,
  })));
}

export function buildExperimentResultReportTemplate(
  modules: ExperimentResultModule[],
  selectedModuleIds = modules.map((module) => module.id),
): ResultTemplate {
  const selected = modules.filter((module) => selectedModuleIds.includes(module.id));
  const fields = new Map<string, ResultTemplate["fields"][number]>();
  const datasets = new Map<string, NonNullable<ResultTemplate["datasets"]>[number]>();
  const artifacts = new Map<string, NonNullable<ResultTemplate["artifacts"]>[number]>();

  selected.forEach(({ template }) => {
    template.fields.forEach((field) => {
      const key = evidenceKey(field.key, field.label ?? field.name, field.unit);
      const existing = fields.get(key);
      if (existing) {
        fields.set(key, { ...existing, required: Boolean(existing.required || field.required) });
        return;
      }
      const equivalent = [...fields.entries()].filter(([candidateKey]) => equivalentEvidenceKeys(candidateKey, key));
      if (equivalent.length === 1) {
        const [candidateKey, candidate] = equivalent[0];
        fields.set(candidateKey, { ...candidate, required: Boolean(candidate.required || field.required) });
      } else {
        fields.set(key, field);
      }
    });
    template.datasets?.forEach((dataset) => {
      const key = datasetIdentityKey(dataset);
      const existing = datasets.get(key);
      if (!existing) {
        datasets.set(key, dataset);
        return;
      }
      const columns = new Map(existing.columns.map((column) => [evidenceKey(column.key, column.label, column.unit), column]));
      dataset.columns.forEach((column) => {
        const columnKey = evidenceKey(column.key, column.label, column.unit);
        const current = columns.get(columnKey);
        if (current) {
          columns.set(columnKey, { ...current, required: Boolean(current.required || column.required) });
          return;
        }
        const equivalent = [...columns.entries()].filter(([candidateKey]) => equivalentEvidenceKeys(candidateKey, columnKey));
        if (equivalent.length === 1) {
          const [candidateKey, candidate] = equivalent[0];
          columns.set(candidateKey, { ...candidate, required: Boolean(candidate.required || column.required) });
        } else {
          columns.set(columnKey, column);
        }
      });
      datasets.set(key, {
        ...existing,
        required: Boolean(existing.required || dataset.required),
        columns: [...columns.values()],
      });
    });
    template.artifacts?.forEach((artifact) => {
      const key = evidenceKey(artifact.key, artifact.label, artifact.kind);
      const existing = artifacts.get(key);
      artifacts.set(key, existing ? { ...existing, required: Boolean(existing.required || artifact.required) } : artifact);
    });
  });

  // A measurement may be declared once as a direct field and again as a
  // per-sample table column by another Protocol. Keep the row-aware table
  // representation and transfer the stricter required flag to that column.
  const reportFields = [...fields.values()].filter((field) => {
    const key = evidenceKey(field.key, field.label ?? field.name, field.unit);
    const matches = [...datasets.entries()].flatMap(([datasetKey, dataset]) => dataset.columns.flatMap((column, columnIndex) => equivalentEvidenceKeys(evidenceKey(column.key, column.label, column.unit), key) ? [{ datasetKey, columnIndex }] : []));
    if (matches.length !== 1) return true;
    const match = matches[0];
    const dataset = datasets.get(match.datasetKey)!;
    datasets.set(match.datasetKey, { ...dataset, columns: dataset.columns.map((column, index) => index === match.columnIndex ? { ...column, required: Boolean(column.required || field.required) } : column) });
    return false;
  });

  return normalizeResultTemplate({
    result_type: EXPERIMENT_RESULT_TYPE,
    templateKey: EXPERIMENT_RESULT_REPORT_KEY,
    title: EXPERIMENT_RESULT_TYPE,
    cardinality: "per_run",
    fields: reportFields,
    datasets: [...datasets.values()],
    artifacts: [...artifacts.values()],
    view: { preset: "generic", charts: [] },
  });
}

export function isSingleResultTemplate(template: ResultTemplate) {
  return ["single", "per_run"].includes(template.cardinality ?? "per_run");
}

export function buildExperimentResultRecording(
  sources: ExperimentResultTemplateSource[],
  results: ExperimentResultRecordSummary[],
): ExperimentResultRecording {
  const availableResults = results.filter((result) => result.status !== "archived");
  const report = availableResults.find((result) => result.templateKey === EXPERIMENT_RESULT_REPORT_KEY);
  const modules = experimentResultModules(sources);
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
    modules,
    report,
    legacyTemplateResults: availableResults.filter((result) => matchedResultIds.has(result.id)),
    additionalResults: availableResults.filter((result) => result.id !== report?.id && !matchedResultIds.has(result.id)),
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
  if (recording.report) return existingResultHref(recording.report);
  return recording.modules.length
    ? `/results/new?experiment=${encodeURIComponent(experimentId)}&report=1`
    : `/results/new?experiment=${encodeURIComponent(experimentId)}&manual=1`;
}
