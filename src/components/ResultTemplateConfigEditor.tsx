"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ProtocolContentBlock } from "@/lib/protocol-document";
import {
  checkResultTemplate,
  createDefaultResultTemplate,
  normalizeResultTemplate,
  resultCardinalities,
  resultDatasetColumnTypes,
  resultFieldDataTypes,
  resultKindsOptions,
  resultSemanticRoles,
  resultTemplateFieldsToRows,
  resultViewPresetOptions,
  stableResultKey,
} from "@/lib/result-templates";
import type { ResultTemplate, ResultTemplateDataset } from "@/lib/types";

type TableBlock = Extract<ProtocolContentBlock, { type: "table" }>;

const inputClass = "focus-ring mt-1 h-10 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink";
const textareaClass = "focus-ring mt-1 min-h-32 w-full resize-y rounded-[8px] border border-hairline bg-warm p-3 font-mono text-xs leading-6 text-ink";

function parseBoolean(value: string) {
  return /^(yes|true|1|是|必填)$/i.test(value.trim());
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function fieldRows(template: ResultTemplate) {
  return resultTemplateFieldsToRows(template).slice(1).map((row) => row.join("\t")).join("\n");
}

function fieldsFromTsv(value: string) {
  return value.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
    const [key, label, rawType, unit, required, rawRole, options, min, max] = line.split("\t");
    const dataType = resultFieldDataTypes.includes(rawType as never) ? rawType as ResultTemplate["fields"][number]["dataType"] : "text";
    const semanticRole = resultSemanticRoles.includes(rawRole as never) ? rawRole as ResultTemplate["fields"][number]["semanticRole"] : "annotation";
    const fieldKey = stableResultKey(key || label || `field_${index + 1}`);
    return {
      key: fieldKey,
      label: label?.trim() || key?.trim() || `Field ${index + 1}`,
      name: label?.trim() || key?.trim() || `Field ${index + 1}`,
      dataType,
      type: dataType,
      unit: unit?.trim() || undefined,
      required: parseBoolean(required ?? ""),
      semanticRole,
      options: options?.split(/[|;,；，]/).map((item) => item.trim()).filter(Boolean),
      validation: min?.trim() || max?.trim() ? { min: parseOptionalNumber(min ?? ""), max: parseOptionalNumber(max ?? "") } : undefined,
    };
  });
}

function columnRows(dataset: ResultTemplateDataset) {
  return dataset.columns.map((column) => [column.key, column.label, column.dataType, column.unit ?? "", column.required ? "Yes" : "No", column.semanticRole ?? "measurement"].join("\t")).join("\n");
}

function columnsFromTsv(value: string) {
  return value.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
    const [key, label, rawType, unit, required, rawRole] = line.split("\t");
    const dataType = resultDatasetColumnTypes.includes(rawType as never) ? rawType as ResultTemplateDataset["columns"][number]["dataType"] : "text";
    const semanticRole = resultSemanticRoles.includes(rawRole as never) ? rawRole as ResultTemplateDataset["columns"][number]["semanticRole"] : "measurement";
    return { key: stableResultKey(key || label || `column_${index + 1}`), label: label?.trim() || key?.trim() || `Column ${index + 1}`, dataType, unit: unit?.trim() || undefined, required: parseBoolean(required ?? ""), semanticRole };
  });
}

export function ResultTemplateConfigEditor({ block, onChange }: { block: TableBlock; onChange: (block: TableBlock) => void }) {
  const template = normalizeResultTemplate(block.resultTemplate ?? createDefaultResultTemplate(block.caption || "measurement"));
  const check = checkResultTemplate(template);

  function update(next: ResultTemplate) {
    const normalized = normalizeResultTemplate(next);
    onChange({ ...block, caption: normalized.result_type, rows: resultTemplateFieldsToRows(normalized), resultTemplate: normalized });
  }

  function updateDataset(index: number, next: ResultTemplateDataset) {
    update({ ...template, datasets: (template.datasets ?? []).map((dataset, itemIndex) => itemIndex === index ? next : dataset) });
  }

  return <div className="mt-3 space-y-4">
    <div className="rounded-[8px] border border-sage/40 bg-sage-surface/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-moss">Result Template contract</p><p className="mt-1 text-xs leading-5 text-muted">This schema is frozen into each Result created from the ProtocolVersion.</p></div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${check.status === "complete" ? "bg-success-surface text-success" : check.status === "warning" ? "bg-warning-surface text-warning" : "bg-error-surface text-error"}`}>{check.status}</span>
      </div>
      {check.errors.length || check.warnings.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-graphite">{[...check.errors, ...check.warnings].map((message) => <li key={message}>{message}</li>)}</ul> : null}
    </div>

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <label className="xl:col-span-2"><span className="text-xs font-semibold text-muted">Result type / title</span><input value={template.result_type} onChange={(event) => update({ ...template, result_type: event.target.value, title: event.target.value })} className={inputClass} /></label>
      <label><span className="text-xs font-semibold text-muted">Stable template key</span><input value={template.templateKey ?? ""} onChange={(event) => update({ ...template, templateKey: stableResultKey(event.target.value) })} className={inputClass} /></label>
      <label><span className="text-xs font-semibold text-muted">Result kind</span><select value={template.resultKind} onChange={(event) => update({ ...template, resultKind: event.target.value as ResultTemplate["resultKind"] })} className={inputClass}>{resultKindsOptions.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      <label><span className="text-xs font-semibold text-muted">Cardinality</span><select value={template.cardinality} onChange={(event) => update({ ...template, cardinality: event.target.value as ResultTemplate["cardinality"] })} className={inputClass}>{resultCardinalities.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      <label><span className="text-xs font-semibold text-muted">View preset</span><select value={template.view?.preset} onChange={(event) => update({ ...template, view: { ...template.view, preset: event.target.value as ResultTemplate["view"] extends { preset?: infer P } ? P : never } })} className={inputClass}>{resultViewPresetOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="md:col-span-2 xl:col-span-4"><span className="text-xs font-semibold text-muted">Description</span><input value={template.description ?? ""} onChange={(event) => update({ ...template, description: event.target.value })} className={inputClass} placeholder="What evidence this Result should contain" /></label>
    </div>

    <label className="block"><span className="text-xs font-semibold text-muted">Fields · one row per field</span><textarea value={fieldRows(template)} onChange={(event) => update({ ...template, fields: fieldsFromTsv(event.target.value) })} className={textareaClass} placeholder="key[TAB]Label[TAB]type[TAB]unit[TAB]required[TAB]role[TAB]options[TAB]min[TAB]max" /><span className="mt-1 block text-xs text-muted">Columns: key · label · type · unit · required · semantic role · options · min · max</span></label>

    <section className="space-y-3 rounded-[9px] border border-hairline bg-warm/50 p-3">
      <div className="flex items-center justify-between"><div><h4 className="text-sm font-semibold text-ink">Dataset schemas</h4><p className="text-xs text-muted">Uploaded tables are matched by key and validated by column name and type.</p></div><button type="button" onClick={() => update({ ...template, datasets: [...(template.datasets ?? []), { key: `dataset_${(template.datasets?.length ?? 0) + 1}`, label: `Dataset ${(template.datasets?.length ?? 0) + 1}`, required: false, columns: [] }] })} className="focus-ring inline-flex h-8 items-center gap-1 rounded border border-hairline bg-surface px-2 text-xs font-medium"><Plus className="h-3.5 w-3.5" />Dataset</button></div>
      {(template.datasets ?? []).map((dataset, index) => <div key={`${dataset.key}-${index}`} className="rounded-[8px] border border-hairline bg-surface p-3">
        <div className="grid gap-2 md:grid-cols-[0.7fr_1fr_auto_auto]">
          <input aria-label="Dataset key" value={dataset.key} onChange={(event) => updateDataset(index, { ...dataset, key: stableResultKey(event.target.value) })} className={inputClass} placeholder="dataset_key" />
          <input aria-label="Dataset label" value={dataset.label} onChange={(event) => updateDataset(index, { ...dataset, label: event.target.value })} className={inputClass} placeholder="Dataset label" />
          <label className="mt-1 flex items-center gap-2 text-xs font-medium text-muted"><input type="checkbox" checked={dataset.required ?? false} onChange={(event) => updateDataset(index, { ...dataset, required: event.target.checked })} />Required</label>
          <button type="button" aria-label="Remove Dataset schema" onClick={() => update({ ...template, datasets: (template.datasets ?? []).filter((_, itemIndex) => itemIndex !== index) })} className="focus-ring mt-1 rounded p-2 text-error hover:bg-error-surface"><Trash2 className="h-4 w-4" /></button>
        </div>
        <textarea value={columnRows(dataset)} onChange={(event) => updateDataset(index, { ...dataset, columns: columnsFromTsv(event.target.value) })} className={textareaClass} placeholder="key[TAB]Label[TAB]type[TAB]unit[TAB]required[TAB]role" />
        <p className="mt-1 text-xs text-muted">Columns: key · label · type · unit · required · semantic role</p>
      </div>)}
      {!template.datasets?.length ? <p className="rounded border border-dashed border-hairline px-3 py-4 text-center text-xs text-muted">No Dataset schema. Small scalar or media-only Results do not require one.</p> : null}
    </section>

    <label className="block"><span className="text-xs font-semibold text-muted">Required artifacts · TSV</span><textarea value={(template.artifacts ?? []).map((item) => [item.key, item.label, item.kind, item.required ? "Yes" : "No"].join("\t")).join("\n")} onChange={(event) => update({ ...template, artifacts: event.target.value.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => { const [key, label, kind, required] = line.split("\t"); return { key: stableResultKey(key || label || `artifact_${index + 1}`), label: label?.trim() || key?.trim() || `Artifact ${index + 1}`, kind: kind === "image" || kind === "video" ? kind : "file", required: parseBoolean(required ?? "") }; }) })} className={textareaClass} placeholder="key[TAB]Label[TAB]file|image|video[TAB]required" /></label>

    <label className="block"><span className="text-xs font-semibold text-muted">Charts · TSV</span><textarea value={(template.view?.charts ?? []).map((item) => [item.key, item.label, item.type, item.datasetKey, item.xField, item.yField, item.seriesField ?? ""].join("\t")).join("\n")} onChange={(event) => update({ ...template, view: { ...template.view, charts: event.target.value.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => { const [key, label, rawType, datasetKey, xField, yField, seriesField] = line.split("\t"); return { key: stableResultKey(key || label || `chart_${index + 1}`), label: label?.trim() || key?.trim() || `Chart ${index + 1}`, type: rawType === "line" || rawType === "scatter" ? rawType : "bar", datasetKey: stableResultKey(datasetKey || "dataset"), xField: stableResultKey(xField || "x"), yField: stableResultKey(yField || "y"), seriesField: seriesField?.trim() ? stableResultKey(seriesField) : undefined }; }) } })} className={textareaClass} placeholder="key[TAB]Label[TAB]bar|line|scatter[TAB]datasetKey[TAB]xField[TAB]yField[TAB]seriesField" /></label>
  </div>;
}
