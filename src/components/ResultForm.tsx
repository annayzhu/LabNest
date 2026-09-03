"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ScientificDocumentEditor } from "@/components/ScientificDocumentEditor";
import { DocumentEditorLayout } from "@/components/DocumentEditorLayout";
import { ProtocolRichTextContent } from "@/components/ProtocolDocumentView";
import { ResultDatasetTableEditor } from "@/components/ResultDatasetTable";
import { ResultTypePicker } from "@/components/ResultTypePicker";
import type { ResultTypeDefinitionItem } from "@/app/results/result-type-actions";
import { formInputClass, formLabelClass, formTextareaClass, preventImplicitEnterSubmit } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import type { ScientificDocument } from "@/lib/scientific-document";
import { resultDocumentWithLegacyValues } from "@/lib/result-document";
import { buildExperimentResultReportTemplate, type ExperimentResultModule } from "@/lib/experiment-results";
import type { FormAction, FormActionState } from "@/lib/form-actions";
import {
  fieldDataType,
  fieldSemanticRole,
  normalizeResultTemplate,
  normalizeResultValues,
  resultDatasetValuesFromResultValues,
  stableResultKey,
  validateResultRecord,
  withResultDatasetValues,
} from "@/lib/result-templates";
import { recordStatusOptions, resultQualityStatusOptions } from "@/lib/status-options";
import type { ResultTemplate, ResultTemplateField } from "@/lib/types";

type ExperimentOption = { id: string; runCode: string | null; title: string; researchPlan: { code: string | null; title: string } | null; project: { name: string } | null };
type QuickEntryOption = { id: string; title: string; occurredAt: string; projectName?: string | null };
type ResultValidationSnapshot = { errors?: string[]; warnings?: string[] };
const initialState: FormActionState = {};

export function ResultForm({ action, experiments, resultTypes, quickEntries = [], availableModules = [], initial, lockedExperiment = false }: {
  action: FormAction;
  experiments: ExperimentOption[];
  resultTypes: ResultTypeDefinitionItem[];
  quickEntries?: QuickEntryOption[];
  availableModules?: ExperimentResultModule[];
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
    sourceEntryId?: string | null;
    templateSnapshotJson?: unknown;
    valuesJson?: unknown;
    validationJson?: unknown;
    legacyValuesPromoted?: boolean;
    document: ScientificDocument;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [experimentId, setExperimentId] = useState(initial.experimentId ?? "");
  const [title, setTitle] = useState(initial.title ?? "");
  const [resultType, setResultType] = useState(initial.resultType ?? resultTypes[0]?.label ?? "");
  const [sourceType, setSourceType] = useState(initial.sourceType ?? "manual");
  const [recordStatus, setRecordStatus] = useState(initial.recordStatus ?? "draft");
  const [qualityStatus, setQualityStatus] = useState(initial.qualityStatus ?? "not_assessed");
  const experiment = experiments.find((item) => item.id === experimentId);
  const [selectedModuleIds, setSelectedModuleIds] = useState(() => availableModules.map((module) => module.id));
  const initialTemplate = useMemo(() => initial.templateKey && initial.templateSnapshotJson && typeof initial.templateSnapshotJson === "object" && Object.keys(initial.templateSnapshotJson as object).length ? normalizeResultTemplate(initial.templateSnapshotJson) : undefined, [initial.templateKey, initial.templateSnapshotJson]);
  const template = useMemo(() => availableModules.length ? buildExperimentResultReportTemplate(availableModules, selectedModuleIds) : initialTemplate, [availableModules, initialTemplate, selectedModuleIds]);
  const hasTemplate = Boolean(template);
  const [templateValues, setTemplateValues] = useState<Record<string, unknown>>(() => normalizeResultValues(initial.valuesJson));
  const [datasetValues, setDatasetValues] = useState(() => resultDatasetValuesFromResultValues(initial.valuesJson));
  const serializedValues = useMemo(() => JSON.stringify(withResultDatasetValues(templateValues, datasetValues)), [datasetValues, templateValues]);
  const validation = useMemo<ResultValidationSnapshot>(() => initial.validationJson && typeof initial.validationJson === "object" ? initial.validationJson as ResultValidationSnapshot : {}, [initial.validationJson]);
  const liveValidation = useMemo(() => template ? validateResultRecord({ template, values: withResultDatasetValues(templateValues, datasetValues) }) : validation, [datasetValues, template, templateValues, validation]);
  const visibleValidation = template && (!initial.id || availableModules.length) ? liveValidation : validation;
  const document = useMemo(() => initial.legacyValuesPromoted ? initial.document : resultDocumentWithLegacyValues(initial.document, initial), [initial]);

  const missingModuleSelection = availableModules.length > 0 && selectedModuleIds.length === 0;

  return <form action={formAction} onKeyDown={preventImplicitEnterSubmit} className="space-y-5">
    {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
    {lockedExperiment ? <input type="hidden" name="experimentId" value={initial.experimentId ?? ""} /> : null}
    <input type="hidden" name="templateValuesJson" value={serializedValues} />
    <input type="hidden" name="legacyValuesPromoted" value="true" />
    <input type="hidden" name="textValue" value={initial.textValue ?? ""} />
    <input type="hidden" name="numericValue" value={initial.numericValue ?? ""} />
    <input type="hidden" name="unit" value={initial.unit ?? ""} />
    <input type="hidden" name="notes" value={initial.notes ?? ""} />
    {availableModules.length ? <input type="hidden" name="resultModuleIdsJson" value={JSON.stringify(selectedModuleIds)} /> : null}
    {template ? <input type="hidden" name="templateKey" value={template.templateKey ?? ""} /> : null}
    {template && initial.templateProtocolVersionId ? <input type="hidden" name="templateProtocolVersionId" value={initial.templateProtocolVersionId} /> : null}
    {!template ? <><input type="hidden" name="templateInstanceKey" value="" /><input type="hidden" name="templateInstanceLabel" value="" /></> : null}
    <DocumentEditorLayout>
      <div className="document-editor-main"><ScientificDocumentEditor initialDocument={document} documentType="Result" title={title} titlePlaceholder="Untitled Result" titleEditor={<input required value={title} onChange={(event) => setTitle(event.target.value)} className="document-page-title-input" placeholder="Untitled Result" aria-label="Result title" />} headerFacts={availableModules.length ? [
        { label: "Experiment", value: experiment ? `${experiment.runCode ?? experiment.title} · ${experiment.project?.name ?? "No project"}` : "Not selected" },
      ] : [
        { label: "Experiment", value: experiment ? `${experiment.runCode ?? experiment.title} · ${experiment.project?.name ?? "No project"}` : "Not selected" },
        { label: "Result type", value: resultType },
        { label: "Source", value: sourceType.replaceAll("_", " ") },
        { label: "Record", value: recordStatus.replaceAll("_", " ") },
        { label: "QC", value: qualityStatus.replaceAll("_", " ") },
      ]} insertProfile="scientific-result" leadingContent={template ? <ResultCaptureEditor
        template={template}
        templateValues={templateValues}
        onTemplateValuesChange={setTemplateValues}
        datasetValues={datasetValues}
        onDatasetValuesChange={setDatasetValues}
        validation={visibleValidation}
        validationStatus={initial.validationStatus}
        resultId={initial.id}
        templateInstanceKey={initial.templateInstanceKey}
        templateInstanceLabel={initial.templateInstanceLabel}
        availableModules={availableModules}
        selectedModuleIds={selectedModuleIds}
        onSelectedModuleIdsChange={setSelectedModuleIds}
      /> : undefined} /></div>
      <aside className="document-editor-sidebar" data-document-metadata="true" aria-label="Result metadata">
        <details className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface" open={!hasTemplate ? true : undefined}><summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-ink">报告设置 <span className="ml-1 text-xs font-normal text-muted">状态与来源</span></summary><div className="grid min-w-0 gap-3 border-t border-hairline p-3">
          {quickEntries.length ? <label className="min-w-0"><span className={formLabelClass}>从快速实验记录导入 · 可选</span><select name="sourceEntryId" value={initial.sourceEntryId ?? ""} onChange={(event) => { const params = new URLSearchParams(searchParams.toString()); params.set("manual", "1"); if (event.target.value) params.set("entry", event.target.value); else params.delete("entry"); if (experimentId) params.set("experiment", experimentId); router.replace(`/results/new?${params.toString()}`); }} className={formInputClass}><option value="">不导入快速记录</option>{quickEntries.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {entry.occurredAt.slice(0, 10)}{entry.projectName ? ` · ${entry.projectName}` : ""}</option>)}</select><span className="mt-1 block text-xs leading-5 text-muted">导入正文、来源链接和附件引用；分析与解释仍由你确认填写。</span></label> : null}
          <label className="min-w-0"><span className={formLabelClass}>实验</span>{lockedExperiment ? <div className={`${formInputClass} flex h-auto min-h-10 items-center break-words bg-stone/50 py-2`}>{experiment?.project?.name} · {experiment?.researchPlan?.code ?? experiment?.researchPlan?.title} · {experiment?.runCode ?? experiment?.title}</div> : <select required name="experimentId" value={experimentId} onChange={(event) => setExperimentId(event.target.value)} className={formInputClass}><option value="" disabled>Select Experiment</option>{experiments.map((item) => <option key={item.id} value={item.id}>{item.project?.name} · {item.researchPlan?.code ?? item.researchPlan?.title ?? "No plan"} · {item.runCode ?? item.title}</option>)}</select>}</label>
          <label className="min-w-0"><span className={formLabelClass}>标题</span><input required name="title" value={title} onChange={(event) => setTitle(event.target.value)} className={formInputClass} /></label>
          {hasTemplate ? <label className="min-w-0"><span className={formLabelClass}>结果类型 · 由模板锁定</span><input readOnly name="resultType" value={resultType || template?.result_type || "measurement"} className={`${formInputClass} bg-stone/50`} /></label> : <ResultTypePicker initialTypes={resultTypes} value={resultType} onChange={setResultType} />}
          {hasTemplate ? <label className="min-w-0"><span className={formLabelClass}>来源 · 已锁定</span><input readOnly name="sourceType" value={sourceType || "protocol_template"} className={`${formInputClass} bg-stone/50`} /></label> : <label className="min-w-0"><span className={formLabelClass}>来源</span><select name="sourceType" value={sourceType} onChange={(event) => setSourceType(event.target.value)} className={formInputClass}><option value="manual">Manual</option><option value="file_import">File import</option><option value="tool">External tool</option><option value="analysis">Analysis</option></select></label>}
          <StatusRadioGroup label="记录状态" name="recordStatus" options={recordStatusOptions} value={recordStatus} onValueChange={setRecordStatus} required optionsClassName="grid grid-cols-2 gap-2 [&>label]:min-w-0 [&>label]:px-2 [&>label>span]:min-w-0 [&>label>span]:break-words" />
          <StatusRadioGroup label="质控状态" name="qualityStatus" options={resultQualityStatusOptions} value={qualityStatus} onValueChange={setQualityStatus} required optionsClassName="grid grid-cols-2 gap-2 [&>label]:min-w-0 [&>label]:px-2 [&>label>span]:min-w-0 [&>label>span]:break-words" />
          <label className="min-w-0"><span className={formLabelClass}>分析方法 / 软件</span><input name="analysisMethod" defaultValue={initial.analysisMethod ?? ""} placeholder="方法、版本、参数或工具" className={formInputClass} /></label>
        </div></details>
      </aside>
    </DocumentEditorLayout>
    <div className="document-editor-save-bar sticky bottom-4 z-20 flex flex-wrap items-center justify-end gap-3">
      {state.error ? <FormErrorSummary message={state.error} /> : null}
      {missingModuleSelection ? <p role="alert" className="text-xs font-medium text-warning">请至少选择一个结果模块。</p> : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending || missingModuleSelection} aria-busy={pending} className="shadow-soft">{pending ? "Saving…" : "Save Result"}</Button>
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
  availableModules,
  selectedModuleIds,
  onSelectedModuleIdsChange,
}: {
  template: ResultTemplate;
  templateValues: Record<string, unknown>;
  onTemplateValuesChange: (values: Record<string, unknown>) => void;
  datasetValues: ReturnType<typeof resultDatasetValuesFromResultValues>;
  onDatasetValuesChange: (values: ReturnType<typeof resultDatasetValuesFromResultValues>) => void;
  validation: ResultValidationSnapshot;
  validationStatus?: string;
  resultId?: string;
  templateInstanceKey?: string | null;
  templateInstanceLabel?: string | null;
  availableModules: ExperimentResultModule[];
  selectedModuleIds: string[];
  onSelectedModuleIdsChange: (ids: string[]) => void;
}) {
  return <section className="document-section" data-testid="result-capture-editor">
    <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <h2 className="document-section-title font-serif font-medium text-ink">实验结果 / Result record</h2>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${validationStatus === "valid" ? "bg-success-surface text-success" : validationStatus === "warning" ? "bg-warning-surface text-warning" : "bg-stone text-muted"}`}>{validationStatus?.replaceAll("_", " ") ?? "incomplete"}</span>
    </header>

    <div className="space-y-4">
      {availableModules.length ? <details open className="rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm/45"><summary className="cursor-pointer px-3 py-2 text-xs font-medium text-graphite">结果内容 <span className="ml-1 text-muted">{selectedModuleIds.length}/{availableModules.length}</span></summary><div className="grid gap-1 border-t border-hairline px-3 py-2 sm:grid-cols-2">{availableModules.map((module) => <label key={module.id} className="flex min-w-0 cursor-pointer items-start gap-2 rounded-[var(--ln-radius-control-sm)] px-1.5 py-1.5 hover:bg-surface"><input type="checkbox" checked={selectedModuleIds.includes(module.id)} onChange={(event) => onSelectedModuleIdsChange(event.target.checked ? [...selectedModuleIds, module.id] : selectedModuleIds.filter((id) => id !== module.id))} className="mt-0.5 h-3.5 w-3.5 accent-moss" /><span className="min-w-0"><span className="block break-words text-xs font-medium leading-5 text-ink">{module.template.title}</span><span className="block break-words text-[11px] leading-4 text-muted">{module.protocolTitle}{module.protocolCode ? <span className="record-identifier ml-1 text-[10px]">· {module.protocolCode} · v{module.displayVersion}</span> : null}</span></span></label>)}</div></details> : null}
      {template.instructions?.length ? <aside className="rounded-[var(--ln-radius-control-lg)] border border-sage/35 bg-sage-surface/35 px-3 py-2.5" aria-label="Result template instructions"><p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">填写说明 / Instructions</p><div className="text-xs leading-5 text-graphite"><ProtocolRichTextContent nodes={template.instructions} /></div></aside> : null}
      {["per_sample", "per_timepoint", "repeatable"].includes(template.cardinality ?? "per_run") ? <div className="grid gap-4 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm/70 p-3 md:grid-cols-2"><label><span className={formLabelClass}>{template.cardinality === "per_sample" ? "样本" : template.cardinality === "per_timepoint" ? "时间点" : "重复"}标识 · 必填</span><input required name="templateInstanceKey" defaultValue={templateInstanceKey ?? ""} className={formInputClass} placeholder={template.cardinality === "per_sample" ? "SAMPLE-001" : template.cardinality === "per_timepoint" ? "24h" : "replicate-1"} /></label><label><span className={formLabelClass}>显示名称</span><input name="templateInstanceLabel" defaultValue={templateInstanceLabel ?? ""} className={formInputClass} placeholder="便于阅读的名称" /></label></div> : <><input type="hidden" name="templateInstanceKey" value={templateInstanceKey ?? ""} /><input type="hidden" name="templateInstanceLabel" value={templateInstanceLabel ?? ""} /></>}
      {validation.errors?.length || validation.warnings?.length ? <CompactValidationSummary errors={validation.errors} warnings={validation.warnings} /> : null}
      {template.fields.length ? <div><h3 className="mb-3 text-sm font-semibold text-ink">直接结果字段</h3><div className="grid gap-4 md:grid-cols-2">{template.fields.map((field, index) => <TemplateFieldInput key={field.key ?? index} field={field} value={templateValues[field.key ?? stableResultKey(field.name ?? field.label ?? `field_${index + 1}`)]} onChange={(value) => { const key = field.key ?? stableResultKey(field.name ?? field.label ?? `field_${index + 1}`); onTemplateValuesChange({ ...templateValues, [key]: value }); }} />)}</div></div> : null}
      {template.datasets?.length ? <div><h3 className="mb-3 text-sm font-semibold text-ink">结果数据表</h3><ResultDatasetTableEditor datasets={template.datasets} values={datasetValues} onChange={onDatasetValuesChange} /></div> : null}
      {template.artifacts?.length ? <div className="rounded-[var(--ln-radius-panel-inner)] border border-hairline p-3"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">数据与媒体文件槽</p><ul className="mt-2 grid gap-2 sm:grid-cols-2">{template.artifacts.map((artifact) => <li key={artifact.key} className="rounded-[var(--ln-radius-control-md)] bg-warm/70 px-3 py-2 text-sm text-graphite"><span className="font-medium text-ink">{artifact.label}</span><span className="ml-2 text-xs text-muted">{artifact.kind}{artifact.required ? " · 必填" : " · 可选"}</span></li>)}</ul><p className="mt-3 text-xs leading-5 text-muted">文件使用固定槽位管理，不再作为自由文本块添加。{resultId ? <a href={`/results/${resultId}#result-files`} className="ml-1 font-medium text-moss hover:underline">保存后前往结果页上传</a> : "首次保存后即可上传。"}</p></div> : null}
    </div>
  </section>;
}

function compactMessages(messages: string[] = []) {
  const grouped = new Map<string, number>();
  messages.forEach((message) => {
    const compact = message.replace(/Row \d+:/g, "Rows:").replace(/ · /g, ": ");
    grouped.set(compact, (grouped.get(compact) ?? 0) + 1);
  });
  return [...grouped].map(([message, count]) => count > 1 ? `${message} (${count})` : message).slice(0, 6);
}

function CompactValidationSummary({ errors = [], warnings = [] }: { errors?: string[]; warnings?: string[] }) {
  const messages = compactMessages([...errors, ...warnings]);
  return <details className="rounded-[var(--ln-radius-control-lg)] border border-warning/35 bg-warning-surface/70" open>
    <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-warning">还需填写 {errors.length + warnings.length} 项</summary>
    <ul className="grid gap-1 border-t border-warning/20 px-3 py-2 text-xs leading-5 text-graphite sm:grid-cols-2">{messages.map((message) => <li key={message}>{message}</li>)}</ul>
  </details>;
}

function FormErrorSummary({ message }: { message: string }) {
  return <div role="alert" className="max-w-2xl rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-xs leading-5 text-error shadow-soft"><strong className="font-semibold">暂未保存。</strong> {message}</div>;
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
