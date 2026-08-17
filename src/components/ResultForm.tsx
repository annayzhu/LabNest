"use client";

import { useActionState, useMemo, useState } from "react";
import { ScientificDocumentEditor } from "@/components/ScientificDocumentEditor";
import { ProtocolRichTextContent } from "@/components/ProtocolDocumentView";
import { ResultDatasetTableEditor } from "@/components/ResultDatasetTable";
import { ResultTypePicker } from "@/components/ResultTypePicker";
import type { ResultTypeDefinitionItem } from "@/app/results/result-type-actions";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import type { ScientificDocument } from "@/lib/scientific-document";
import { richTextPlainText } from "@/lib/protocol-document";
import type { FormAction, FormActionState } from "@/lib/form-actions";
import {
  fieldDataType,
  fieldSemanticRole,
  normalizeResultTemplate,
  normalizeResultValues,
  resultDatasetValuesFromResultValues,
  resultTemplateCardinalityLabel,
  stableResultKey,
  withResultDatasetValues,
} from "@/lib/result-templates";
import { recordStatusOptions, resultQualityStatusOptions } from "@/lib/status-options";
import type { ResultTemplate, ResultTemplateField } from "@/lib/types";

type ExperimentOption = { id: string; runCode: string | null; title: string; researchPlan: { code: string | null; title: string } | null; project: { name: string } | null };
type ResultValidationSnapshot = { errors?: string[]; warnings?: string[] };
const initialState: FormActionState = {};

export function ResultForm({ action, experiments, resultTypes, initial, lockedExperiment = false }: {
  action: FormAction;
  experiments: ExperimentOption[];
  resultTypes: ResultTypeDefinitionItem[];
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
    templateProtocolVersionId?: string | null;
    templateInstanceKey?: string | null;
    templateInstanceLabel?: string | null;
    templateSnapshotJson?: unknown;
    valuesJson?: unknown;
    validationJson?: unknown;
    document: ScientificDocument;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [experimentId, setExperimentId] = useState(initial.experimentId ?? "");
  const [title, setTitle] = useState(initial.title ?? "");
  const [resultType, setResultType] = useState(initial.resultType ?? resultTypes[0]?.label ?? "");
  const [sourceType, setSourceType] = useState(initial.sourceType ?? "manual");
  const [recordStatus, setRecordStatus] = useState(initial.recordStatus ?? "draft");
  const [qualityStatus, setQualityStatus] = useState(initial.qualityStatus ?? "not_assessed");
  const experiment = experiments.find((item) => item.id === experimentId);
  const hasTemplate = Boolean(initial.templateKey && initial.templateSnapshotJson && typeof initial.templateSnapshotJson === "object" && Object.keys(initial.templateSnapshotJson as object).length);
  const template = useMemo(() => hasTemplate ? normalizeResultTemplate(initial.templateSnapshotJson) : undefined, [hasTemplate, initial.templateSnapshotJson]);
  const [templateValues, setTemplateValues] = useState<Record<string, unknown>>(() => normalizeResultValues(initial.valuesJson));
  const [datasetValues, setDatasetValues] = useState(() => resultDatasetValuesFromResultValues(initial.valuesJson));
  const serializedValues = useMemo(() => JSON.stringify(withResultDatasetValues(templateValues, datasetValues)), [datasetValues, templateValues]);
  const validation = initial.validationJson && typeof initial.validationJson === "object" ? initial.validationJson as ResultValidationSnapshot : {};
  const hiddenSectionKeys = initial.document.sections.filter((section) => ["summary", "data_media"].includes(section.key) && !section.blocks.length).map((section) => section.key);

  return <form action={formAction} className="space-y-5">
    {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
    {lockedExperiment ? <input type="hidden" name="experimentId" value={initial.experimentId ?? ""} /> : null}
    <input type="hidden" name="templateValuesJson" value={serializedValues} />
    {template ? <input type="hidden" name="templateKey" value={template.templateKey ?? ""} /> : null}
    {template && initial.templateProtocolVersionId ? <input type="hidden" name="templateProtocolVersionId" value={initial.templateProtocolVersionId} /> : null}
    <div className="document-editor-layout">
      <div className="document-editor-main"><ScientificDocumentEditor initialDocument={initial.document} documentType="Result" title={title} titlePlaceholder="Untitled Result" headerFacts={[
        { label: "Experiment", value: experiment ? `${experiment.runCode ?? experiment.title} · ${experiment.project?.name ?? "No project"}` : "Not selected" },
        { label: "Result type", value: resultType },
        { label: "Source", value: sourceType.replaceAll("_", " ") },
        { label: "Record", value: recordStatus.replaceAll("_", " ") },
        { label: "QC", value: qualityStatus.replaceAll("_", " ") },
      ]} hiddenSectionKeys={hiddenSectionKeys} allowedBlockTypes={["heading", "text", "checklist", "callout"]} leadingContent={<ResultCaptureEditor
        template={template}
        templateValues={templateValues}
        onTemplateValuesChange={setTemplateValues}
        datasetValues={datasetValues}
        onDatasetValuesChange={setDatasetValues}
        validation={validation}
        validationStatus={initial.validationStatus}
        resultId={initial.id}
        templateInstanceKey={initial.templateInstanceKey}
        templateInstanceLabel={initial.templateInstanceLabel}
        textValue={initial.textValue}
        numericValue={initial.numericValue}
        unit={initial.unit}
        notes={initial.notes}
      />} /></div>
      <aside className="document-editor-sidebar" aria-label="Result properties">
        <Card><CardHeader title="结果信息" eyebrow="Result properties" /><CardBody className="grid min-w-0 gap-4">
          <label className="min-w-0"><span className={formLabelClass}>实验</span>{lockedExperiment ? <div className={`${formInputClass} flex h-auto min-h-10 items-center break-words bg-stone/50 py-2`}>{experiment?.project?.name} · {experiment?.researchPlan?.code ?? experiment?.researchPlan?.title} · {experiment?.runCode ?? experiment?.title}</div> : <select required name="experimentId" value={experimentId} onChange={(event) => setExperimentId(event.target.value)} className={formInputClass}><option value="" disabled>Select Experiment</option>{experiments.map((item) => <option key={item.id} value={item.id}>{item.project?.name} · {item.researchPlan?.code ?? item.researchPlan?.title ?? "No plan"} · {item.runCode ?? item.title}</option>)}</select>}</label>
          <label className="min-w-0"><span className={formLabelClass}>标题</span><input required name="title" value={title} onChange={(event) => setTitle(event.target.value)} className={formInputClass} /></label>
          {hasTemplate ? <label className="min-w-0"><span className={formLabelClass}>结果类型 · 由模板锁定</span><input readOnly name="resultType" value={resultType || template?.result_type || "measurement"} className={`${formInputClass} bg-stone/50`} /></label> : <ResultTypePicker initialTypes={resultTypes} value={resultType} onChange={setResultType} />}
          {hasTemplate ? <label className="min-w-0"><span className={formLabelClass}>来源 · 已锁定</span><input readOnly name="sourceType" value={sourceType || "protocol_template"} className={`${formInputClass} bg-stone/50`} /></label> : <label className="min-w-0"><span className={formLabelClass}>来源</span><select name="sourceType" value={sourceType} onChange={(event) => setSourceType(event.target.value)} className={formInputClass}><option value="manual">Manual</option><option value="file_import">File import</option><option value="tool">External tool</option><option value="analysis">Analysis</option></select></label>}
          <StatusRadioGroup label="记录状态" name="recordStatus" options={recordStatusOptions} value={recordStatus} onValueChange={setRecordStatus} required optionsClassName="grid grid-cols-2 gap-2 [&>label]:min-w-0 [&>label]:px-2 [&>label>span]:min-w-0 [&>label>span]:break-words" />
          <StatusRadioGroup label="质控状态" name="qualityStatus" options={resultQualityStatusOptions} value={qualityStatus} onValueChange={setQualityStatus} required optionsClassName="grid grid-cols-2 gap-2 [&>label]:min-w-0 [&>label]:px-2 [&>label>span]:min-w-0 [&>label>span]:break-words" />
          <label className="min-w-0"><span className={formLabelClass}>分析方法 / 软件</span><input name="analysisMethod" defaultValue={initial.analysisMethod ?? ""} placeholder="方法、版本、参数或工具" className={formInputClass} /></label>
        </CardBody></Card>
      </aside>
    </div>
    <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-end gap-3">
      {state.error ? <p role="alert" className="max-w-xl rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error shadow-soft">{state.error}</p> : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending} className="shadow-soft">{pending ? "Saving…" : "Save Result"}</Button>
    </div>
  </form>;
}

function ResultCaptureEditor({
  template,
  templateValues,
  onTemplateValuesChange,
  datasetValues,
  onDatasetValuesChange,
  validation,
  validationStatus,
  resultId,
  templateInstanceKey,
  templateInstanceLabel,
  textValue,
  numericValue,
  unit,
  notes,
}: {
  template?: ResultTemplate;
  templateValues: Record<string, unknown>;
  onTemplateValuesChange: (values: Record<string, unknown>) => void;
  datasetValues: ReturnType<typeof resultDatasetValuesFromResultValues>;
  onDatasetValuesChange: (values: ReturnType<typeof resultDatasetValuesFromResultValues>) => void;
  validation: ResultValidationSnapshot;
  validationStatus?: string;
  resultId?: string;
  templateInstanceKey?: string | null;
  templateInstanceLabel?: string | null;
  textValue?: string | null;
  numericValue?: number | null;
  unit?: string | null;
  notes?: string | null;
}) {
  const cleanNotes = notes === "Template registered; no measurement has been entered." ? "" : notes ?? "";
  const hasSupplement = numericValue !== null && numericValue !== undefined || Boolean(unit || textValue || cleanNotes);
  return <section className="document-section" data-testid="result-capture-editor">
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="document-section-title font-serif font-medium text-ink">实验结果 / Result record</h2>{template ? <p className="mt-1 text-xs text-muted">按照实验规程中已锁定的 {template.title ?? template.result_type} 模板填写</p> : <p className="mt-1 text-xs text-muted">先记录直接结果；分析与解释在下方填写。</p>}</div>
      {template ? <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${validationStatus === "valid" ? "bg-success-surface text-success" : validationStatus === "warning" ? "bg-warning-surface text-warning" : "bg-stone text-muted"}`}>{validationStatus?.replaceAll("_", " ") ?? "incomplete"}</span> : null}
    </header>

    {template ? <div className="space-y-5">
      <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-[9px] border border-hairline bg-warm/70 px-3 py-2.5 text-xs text-muted"><span><strong className="font-medium text-ink">记录方式：</strong>{resultTemplateCardinalityLabel(template.cardinality)}</span><span><strong className="font-medium text-ink">模板内容：</strong>{template.fields.length} 个字段 · {template.datasets?.length ?? 0} 个结果表 · {template.artifacts?.length ?? 0} 个文件槽</span></div>
      {template.description ? <p className="text-sm leading-6 text-graphite">{template.description}</p> : null}
      {template.instructions?.length && richTextPlainText(template.instructions).trim() ? <div className="rounded-[9px] border border-sage/35 bg-sage-surface/45 p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-moss">填写说明 / Instructions</p><ProtocolRichTextContent nodes={template.instructions} /></div> : null}
      {["per_sample", "per_timepoint", "repeatable"].includes(template.cardinality ?? "per_run") ? <div className="grid gap-4 rounded-[9px] border border-hairline bg-warm/70 p-3 md:grid-cols-2"><label><span className={formLabelClass}>{template.cardinality === "per_sample" ? "样本" : template.cardinality === "per_timepoint" ? "时间点" : "重复"}标识 · 必填</span><input required name="templateInstanceKey" defaultValue={templateInstanceKey ?? ""} className={formInputClass} placeholder={template.cardinality === "per_sample" ? "SAMPLE-001" : template.cardinality === "per_timepoint" ? "24h" : "replicate-1"} /></label><label><span className={formLabelClass}>显示名称</span><input name="templateInstanceLabel" defaultValue={templateInstanceLabel ?? ""} className={formInputClass} placeholder="便于阅读的名称" /></label></div> : <><input type="hidden" name="templateInstanceKey" value={templateInstanceKey ?? ""} /><input type="hidden" name="templateInstanceLabel" value={templateInstanceLabel ?? ""} /></>}
      {validation.errors?.length || validation.warnings?.length ? <div className="rounded-[9px] border border-warning/40 bg-warning-surface p-3"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-warning">当前完整性检查</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-graphite">{[...(validation.errors ?? []), ...(validation.warnings ?? [])].map((message) => <li key={message}>{message}</li>)}</ul></div> : null}
      {template.fields.length ? <div><h3 className="mb-3 text-sm font-semibold text-ink">直接结果字段</h3><div className="grid gap-4 md:grid-cols-2">{template.fields.map((field, index) => <TemplateFieldInput key={field.key ?? index} field={field} value={templateValues[field.key ?? stableResultKey(field.name ?? field.label ?? `field_${index + 1}`)]} onChange={(value) => { const key = field.key ?? stableResultKey(field.name ?? field.label ?? `field_${index + 1}`); onTemplateValuesChange({ ...templateValues, [key]: value }); }} />)}</div></div> : null}
      {template.datasets?.length ? <div><h3 className="mb-3 text-sm font-semibold text-ink">结果数据表</h3><ResultDatasetTableEditor datasets={template.datasets} values={datasetValues} onChange={onDatasetValuesChange} /></div> : null}
      {template.artifacts?.length ? <div className="rounded-[9px] border border-hairline p-3"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">数据与媒体文件槽</p><ul className="mt-2 grid gap-2 sm:grid-cols-2">{template.artifacts.map((artifact) => <li key={artifact.key} className="rounded-[7px] bg-warm/70 px-3 py-2 text-sm text-graphite"><span className="font-medium text-ink">{artifact.label}</span><span className="ml-2 text-xs text-muted">{artifact.kind}{artifact.required ? " · 必填" : " · 可选"}</span></li>)}</ul><p className="mt-3 text-xs leading-5 text-muted">文件使用固定槽位管理，不再作为自由文本块添加。{resultId ? <a href={`/results/${resultId}#result-files`} className="ml-1 font-medium text-moss hover:underline">保存后前往结果页上传</a> : "首次保存后即可上传。"}</p></div> : null}
    </div> : <div className="grid gap-4 md:grid-cols-2"><label className="md:col-span-2"><span className={formLabelClass}>直接结果</span><textarea name="textValue" defaultValue={textValue ?? ""} className={`${formTextareaClass} min-h-24`} placeholder="直接记录观察结果、判断或主要发现" /></label><label><span className={formLabelClass}>主要数值 · 可选</span><input name="numericValue" type="number" step="any" defaultValue={numericValue ?? ""} className={formInputClass} placeholder="例如 1.42" /></label><label><span className={formLabelClass}>单位</span><input name="unit" defaultValue={unit ?? ""} className={formInputClass} placeholder="%、ng/µL、fold…" /></label><label className="md:col-span-2"><span className={formLabelClass}>补充备注 · 可选</span><textarea name="notes" defaultValue={cleanNotes} className={formTextareaClass} /></label><input type="hidden" name="templateInstanceKey" value="" /><input type="hidden" name="templateInstanceLabel" value="" /></div>}

    {template ? <details className="mt-5 rounded-[9px] border border-hairline bg-warm/35" open={hasSupplement || undefined}><summary className="cursor-pointer px-4 py-3 text-sm font-medium text-graphite">补充摘要与备注 · 可选</summary><div className="grid gap-4 border-t border-hairline px-4 py-4 md:grid-cols-2"><label><span className={formLabelClass}>单一代表数值</span><input name="numericValue" type="number" step="any" defaultValue={numericValue ?? ""} className={formInputClass} placeholder="仅当一个数值可概括本结果时填写" /></label><label><span className={formLabelClass}>单位</span><input name="unit" defaultValue={unit ?? ""} className={formInputClass} /></label><label className="md:col-span-2"><span className={formLabelClass}>简短摘要</span><textarea name="textValue" defaultValue={textValue ?? ""} className={formTextareaClass} /></label><label className="md:col-span-2"><span className={formLabelClass}>补充备注</span><textarea name="notes" defaultValue={cleanNotes} className={formTextareaClass} /></label></div></details> : null}
  </section>;
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
