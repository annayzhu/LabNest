"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { ProtocolRichTextEditor } from "@/components/ProtocolRichTextEditor";
import { richTextFromPlainText, type ProtocolContentBlock } from "@/lib/protocol-document";
import {
  checkResultTemplate,
  createDefaultResultTemplate,
  normalizeResultTemplate,
  resultDatasetColumnTypes,
  resultFieldDataTypes,
  resultTemplateFieldsToRows,
  stableResultKey,
  uniqueResultKey,
  withInferredResultTemplateMetadata,
} from "@/lib/result-templates";
import type {
  ResultDatasetColumn,
  ResultTemplate,
  ResultTemplateArtifact,
  ResultTemplateDataset,
  ResultTemplateField,
} from "@/lib/types";

type TableBlock = Extract<ProtocolContentBlock, { type: "table" }>;
type EvidenceKind = "number" | "text" | "select" | "boolean" | "date" | "dataset" | "file" | "image";

const inputClass = "focus-ring mt-[var(--ln-result-template-label-control-gap)] h-[var(--ln-result-template-input-height)] w-full rounded-[var(--ln-result-template-control-radius)] border border-hairline bg-warm px-[var(--ln-result-template-input-padding-x)] text-[length:var(--ln-result-template-font-size)] leading-none text-ink";
const compactSelectClass = "focus-ring h-[var(--ln-result-template-input-height)] rounded-[var(--ln-result-template-control-radius)] border border-hairline bg-warm px-[var(--ln-result-template-input-padding-x)] text-[length:var(--ln-result-template-font-size)] leading-none text-ink";
const panelClass = "rounded-[var(--ln-result-template-panel-radius)] border border-hairline bg-warm/50 p-[var(--ln-result-template-panel-padding)]";
const cardClass = "rounded-[var(--ln-result-template-card-radius)] border border-hairline bg-surface p-[var(--ln-result-template-card-padding)]";
const cardHeaderClass = "mb-[var(--ln-result-template-card-header-gap)] flex items-center justify-between gap-[var(--ln-result-template-card-header-x-gap)]";
const fieldGridClass = "grid items-end gap-[var(--ln-result-template-field-grid-gap)] md:grid-cols-[minmax(0,1.5fr)_minmax(120px,0.7fr)_minmax(90px,0.45fr)_auto]";
const requiredLabelClass = "mb-[var(--ln-result-template-checkbox-offset)] flex items-center gap-2 whitespace-nowrap text-xs font-medium text-muted";
const iconButtonClass = "focus-ring rounded p-[var(--ln-result-template-icon-button-padding)] text-muted hover:bg-stone disabled:opacity-30";
const dangerIconButtonClass = "focus-ring rounded p-[var(--ln-result-template-icon-button-padding)] text-error hover:bg-error-surface";
const advancedDetailsClass = "mt-[var(--ln-result-template-advanced-margin-top)] border-t border-hairline pt-[var(--ln-result-template-advanced-padding-top)]";
const advancedGridClass = "mt-[var(--ln-result-template-advanced-grid-margin-top)] grid gap-[var(--ln-result-template-field-grid-gap)] md:grid-cols-2";
const datasetSchemaGridClass = "grid-cols-[var(--ln-template-dataset-grid)]";
const datasetSchemaCellClass = "focus-ring h-[var(--ln-template-dataset-input-height)] rounded-[6px] border border-hairline bg-warm px-[var(--ln-template-dataset-input-padding-x)] text-[length:var(--ln-template-dataset-font-size)] leading-none text-ink";
const datasetSchemaCheckboxClass = "h-[var(--ln-template-dataset-checkbox-size)] w-[var(--ln-template-dataset-checkbox-size)]";
const evidenceOptions: Array<{ value: EvidenceKind; label: string }> = [
  { value: "number", label: "Numeric value" },
  { value: "text", label: "Text" },
  { value: "select", label: "Options" },
  { value: "boolean", label: "Yes / No" },
  { value: "date", label: "Date" },
  { value: "dataset", label: "Data table" },
  { value: "file", label: "File" },
  { value: "image", label: "Image" },
];

function DraftTextInput({
  value,
  onValueChange,
  className,
  placeholder,
  ariaLabel,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  className: string;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  return <input
    aria-label={ariaLabel}
    value={editing ? draft : value}
    onFocus={() => { setDraft(value); setEditing(true); }}
    onChange={(event) => { setDraft(event.target.value); onValueChange(event.target.value); }}
    onBlur={() => setEditing(false)}
    className={className}
    placeholder={placeholder}
    disabled={disabled}
  />;
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function defaultFieldRole(dataType: ResultTemplateField["dataType"]) {
  void dataType;
  return "annotation" as const;
}

function createResultField(index: number, dataType: ResultTemplateField["dataType"], label: string): ResultTemplateField {
  const fieldNumber = index + 1;
  return {
    key: `field_${fieldNumber}`,
    label,
    name: label,
    dataType,
    type: dataType,
    required: false,
    semanticRole: defaultFieldRole(dataType),
  };
}

function defaultColumn(index: number, label = `Column ${index + 1}`): ResultDatasetColumn {
  const number = index + 1;
  return { key: `column_${number}`, label, dataType: "text", required: false, semanticRole: "annotation" };
}

function isGroupingColumn(column: ResultDatasetColumn) {
  return column.semanticRole === "group" || column.semanticRole === "label" || column.semanticRole === "identifier";
}

function isFeaturedField(field: ResultTemplateField) {
  return field.semanticRole === "measurement" || field.semanticRole === "qc";
}

function evidenceTypeLabel(field: ResultTemplateField) {
  const dataType = field.dataType ?? field.type ?? "text";
  return ({ number: "Numeric value", text: "Text", select: "Options", boolean: "Yes / No", date: "Date", datetime: "Date and time", "attachment[]": "Legacy file references" } as Record<string, string>)[dataType] ?? dataType;
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function ResultTemplateConfigEditor({ block, onChange }: { block: TableBlock; onChange: (block: TableBlock) => void }) {
  const { t } = useI18n();
  const template = normalizeResultTemplate(block.resultTemplate ?? createDefaultResultTemplate(block.caption || "measurement"));
  const check = checkResultTemplate(template);
  const [newEvidenceType, setNewEvidenceType] = useState<EvidenceKind>("number");

  function update(next: ResultTemplate, inferMetadata = false) {
    const normalized = normalizeResultTemplate(inferMetadata ? withInferredResultTemplateMetadata(next) : next);
    onChange({ ...block, caption: normalized.result_type, rows: resultTemplateFieldsToRows(normalized), resultTemplate: normalized });
  }

  function updateTitle(title: string) {
    const previousTitle = template.title ?? template.result_type;
    const previousAutomaticKey = stableResultKey(previousTitle, "result_template");
    const templateKey = !template.templateKey || template.templateKey === previousAutomaticKey
      ? stableResultKey(title, "result_template")
      : template.templateKey;
    update({ ...template, result_type: title, title, templateKey }, true);
  }

  function updateField(index: number, next: ResultTemplateField, inferMetadata = false) {
    update({ ...template, fields: template.fields.map((field, itemIndex) => itemIndex === index ? next : field) }, inferMetadata);
  }

  function updateFieldLabel(index: number, label: string) {
    const field = template.fields[index];
    if (!field) return;
    const previousLabel = field.label ?? field.name ?? "";
    const fallbackKey = `field_${index + 1}`;
    const previousAutomaticKey = stableResultKey(previousLabel, fallbackKey);
    const otherKeys = template.fields.flatMap((item, itemIndex) => itemIndex === index || !item.key ? [] : [item.key]);
    const nextKey = !field.key || field.key === previousAutomaticKey || field.key === fallbackKey ? uniqueResultKey(label, otherKeys, fallbackKey) : field.key;
    updateField(index, { ...field, key: nextKey, label, name: label });
  }

  function updateDataset(index: number, next: ResultTemplateDataset, inferMetadata = false) {
    update({ ...template, datasets: (template.datasets ?? []).map((dataset, itemIndex) => itemIndex === index ? next : dataset) }, inferMetadata);
  }

  function updateDatasetLabel(index: number, label: string) {
    const dataset = template.datasets?.[index];
    if (!dataset) return;
    const fallbackKey = `dataset_${index + 1}`;
    const previousAutomaticKey = stableResultKey(dataset.label, fallbackKey);
    const otherKeys = (template.datasets ?? []).flatMap((item, itemIndex) => itemIndex === index ? [] : [item.key]);
    const key = dataset.key === previousAutomaticKey || dataset.key === fallbackKey ? uniqueResultKey(label, otherKeys, fallbackKey) : dataset.key;
    updateDataset(index, { ...dataset, key, label });
  }

  function updateColumn(datasetIndex: number, columnIndex: number, next: ResultDatasetColumn, inferMetadata = false) {
    const dataset = template.datasets?.[datasetIndex];
    if (!dataset) return;
    updateDataset(datasetIndex, { ...dataset, columns: dataset.columns.map((column, itemIndex) => itemIndex === columnIndex ? next : column) }, inferMetadata);
  }

  function updateColumnLabel(datasetIndex: number, columnIndex: number, label: string) {
    const dataset = template.datasets?.[datasetIndex];
    const column = dataset?.columns[columnIndex];
    if (!dataset || !column) return;
    const fallbackKey = `column_${columnIndex + 1}`;
    const previousAutomaticKey = stableResultKey(column.label, fallbackKey);
    const otherKeys = dataset.columns.flatMap((item, itemIndex) => itemIndex === columnIndex ? [] : [item.key]);
    const key = column.key === previousAutomaticKey || column.key === fallbackKey ? uniqueResultKey(label, otherKeys, fallbackKey) : column.key;
    updateColumn(datasetIndex, columnIndex, { ...column, key, label });
  }

  function setGroupingColumn(datasetIndex: number, columnIndex: number, checked: boolean) {
    const dataset = template.datasets?.[datasetIndex];
    if (!dataset) return;
    const columns = dataset.columns.map((column, itemIndex) => {
      if (itemIndex === columnIndex) return { ...column, semanticRole: checked ? "group" as const : "annotation" as const };
      if (checked && isGroupingColumn(column)) return { ...column, semanticRole: "annotation" as const };
      return column;
    });
    updateDataset(datasetIndex, { ...dataset, columns });
  }

  function setPrimaryNumericColumn(datasetIndex: number, columnIndex: number, checked: boolean) {
    const dataset = template.datasets?.[datasetIndex];
    if (!dataset) return;
    const columns = dataset.columns.map((column, itemIndex) => {
      if (itemIndex === columnIndex) return { ...column, semanticRole: checked ? "measurement" as const : "annotation" as const };
      if (checked && column.semanticRole === "measurement") return { ...column, semanticRole: "annotation" as const };
      return column;
    });
    updateDataset(datasetIndex, { ...dataset, columns });
  }

  function updateArtifact(index: number, next: ResultTemplateArtifact, inferMetadata = false) {
    update({ ...template, artifacts: (template.artifacts ?? []).map((artifact, itemIndex) => itemIndex === index ? next : artifact) }, inferMetadata);
  }

  function updateArtifactLabel(index: number, label: string) {
    const artifact = template.artifacts?.[index];
    if (!artifact) return;
    const fallbackKey = `artifact_${index + 1}`;
    const previousAutomaticKey = stableResultKey(artifact.label, fallbackKey);
    const otherKeys = (template.artifacts ?? []).flatMap((item, itemIndex) => itemIndex === index ? [] : [item.key]);
    const key = artifact.key === previousAutomaticKey || artifact.key === fallbackKey ? uniqueResultKey(label, otherKeys, fallbackKey) : artifact.key;
    updateArtifact(index, { ...artifact, key, label });
  }

  function addEvidence() {
    if (["number", "text", "select", "boolean", "date"].includes(newEvidenceType)) {
      const dataType = newEvidenceType as ResultTemplateField["dataType"];
      const optionLabel = evidenceOptions.find((option) => option.value === newEvidenceType)?.label ?? "Field";
      const fieldNumber = template.fields.length + 1;
      const field = createResultField(template.fields.length, dataType, `${t(optionLabel)} ${fieldNumber}`);
      field.key = uniqueResultKey(`field_${fieldNumber}`, template.fields.flatMap((item) => item.key ? [item.key] : []), `field_${fieldNumber}`);
      update({ ...template, fields: [...template.fields, field] }, true);
      return;
    }
    if (newEvidenceType === "dataset") {
      const index = template.datasets?.length ?? 0;
      const label = `${t("Data table")} ${index + 1}`;
      const key = uniqueResultKey(`dataset_${index + 1}`, (template.datasets ?? []).map((item) => item.key), `dataset_${index + 1}`);
      update({ ...template, datasets: [...(template.datasets ?? []), { key, label, required: false, columns: [defaultColumn(0, `${t("Column")} 1`)] }] }, true);
      return;
    }
    const index = template.artifacts?.length ?? 0;
    const kind = newEvidenceType === "image" ? "image" : "file";
    const label = `${t(kind === "image" ? "Image" : "File")} ${index + 1}`;
    const key = uniqueResultKey(`artifact_${index + 1}`, (template.artifacts ?? []).map((item) => item.key), `artifact_${index + 1}`);
    update({ ...template, artifacts: [...(template.artifacts ?? []), { key, label, kind, required: false }] }, true);
  }

  const multipleRecords = ["per_sample", "per_timepoint", "repeatable"].includes(template.cardinality ?? "per_run");
  const totalItems = template.fields.length + (template.datasets?.length ?? 0) + (template.artifacts?.length ?? 0);
  const instructionNodes = template.instructions?.length ? template.instructions : richTextFromPlainText("");

  return <div className="mt-[var(--ln-result-template-root-margin-top)] space-y-[var(--ln-result-template-section-gap)]">
    <div className="rounded-[var(--ln-result-template-card-radius)] border border-sage/40 bg-sage-surface/50 p-[var(--ln-result-template-panel-padding)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-moss">Result Template</p><p className="mt-1 text-xs leading-5 text-muted">Define only what this experiment should leave behind. Technical metadata is generated automatically.</p></div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${check.status === "complete" ? "bg-success-surface text-success" : check.status === "warning" ? "bg-warning-surface text-warning" : "bg-error-surface text-error"}`}>{check.status}</span>
      </div>
      {check.errors.length || check.warnings.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-graphite">{[...check.errors, ...check.warnings].map((message) => <li key={message}>{message}</li>)}</ul> : null}
    </div>

    <div className={`grid gap-[var(--ln-result-template-field-grid-gap)] md:grid-cols-2 ${panelClass}`}>
      <label><span className="text-xs font-semibold text-muted">Result name</span><DraftTextInput value={template.result_type === "result_type" ? "" : template.result_type} onValueChange={updateTitle} className={inputClass} placeholder="e.g. MLPA CNV result" /></label>
      <label><span className="text-xs font-semibold text-muted">One-line description · optional</span><DraftTextInput value={template.description ?? ""} onValueChange={(value) => update({ ...template, description: value })} className={inputClass} placeholder="What evidence should be recorded?" /></label>
      <fieldset className="md:col-span-2">
        <legend className="text-xs font-semibold text-muted">How many separate Result documents?</legend>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[8px] border border-hairline bg-surface px-3 py-2.5 text-xs text-graphite">
          <label className="flex items-center gap-2"><input type="radio" name={`cardinality-${block.id}`} checked={!multipleRecords} onChange={() => update({ ...template, cardinality: "per_run" })} />One Result per experiment</label>
          <label className="flex items-center gap-2"><input type="radio" name={`cardinality-${block.id}`} checked={multipleRecords} onChange={() => update({ ...template, cardinality: "per_sample" })} />Multiple separate Results in one experiment</label>
          {multipleRecords ? <label className="flex items-center gap-2"><span>Distinguish by</span><select value={template.cardinality} onChange={(event) => update({ ...template, cardinality: event.target.value as ResultTemplate["cardinality"] })} className={compactSelectClass}><option value="per_sample">Sample</option><option value="per_timepoint">Timepoint</option><option value="repeatable">Repeat / other ID</option></select></label> : null}
        </div>
        <p className="mt-1.5 text-xs leading-5 text-muted">A data table can contain many sample rows inside one Result. Choose multiple Results only when every sample or timepoint needs its own separate result document.</p>
      </fieldset>
    </div>

    <section className={panelClass}>
      <div className="mb-[var(--ln-result-template-card-header-gap)]">
        <h4 className="text-sm font-semibold text-ink">填写说明 / Instructions</h4>
        <p className="mt-1 text-xs leading-5 text-muted">This guidance follows the frozen template into the Experiment and final Result record.</p>
      </div>
      <ProtocolRichTextEditor nodes={instructionNodes} onChange={(instructions) => update({ ...template, instructions })} showToolbar={false} />
    </section>

    <section className={`space-y-[var(--ln-result-template-section-item-gap)] ${panelClass}`}>
      <div className="flex flex-wrap items-end justify-between gap-[var(--ln-result-template-field-grid-gap)]">
        <div><h4 className="text-sm font-semibold text-ink">What should be recorded?</h4><p className="mt-1 text-xs leading-5 text-muted">Fields, tables, files and images belong to one result checklist.</p></div>
        <div className="flex items-center gap-2"><label><span className="sr-only">Evidence type</span><select value={newEvidenceType} onChange={(event) => setNewEvidenceType(event.target.value as EvidenceKind)} className={compactSelectClass}>{evidenceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button type="button" onClick={addEvidence} className="focus-ring inline-flex h-[var(--ln-result-template-input-height)] items-center gap-1 rounded-[var(--ln-result-template-control-radius)] border border-hairline bg-surface px-[calc(var(--ln-result-template-input-padding-x)*1.5)] text-[length:var(--ln-result-template-font-size)] font-medium text-ink hover:bg-stone"><Plus className="h-3.5 w-3.5" />Add</button></div>
      </div>

      {template.fields.map((field, index) => {
        const dataType = field.dataType ?? field.type ?? "text";
        const number = index + 1;
        return <article key={`field-${index}`} className={cardClass}>
          <div className={cardHeaderClass}><p className="text-xs font-semibold text-ink"><span className="mr-2 text-muted">{number}.</span>{evidenceTypeLabel(field)}</p><div className="flex items-center gap-1"><button type="button" onClick={() => update({ ...template, fields: moveItem(template.fields, index, -1) })} disabled={index === 0} aria-label="Move item up" className={iconButtonClass}><ChevronUp className="h-4 w-4" /></button><button type="button" onClick={() => update({ ...template, fields: moveItem(template.fields, index, 1) })} disabled={index === template.fields.length - 1} aria-label="Move item down" className={iconButtonClass}><ChevronDown className="h-4 w-4" /></button><button type="button" onClick={() => update({ ...template, fields: template.fields.filter((_, itemIndex) => itemIndex !== index) }, true)} aria-label="Remove item" className={dangerIconButtonClass}><Trash2 className="h-4 w-4" /></button></div></div>
          <div className={fieldGridClass}>
            <label><span className="text-xs font-semibold text-muted">Name</span><DraftTextInput value={field.label ?? field.name ?? ""} onValueChange={(value) => updateFieldLabel(index, value)} className={inputClass} /></label>
            <label><span className="text-xs font-semibold text-muted">Type</span><select value={dataType} onChange={(event) => { const nextType = event.target.value as ResultTemplateField["dataType"]; updateField(index, { ...field, dataType: nextType, type: nextType, semanticRole: defaultFieldRole(nextType), unit: nextType === "number" ? field.unit : undefined, validation: nextType === "number" ? field.validation : undefined, options: nextType === "select" ? field.options : undefined }, true); }} className={inputClass}>{resultFieldDataTypes.map((value) => <option key={value} value={value}>{evidenceTypeLabel({ ...field, dataType: value })}</option>)}</select></label>
            {dataType === "number" ? <label><span className="text-xs font-semibold text-muted">Unit</span><DraftTextInput value={field.unit ?? ""} onValueChange={(value) => updateField(index, { ...field, unit: value || undefined })} className={inputClass} placeholder="ng/µL" /></label> : <span />}
            <label className={requiredLabelClass}><input type="checkbox" checked={field.required ?? false} onChange={(event) => updateField(index, { ...field, required: event.target.checked })} />Required</label>
          </div>
          {dataType === "number" ? <div className="mt-[var(--ln-result-template-advanced-margin-top)] flex flex-wrap items-end gap-[var(--ln-result-template-field-grid-gap)] border-t border-hairline pt-[var(--ln-result-template-advanced-padding-top)]"><label className="w-28"><span className="text-xs font-semibold text-muted">Minimum</span><input type="number" value={field.validation?.min ?? ""} onChange={(event) => updateField(index, { ...field, validation: { ...field.validation, min: parseOptionalNumber(event.target.value) } })} className={inputClass} /></label><label className="w-28"><span className="text-xs font-semibold text-muted">Maximum</span><input type="number" value={field.validation?.max ?? ""} onChange={(event) => updateField(index, { ...field, validation: { ...field.validation, max: parseOptionalNumber(event.target.value) } })} className={inputClass} /></label><label className={requiredLabelClass}><input type="checkbox" checked={isFeaturedField(field)} onChange={(event) => updateField(index, { ...field, semanticRole: event.target.checked ? "measurement" : "annotation" })} />Show as a key metric</label></div> : null}
          {dataType === "select" ? <label className="mt-[var(--ln-result-template-advanced-margin-top)] block border-t border-hairline pt-[var(--ln-result-template-advanced-padding-top)]"><span className="text-xs font-semibold text-muted">Options</span><DraftTextInput value={field.options?.join(" | ") ?? ""} onValueChange={(value) => updateField(index, { ...field, options: value.split(/[|;,；，]/).map((item) => item.trim()).filter(Boolean) })} className={inputClass} placeholder="Passed | Hold | Failed" /></label> : null}
          <details className={advancedDetailsClass}><summary className="focus-ring cursor-pointer select-none text-xs font-medium text-moss">Advanced</summary><div className={advancedGridClass}><label><span className="text-xs font-semibold text-muted">Stable key</span><input value={field.key ?? ""} onChange={(event) => updateField(index, { ...field, key: stableResultKey(event.target.value, `field_${index + 1}`) })} className={inputClass} /></label><label><span className="text-xs font-semibold text-muted">Help text</span><DraftTextInput value={field.description ?? ""} onValueChange={(value) => updateField(index, { ...field, description: value || undefined })} className={inputClass} /></label></div></details>
        </article>;
      })}

      {(template.datasets ?? []).map((dataset, datasetIndex) => {
        const itemNumber = template.fields.length + datasetIndex + 1;
        return <article key={`dataset-${datasetIndex}`} className={cardClass}>
          <div className={cardHeaderClass}>
            <p className="text-xs font-semibold text-ink"><span className="mr-2 text-muted">{itemNumber}.</span>Data table</p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => update({ ...template, datasets: moveItem(template.datasets ?? [], datasetIndex, -1) }, true)} disabled={datasetIndex === 0} aria-label="Move data table up" className={iconButtonClass}><ChevronUp className="h-4 w-4" /></button>
              <button type="button" onClick={() => update({ ...template, datasets: moveItem(template.datasets ?? [], datasetIndex, 1) }, true)} disabled={datasetIndex === (template.datasets?.length ?? 0) - 1} aria-label="Move data table down" className={iconButtonClass}><ChevronDown className="h-4 w-4" /></button>
              <button type="button" aria-label="Remove data table" onClick={() => update({ ...template, datasets: (template.datasets ?? []).filter((_, itemIndex) => itemIndex !== datasetIndex) }, true)} className={dangerIconButtonClass}><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="grid items-end gap-[var(--ln-result-template-field-grid-gap)] md:grid-cols-[minmax(0,1fr)_auto]"><label><span className="text-xs font-semibold text-muted">Table name</span><DraftTextInput value={dataset.label} onValueChange={(value) => updateDatasetLabel(datasetIndex, value)} className={inputClass} /></label><label className={requiredLabelClass}><input type="checkbox" checked={dataset.required ?? false} onChange={(event) => updateDataset(datasetIndex, { ...dataset, required: event.target.checked })} />Required</label></div>
          <div className="mt-[var(--ln-result-template-advanced-margin-top)] overflow-x-auto border-t border-hairline pt-[var(--ln-result-template-advanced-padding-top)]">
            <div className="min-w-[var(--ln-template-dataset-min-width)] space-y-[var(--ln-template-dataset-row-gap)]">
              <div className={`grid ${datasetSchemaGridClass} gap-[var(--ln-template-dataset-row-gap)] px-[var(--ln-template-dataset-row-padding-x)] text-[11px] font-semibold leading-3 text-muted`}><span>Column name</span><span>Type</span><span>Unit</span><span title="Required">Req.</span><span title="Used for grouping">Group</span><span title="Primary numeric value">Primary</span><span>Order</span></div>
              {dataset.columns.map((column, columnIndex) => <div key={`dataset-${datasetIndex}-column-${columnIndex}`} className={`grid ${datasetSchemaGridClass} items-center gap-[var(--ln-template-dataset-row-gap)] rounded-[6px] bg-warm/70 px-[var(--ln-template-dataset-row-padding-x)] py-[var(--ln-template-dataset-row-padding-y)]`}>
                <DraftTextInput ariaLabel="Column name" value={column.label} onValueChange={(value) => updateColumnLabel(datasetIndex, columnIndex, value)} className={datasetSchemaCellClass} />
                <select aria-label="Column type" value={column.dataType} onChange={(event) => { const dataType = event.target.value as ResultDatasetColumn["dataType"]; updateColumn(datasetIndex, columnIndex, { ...column, dataType, unit: dataType === "number" ? column.unit : undefined, semanticRole: "annotation" }, true); }} className={datasetSchemaCellClass}>{resultDatasetColumnTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select>
                <DraftTextInput ariaLabel="Column unit" value={column.unit ?? ""} onValueChange={(value) => updateColumn(datasetIndex, columnIndex, { ...column, unit: value || undefined })} disabled={column.dataType !== "number"} className={`${datasetSchemaCellClass} min-w-0 disabled:bg-stone/50`} />
                <label className="flex justify-center"><input aria-label="Required column" type="checkbox" checked={column.required ?? false} onChange={(event) => updateColumn(datasetIndex, columnIndex, { ...column, required: event.target.checked })} className={datasetSchemaCheckboxClass} /></label>
                <label className="flex justify-center"><input aria-label="Use column for grouping" type="checkbox" checked={isGroupingColumn(column)} onChange={(event) => setGroupingColumn(datasetIndex, columnIndex, event.target.checked)} className={datasetSchemaCheckboxClass} /></label>
                <label className="flex justify-center"><input aria-label="Use as primary numeric value" type="checkbox" disabled={column.dataType !== "number"} checked={column.dataType === "number" && column.semanticRole === "measurement"} onChange={(event) => setPrimaryNumericColumn(datasetIndex, columnIndex, event.target.checked)} className={datasetSchemaCheckboxClass} /></label>
                <div className="flex items-center justify-end gap-0.5">
                  <button type="button" aria-label="Move column up" onClick={() => updateDataset(datasetIndex, { ...dataset, columns: moveItem(dataset.columns, columnIndex, -1) }, true)} disabled={columnIndex === 0} className="focus-ring rounded p-1 text-muted hover:bg-stone disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Move column down" onClick={() => updateDataset(datasetIndex, { ...dataset, columns: moveItem(dataset.columns, columnIndex, 1) }, true)} disabled={columnIndex === dataset.columns.length - 1} className="focus-ring rounded p-1 text-muted hover:bg-stone disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Remove column" onClick={() => updateDataset(datasetIndex, { ...dataset, columns: dataset.columns.filter((_, itemIndex) => itemIndex !== columnIndex) }, true)} className="focus-ring rounded p-1 text-error hover:bg-error-surface"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>)}
              <button type="button" onClick={() => updateDataset(datasetIndex, { ...dataset, columns: [...dataset.columns, defaultColumn(dataset.columns.length, `${t("Column")} ${dataset.columns.length + 1}`)] }, true)} className="focus-ring inline-flex h-7 items-center gap-1 rounded-[6px] border border-hairline bg-surface px-2 text-xs font-medium text-ink hover:bg-stone"><Plus className="h-3.5 w-3.5" />Add column</button>
            </div>
          </div>
          <details className={advancedDetailsClass}><summary className="focus-ring cursor-pointer select-none text-xs font-medium text-moss">Advanced</summary><label className="mt-[var(--ln-result-template-advanced-grid-margin-top)] block max-w-sm"><span className="text-xs font-semibold text-muted">Stable table key</span><input value={dataset.key} onChange={(event) => updateDataset(datasetIndex, { ...dataset, key: stableResultKey(event.target.value, `dataset_${datasetIndex + 1}`) })} className={inputClass} /></label></details>
        </article>;
      })}

      {(template.artifacts ?? []).map((artifact, artifactIndex) => {
        const itemNumber = template.fields.length + (template.datasets?.length ?? 0) + artifactIndex + 1;
        return <article key={`artifact-${artifactIndex}`} className={cardClass}>
          <div className={cardHeaderClass}><p className="text-xs font-semibold text-ink"><span className="mr-2 text-muted">{itemNumber}.</span>{artifact.kind === "image" ? "Image" : artifact.kind === "video" ? "Video" : "File"}</p><button type="button" aria-label="Remove file requirement" onClick={() => update({ ...template, artifacts: (template.artifacts ?? []).filter((_, itemIndex) => itemIndex !== artifactIndex) }, true)} className={dangerIconButtonClass}><Trash2 className="h-4 w-4" /></button></div>
          <div className="grid items-end gap-[var(--ln-result-template-field-grid-gap)] md:grid-cols-[minmax(0,1fr)_140px_auto]"><label><span className="text-xs font-semibold text-muted">Name</span><DraftTextInput value={artifact.label} onValueChange={(value) => updateArtifactLabel(artifactIndex, value)} className={inputClass} /></label><label><span className="text-xs font-semibold text-muted">File type</span><select value={artifact.kind} onChange={(event) => updateArtifact(artifactIndex, { ...artifact, kind: event.target.value as ResultTemplateArtifact["kind"] }, true)} className={inputClass}><option value="file">File</option><option value="image">Image</option><option value="video">Video</option></select></label><label className={requiredLabelClass}><input type="checkbox" checked={artifact.required ?? false} onChange={(event) => updateArtifact(artifactIndex, { ...artifact, required: event.target.checked })} />Required</label></div>
          <details className={advancedDetailsClass}><summary className="focus-ring cursor-pointer select-none text-xs font-medium text-moss">Advanced</summary><label className="mt-[var(--ln-result-template-advanced-grid-margin-top)] block max-w-sm"><span className="text-xs font-semibold text-muted">Stable file key</span><input value={artifact.key} onChange={(event) => updateArtifact(artifactIndex, { ...artifact, key: stableResultKey(event.target.value, `artifact_${artifactIndex + 1}`) })} className={inputClass} /></label></details>
        </article>;
      })}

      {!totalItems ? <p className="rounded border border-dashed border-hairline px-3 py-5 text-center text-xs text-muted">Add at least one value, table, file, or image.</p> : null}
    </section>

    <details className="rounded-[var(--ln-result-template-card-radius)] border border-dashed border-hairline bg-surface/70 p-[var(--ln-result-template-panel-padding)]">
      <summary className="focus-ring cursor-pointer select-none text-xs font-medium text-moss">Advanced template settings</summary>
      <div className={advancedGridClass}><label><span className="text-xs font-semibold text-muted">Stable template key</span><input value={template.templateKey ?? ""} onChange={(event) => update({ ...template, templateKey: stableResultKey(event.target.value, "result_template") })} className={inputClass} /></label><div className="rounded-[var(--ln-result-template-control-radius)] border border-hairline bg-warm/70 p-[var(--ln-result-template-card-padding)] text-xs leading-5 text-muted">Stable keys are used for imports and Result matching. Existing custom keys remain unchanged unless edited here.</div></div>
      {template.view?.charts?.length ? <div className="mt-[var(--ln-result-template-advanced-margin-top)] flex flex-wrap items-center justify-between gap-[var(--ln-result-template-field-grid-gap)] rounded-[var(--ln-result-template-control-radius)] border border-hairline bg-warm/70 p-[var(--ln-result-template-card-padding)]"><p className="text-xs leading-5 text-muted">{template.view.charts.length} legacy custom chart rule(s) are preserved for compatibility.</p><button type="button" onClick={() => update({ ...template, view: { ...template.view, charts: [] } })} className="focus-ring h-[var(--ln-result-template-input-height)] rounded-[var(--ln-result-template-control-radius)] border border-hairline bg-surface px-[calc(var(--ln-result-template-input-padding-x)*1.5)] text-[length:var(--ln-result-template-font-size)] font-medium text-ink hover:bg-stone">Use automatic chart preview</button></div> : null}
    </details>
  </div>;
}
