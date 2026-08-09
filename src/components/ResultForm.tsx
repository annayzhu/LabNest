"use client";

import { useMemo, useState } from "react";
import { ScientificDocumentEditor } from "@/components/ScientificDocumentEditor";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import type { ScientificDocument } from "@/lib/scientific-document";
import {
  fieldDataType,
  fieldSemanticRole,
  normalizeResultTemplate,
  normalizeResultValues,
  resultKindLabel,
  resultTemplateCardinalityLabel,
  RESULT_VIEW_PRESETS,
  stableResultKey,
} from "@/lib/result-templates";
import { recordStatusOptions, resultQualityStatusOptions } from "@/lib/status-options";
import type { ResultTemplateField } from "@/lib/types";

type ExperimentOption = { id: string; runCode: string | null; title: string; researchPlan: { code: string | null; title: string } | null; project: { name: string } | null };
type ResultValidationSnapshot = { errors?: string[]; warnings?: string[] };

export function ResultForm({ action, experiments, initial, lockedExperiment = false }: {
  action: (formData: FormData) => void | Promise<void>;
  experiments: ExperimentOption[];
  lockedExperiment?: boolean;
  initial: {
    id?: string;
    experimentId?: string | null;
    title?: string;
    resultType?: string;
    recordStatus?: string;
    sourceType?: string;
    qualityStatus?: string;
    validationStatus?: string;
    textValue?: string | null;
    numericValue?: number | null;
    unit?: string | null;
    analysisMethod?: string | null;
    notes?: string | null;
    templateKey?: string | null;
    templateInstanceKey?: string | null;
    templateInstanceLabel?: string | null;
    templateSnapshotJson?: unknown;
    valuesJson?: unknown;
    validationJson?: unknown;
    document: ScientificDocument;
  };
}) {
  const experiment = experiments.find((item) => item.id === initial.experimentId);
  const hasTemplate = Boolean(initial.templateKey && initial.templateSnapshotJson && typeof initial.templateSnapshotJson === "object" && Object.keys(initial.templateSnapshotJson as object).length);
  const template = useMemo(() => hasTemplate ? normalizeResultTemplate(initial.templateSnapshotJson) : undefined, [hasTemplate, initial.templateSnapshotJson]);
  const [templateValues, setTemplateValues] = useState<Record<string, unknown>>(() => normalizeResultValues(initial.valuesJson));
  const serializedValues = useMemo(() => JSON.stringify(templateValues), [templateValues]);
  const validation = initial.validationJson && typeof initial.validationJson === "object" ? initial.validationJson as ResultValidationSnapshot : {};
  const preset = template ? RESULT_VIEW_PRESETS[template.view?.preset ?? "generic"] : undefined;

  return <form action={action} className="space-y-5">
    {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
    {lockedExperiment ? <input type="hidden" name="experimentId" value={initial.experimentId ?? ""} /> : null}
    <input type="hidden" name="templateValuesJson" value={serializedValues} />
    {template ? <input type="hidden" name="templateKey" value={template.templateKey ?? ""} /> : null}
    <Card><CardHeader title="Result identity" eyebrow="Evidence from one Experiment" /><CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="md:col-span-2 xl:col-span-4"><span className={formLabelClass}>Experiment</span>{lockedExperiment ? <div className={`${formInputClass} flex items-center bg-stone/50`}>{experiment?.project?.name} · {experiment?.researchPlan?.code ?? experiment?.researchPlan?.title} · {experiment?.runCode ?? experiment?.title}</div> : <select required name="experimentId" defaultValue={initial.experimentId ?? ""} className={formInputClass}><option value="" disabled>Select Experiment</option>{experiments.map((item) => <option key={item.id} value={item.id}>{item.project?.name} · {item.researchPlan?.code ?? item.researchPlan?.title ?? "No plan"} · {item.runCode ?? item.title}</option>)}</select>}</label>
      <label className="md:col-span-2"><span className={formLabelClass}>Title</span><input required name="title" defaultValue={initial.title ?? ""} className={formInputClass} /></label>
      {hasTemplate ? <label><span className={formLabelClass}>Result type · locked by template</span><input readOnly name="resultType" value={initial.resultType ?? template?.result_type ?? "measurement"} className={`${formInputClass} bg-stone/50`} /></label> : <label><span className={formLabelClass}>Result type</span><input required name="resultType" defaultValue={initial.resultType ?? "observation"} placeholder="qPCR, microscopy, cell count…" className={formInputClass} /></label>}
      {hasTemplate ? <label><span className={formLabelClass}>Source · locked</span><input readOnly name="sourceType" value={initial.sourceType ?? "protocol_template"} className={`${formInputClass} bg-stone/50`} /></label> : <label><span className={formLabelClass}>Source</span><select name="sourceType" defaultValue={initial.sourceType ?? "manual"} className={formInputClass}><option value="manual">Manual</option><option value="file_import">File import</option><option value="tool">External tool</option><option value="analysis">Analysis</option></select></label>}
      <StatusRadioGroup label="Record status" name="recordStatus" options={recordStatusOptions} defaultValue={initial.recordStatus ?? "draft"} required className="md:col-span-2" />
      <StatusRadioGroup label="QC status" name="qualityStatus" options={resultQualityStatusOptions} defaultValue={initial.qualityStatus ?? "not_assessed"} required className="md:col-span-2" />
      <label className="md:col-span-2"><span className={formLabelClass}>Analysis method / software</span><input name="analysisMethod" defaultValue={initial.analysisMethod ?? ""} placeholder="Method, version, parameters or tool" className={formInputClass} /></label>
      <label><span className={formLabelClass}>Key numeric summary</span><input name="numericValue" type="number" step="any" defaultValue={initial.numericValue ?? ""} className={formInputClass} /></label>
      <label><span className={formLabelClass}>Summary unit</span><input name="unit" defaultValue={initial.unit ?? ""} className={formInputClass} /></label>
      <label className="md:col-span-2"><span className={formLabelClass}>Short text summary</span><textarea name="textValue" defaultValue={initial.textValue ?? ""} className={formTextareaClass} /></label>
      <label className="md:col-span-2"><span className={formLabelClass}>Notes</span><textarea name="notes" defaultValue={initial.notes ?? ""} className={formTextareaClass} /></label>
    </CardBody></Card>

    {template ? <Card><CardHeader title={template.title ?? template.result_type} eyebrow="Protocol Result Template · structured capture" action={<span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${initial.validationStatus === "valid" ? "bg-success-surface text-success" : initial.validationStatus === "warning" ? "bg-warning-surface text-warning" : "bg-stone text-muted"}`}>{initial.validationStatus?.replaceAll("_", " ") ?? "incomplete"}</span>} /><CardBody className="space-y-5">
      <div className="grid gap-3 rounded-[9px] border border-hairline bg-warm/70 p-3 sm:grid-cols-2 xl:grid-cols-4">
        <TemplateFact label="Template key" value={template.templateKey ?? "—"} mono />
        <TemplateFact label="Result kind" value={resultKindLabel(template.resultKind)} />
        <TemplateFact label="Cardinality" value={resultTemplateCardinalityLabel(template.cardinality)} />
        <TemplateFact label="View preset" value={preset?.label ?? "Generic evidence"} />
      </div>
      {template.description ? <p className="text-sm leading-6 text-graphite">{template.description}</p> : null}
      {["per_sample", "per_timepoint", "repeatable"].includes(template.cardinality ?? "per_run") ? <div className="grid gap-4 rounded-[9px] border border-hairline bg-warm/70 p-3 md:grid-cols-2"><label><span className={formLabelClass}>{template.cardinality === "per_sample" ? "Sample" : template.cardinality === "per_timepoint" ? "Timepoint" : "Repeat"} instance key · required</span><input required name="templateInstanceKey" defaultValue={initial.templateInstanceKey ?? ""} className={formInputClass} placeholder={template.cardinality === "per_sample" ? "SAMPLE-001" : template.cardinality === "per_timepoint" ? "24h" : "replicate-1"} /></label><label><span className={formLabelClass}>Instance label</span><input name="templateInstanceLabel" defaultValue={initial.templateInstanceLabel ?? ""} className={formInputClass} placeholder="Human-readable label" /></label></div> : <><input type="hidden" name="templateInstanceKey" value={initial.templateInstanceKey ?? ""} /><input type="hidden" name="templateInstanceLabel" value={initial.templateInstanceLabel ?? ""} /></>}
      {validation.errors?.length || validation.warnings?.length ? <div className="rounded-[9px] border border-warning/40 bg-warning-surface p-3"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-warning">Current validation</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-graphite">{[...(validation.errors ?? []), ...(validation.warnings ?? [])].map((message) => <li key={message}>{message}</li>)}</ul></div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {template.fields.map((field, index) => <TemplateFieldInput key={field.key ?? index} field={field} value={templateValues[field.key ?? stableResultKey(field.name ?? field.label ?? `field_${index + 1}`)]} onChange={(value) => { const key = field.key ?? stableResultKey(field.name ?? field.label ?? `field_${index + 1}`); setTemplateValues((current) => ({ ...current, [key]: value })); }} />)}
      </div>
      {!template.fields.length ? <p className="rounded-[8px] border border-dashed border-hairline px-3 py-4 text-center text-sm text-muted">This template has no scalar fields. Register the expected Datasets and artifacts after saving.</p> : null}
      {(template.datasets?.length || template.artifacts?.length) ? <div className="grid gap-3 md:grid-cols-2"><ExpectedList title="Expected Datasets" items={(template.datasets ?? []).map((item) => `${item.label}${item.required ? " · required" : ""} · ${item.columns.length} columns`)} /><ExpectedList title="Expected artifacts" items={(template.artifacts ?? []).map((item) => `${item.label}${item.required ? " · required" : ""} · ${item.kind}`)} /></div> : null}
    </CardBody></Card> : null}

    <ScientificDocumentEditor initialDocument={initial.document} />
    <div className="sticky bottom-4 z-20 flex justify-end"><button className="focus-ring h-11 rounded-[8px] border border-moss bg-moss px-5 text-sm font-medium text-warm shadow-soft">Save Result</button></div>
  </form>;
}

function TemplateFieldInput({ field, value, onChange }: { field: ResultTemplateField; value: unknown; onChange: (value: unknown) => void }) {
  const key = field.key ?? stableResultKey(field.name ?? field.label ?? "field");
  const label = field.label ?? field.name ?? key;
  const type = fieldDataType(field);
  const role = fieldSemanticRole(field);
  const help = [role, field.unit, field.description].filter(Boolean).join(" · ");
  const common = { id: `template-field-${key}`, required: field.required ?? false, className: formInputClass };
  return <label className={type === "attachment[]" ? "md:col-span-2" : ""}><span className={formLabelClass}>{label}{field.required ? " · required" : ""}</span>
    {type === "select" ? <select {...common} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}><option value="">Select…</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select> : null}
    {type === "number" ? <input {...common} type="number" step="any" min={field.validation?.min} max={field.validation?.max} value={typeof value === "number" ? value : ""} onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))} /> : null}
    {type === "boolean" ? <select {...common} value={value === true ? "true" : value === false ? "false" : ""} onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value === "true")}><option value="">Select…</option><option value="true">Yes</option><option value="false">No</option></select> : null}
    {type === "date" || type === "datetime" ? <input {...common} type={type === "date" ? "date" : "datetime-local"} value={String(value ?? "")} onChange={(event) => onChange(event.target.value || undefined)} /> : null}
    {type === "text" ? <input {...common} value={String(value ?? "")} onChange={(event) => onChange(event.target.value || undefined)} /> : null}
    {type === "attachment[]" ? <textarea value={Array.isArray(value) ? value.join("\n") : String(value ?? "")} onChange={(event) => onChange(event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))} className={formTextareaClass} placeholder="One existing attachment reference per line; new files can be assigned to artifact slots after saving." /> : null}
    {help ? <span className="mt-1 block text-xs text-muted">{help}</span> : null}
  </label>;
}

function TemplateFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p><p className={`mt-1 text-sm font-medium text-ink ${mono ? "font-mono" : ""}`}>{value}</p></div>;
}

function ExpectedList({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-[8px] border border-hairline p-3"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{title}</p>{items.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-graphite">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-muted">None defined.</p>}</div>;
}
