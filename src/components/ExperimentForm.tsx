"use client";

import { experimentExecutionDocument } from "@/lib/experiment-document";
import { ProtocolExecutionPreview } from "./ProtocolExecutionPreview";
import { newClientMutationId } from "@/lib/client-mutation-id";
import { ScientificBlockView } from "@/components/ScientificBlockView";
import { ExperimentExecutionRecord, type ExperimentExecutionStep } from "./ExperimentExecutionRecord";
import { isRecordLocked } from "@/lib/record-lifecycle";
import { structuredRunView } from '@/lib/structured-run';
import { useActionState, useState } from "react";
import Link from "next/link";
import { ExperimentProtocolPicker, type ExperimentProtocolVersionOption } from "@/components/ExperimentProtocolPicker";
import { ScientificDocumentEditor } from "@/components/ScientificDocumentEditor";
import { DocumentEditorLayout } from "@/components/DocumentEditorLayout";
import { RecordCodeField } from "@/components/RecordCodeField";
import { TagFieldLabel } from "@/components/TagFieldLabel";
import { formInputClass, formLabelClass, formTextareaClass, preventImplicitEnterSubmit } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import type { ScientificDocument } from "@/lib/scientific-document";
import { experimentStatusOptions, recordStatusOptions } from "@/lib/status-options";

type PlanOption = { id: string; code: string | null; title: string; project: { name: string } };
type StepOption = ExperimentExecutionStep;
export type ExperimentFormState = { error?: string };
export type ExperimentFormAction = (
  previousState: ExperimentFormState,
  formData: FormData,
) => Promise<ExperimentFormState>;

const initialState: ExperimentFormState = {};

export function ExperimentForm({ action, plans, protocolVersions = [], initial, lockedPlan = false }: {
  action: ExperimentFormAction;
  plans: PlanOption[];
  protocolVersions?: ExperimentProtocolVersionOption[];
  lockedPlan?: boolean;
  initial: {
    id?: string; updatedAt?: Date | string; researchPlanId?: string; runCode?: string | null; suggestedCodeSuffix?: string; title?: string; date?: string; status?: string; recordStatus?: string;
    purpose?: string | null; tags?: string[]; methodMode?: "protocol" | "custom";
    executionPlan?: unknown; executionParameters?: unknown; protocolSnapshotJson?: unknown; selectedProtocolVersionIds?: string[]; steps?: StepOption[]; document: ScientificDocument;
  };
}) {
  const [executionPending, setExecutionPending] = useState(false);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(initial.updatedAt ? new Date(initial.updatedAt).toISOString() : "");
  const [creationKey]=useState(()=>newClientMutationId());
  const [state, formAction, pending] = useActionState(action, initialState);
  const initialPlan = initial.researchPlanId ?? "";
  const [planId, setPlanId] = useState(initialPlan);
  const plan = plans.find((item) => item.id === planId);
  const initialSelectedIds = initial.selectedProtocolVersionIds ?? [];
  const [methodMode, setMethodMode] = useState<"protocol" | "custom">(initial.methodMode ?? "protocol");
  const [selectedIds, setSelectedIds] = useState(initialSelectedIds);
  const [title, setTitle] = useState(initial.title ?? "");
  const [runCodeSuffix, setRunCodeSuffix] = useState(initial.suggestedCodeSuffix ?? "");
  const [date, setDate] = useState(initial.date ?? new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState(initial.status ?? "planned");
  const [recordStatus, setRecordStatus] = useState(initial.recordStatus ?? "draft");
  const [purpose, setPurpose] = useState(initial.purpose ?? "");
  const [customChecklistEnabled, setCustomChecklistEnabled] = useState(false);
  const identifier = initial.runCode ?? (runCodeSuffix ? `EXP-${runCodeSuffix}` : "Draft Experiment");
  const lockedMethodMode = initialSelectedIds.length ? "protocol" : "custom";
  const activeMethodMode = initial.id ? lockedMethodMode : methodMode;
  const selectedVersions=selectedIds.map(id=>protocolVersions.find(version=>version.id===id)).filter(version=>!!version);
  const executionUnconfirmed=selectedVersions.some(version=>version.execution?.executionNeedsReview) || (selectedVersions.length>0 && selectedVersions.every(version=>version.execution && !version.execution.steps.length));
  const structuredExecution = initial.id ? structuredRunView(initial.protocolSnapshotJson, initial.executionPlan, []).hasSystems : selectedVersions.some(version => version.hasSystems);
  const completedStepCount = initial.steps?.filter((step) => step.completed).length ?? 0;

  return <form inert={pending} aria-busy={pending} action={formAction} onKeyDown={preventImplicitEnterSubmit} className="space-y-5">
    {!initial.id?<input type="hidden" name="creationKey" value={creationKey}/>:null}
    {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
    {initial.updatedAt ? <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} /> : null}
    <input type="hidden" name="methodMode" value={activeMethodMode} />
    {lockedPlan ? <input type="hidden" name="researchPlanId" value={planId} /> : null}
    <DocumentEditorLayout defaultMetadataOpen={!initial.id}>
      <div className="document-editor-main"><ScientificDocumentEditor initialDocument={initial.document} compact
        sectionContent={{
          execution: initial.id ? <ExperimentExecutionRecord experimentId={initial.id} steps={initial.steps ?? []} snapshot={initial.protocolSnapshotJson} executionPlan={initial.executionPlan} parameters={initial.executionParameters} updatedAt={expectedUpdatedAt} editable={!isRecordLocked(recordStatus) && !["archived", "completed"].includes(status)} onPendingChange={setExecutionPending} onSaved={result => { if (result.updatedAt) setExpectedUpdatedAt(result.updatedAt); if (result.status) setStatus(result.status); }} /> : methodMode === "protocol" && selectedVersions.length ? <div className="space-y-5"><p className="text-xs text-muted">保存实验后可勾选步骤并记录偏差。</p>{selectedVersions.map(version => version.execution ? <section key={version.id} data-execution-protocol={version.id} className="experiment-execution-group"><h3>{version.protocol.title}</h3><p className="text-xs text-muted">v{version.displayVersion}</p><ProtocolExecutionPreview execution={version.execution} editHref={`/protocols/${version.protocol.id}/versions/${version.id}/edit`} /></section> : null)}</div> : null,
          deviations: initial.steps?.some(step => step.deviationNote) ? <div className="experiment-deviation-summary">{experimentExecutionDocument(undefined, initial.steps, initial.executionParameters, initial.protocolSnapshotJson, initial.executionPlan).sections.find(section => section.key === "deviations")?.blocks.map(block => <ScientificBlockView key={block.id} block={block} />)}</div> : null,
        }}
        documentType="Experiment" identifier={identifier} title={title} titlePlaceholder="Untitled Experiment" titleEditor={<input required value={title} onChange={(event) => setTitle(event.target.value)} className="document-page-title-input" placeholder="Untitled Experiment" aria-label="Experiment title" />} subtitle={purpose} hiddenSectionKeys={activeMethodMode === "protocol" ? ["background"] : []} headerFacts={[
          { label: "研究计划", value: plan?.title ?? "未选择" },
          { label: "实验日期", value: date || "未填写" },
        ]} /></div>
      <aside className="document-editor-sidebar experiment-metadata" data-document-metadata="true" aria-label="Experiment metadata">
      <label className="col-span-2"><span className={formLabelClass}>Research Plan</span>{lockedPlan ? <div className={`${formInputClass} flex items-center bg-stone/50`}>{plan ? `${plan.project.name} · ${plan.title}` : "未选择研究计划"}</div> : <select name="researchPlanId" value={planId} onChange={(event) => setPlanId(event.target.value)} className={formInputClass}><option value="">未选择研究计划</option>{plans.map((item) => <option key={item.id} value={item.id}>{item.project.name} · {item.title}</option>)}</select>}</label>
    {!initial.id ? <section className="space-y-2 border-b border-hairline py-2"><h3 className="text-sm font-semibold">方法来源</h3><div className="space-y-2">
      <fieldset className="experiment-method-options grid gap-2 grid-cols-2"><legend className="sr-only">方法来源</legend>
        <label className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--ln-radius-control-lg)] border px-2 py-1.5 ${methodMode === "protocol" ? "border-moss bg-sage-surface" : "border-hairline bg-warm"}`}><input type="radio" name="methodModeChoice" checked={methodMode === "protocol"} onChange={() => setMethodMode("protocol")} className="accent-[var(--moss)]" /><span><strong className="block text-sm font-medium text-ink">依据实验规程</strong></span></label>
        <label className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--ln-radius-control-lg)] border px-2 py-1.5 ${methodMode === "custom" ? "border-moss bg-sage-surface" : "border-hairline bg-warm"}`}><input type="radio" name="methodModeChoice" checked={methodMode === "custom"} onChange={() => setMethodMode("custom")} className="accent-[var(--moss)]" /><span><strong className="block text-sm font-medium text-ink">自行记录</strong></span></label>
      </fieldset>
        {methodMode === "protocol" ? <>
        <ExperimentProtocolPicker versions={[...protocolVersions].sort((a,b)=>Number(b.researchPlanIds?.includes(planId)??false)-Number(a.researchPlanIds?.includes(planId)??false))} initialSelectedIds={selectedIds} onSelectionChange={setSelectedIds} />
      </> : <>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={customChecklistEnabled}
            onChange={(event) => setCustomChecklistEnabled(event.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--moss)]"
          />
          <span className="font-medium text-ink">添加可勾选的执行步骤</span>
        </label>
        {customChecklistEnabled ? (
          <label className="block"><span className={formLabelClass}>Custom execution steps · one step per line</span><textarea name="customSteps" className={`${formTextareaClass} min-h-36`} placeholder={"Seed cells | 2.0 × 10^5 cells per well\nIncubate overnight\nAcquire images | 20× objective"} /><span className="mt-1 block text-xs leading-5 text-muted">Optional detail follows a vertical bar. These lines become the checkable on-bench execution block.</span></label>
        ) : null}
      </>}
    </div></section> : null}

    <section className="border-b border-hairline py-3"><div className="experiment-metadata-fields grid grid-cols-2 gap-3">

      <RecordCodeField label="Experiment code" prefix="EXP-" name="runCodeSuffix" minimumDigits={3} placeholder="001" value={runCodeSuffix} onValueChange={setRunCodeSuffix} existingCode={initial.id ? initial.runCode : undefined} />
      <label><span className={formLabelClass}>Planned date</span><input required name="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={formInputClass} /></label>
      <label className="col-span-2"><span className={formLabelClass}>Title</span><input required name="title" value={title} onChange={(event) => setTitle(event.target.value)} className={formInputClass} /></label>
      <label className="col-span-2"><span className={formLabelClass}>Objective / purpose · optional</span><input name="purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="One line: what this planned execution is meant to establish" className={formInputClass} /></label>
      {structuredExecution ? <div className="col-span-2"><input type="hidden" name="status" value={initial.id ? status : 'planned'}/><p>Execution status · {initial.id ? status : 'planned'}</p><p className="text-xs text-muted">执行状态随步骤操作更新。</p></div> : <StatusRadioGroup label="Execution status" name="status" options={experimentStatusOptions} value={status} onValueChange={setStatus} required className="col-span-2" />}
      <StatusRadioGroup label="Record status" name="recordStatus" options={recordStatusOptions} value={recordStatus} onValueChange={setRecordStatus} required className="col-span-2" />
      <label className="col-span-2"><TagFieldLabel /><input name="tags" defaultValue={(initial.tags ?? []).join(", ")} placeholder="RNA, qPCR, imaging" className={formInputClass} /></label>
    </div></section>

    {initial.id && initial.steps?.length ? <Card>
      <CardHeader title="Execution record" eyebrow="与正文中的执行记录同步" action={<Link href={`/experiments/${initial.id}/run`} className="inline-flex h-9 items-center rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface px-3 py-1 text-xs font-medium text-moss hover:bg-warm">Open run mode</Link>} />
      <CardBody className="space-y-2 text-sm leading-6 text-graphite">{completedStepCount}/{initial.steps.length} executed steps · {initial.steps.filter((step) => Boolean(step.deviationNote)).length} deviations</CardBody>
    </Card> : null}
      </aside>
    </DocumentEditorLayout>
    <div className="document-editor-save-bar sticky bottom-4 z-20 flex flex-wrap items-center justify-end gap-3">
      {state.error ? <p role="alert" className="max-w-xl rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error shadow-soft">{state.error}</p> : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending || executionPending || (!initial.id && methodMode === "protocol" && (!selectedIds.length || executionUnconfirmed))} aria-busy={pending} className="shadow-soft">{pending ? "Saving…" : "Save Experiment"}</Button>
    </div>
  </form>;
}
