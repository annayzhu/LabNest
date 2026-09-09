"use client";

import { experimentExecutionDocument } from "@/lib/experiment-document";
import { ScientificBlockView } from "@/components/ScientificBlockView";
import { experimentMethodNames } from "@/lib/experiment-provenance";
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
type StepOption = { evidence?: ScientificDocument["sections"][number]["blocks"]; groupOrder?:number;groupTitle?:string;deviationType?:string|null;deviationImpact?:string|null;deviationAuthor?:string|null; id: string; order: number; title: string; description: string; completed: boolean; deviationNote?: string | null };
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
    id?: string; researchPlanId?: string; runCode?: string | null; suggestedCodeSuffix?: string; title?: string; date?: string; status?: string; recordStatus?: string;
    purpose?: string | null; tags?: string[]; methodMode?: "protocol" | "custom";
    protocolSnapshotJson?: unknown; selectedProtocolVersionIds?: string[]; steps?: StepOption[]; document: ScientificDocument;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const initialPlan = initial.researchPlanId ?? plans[0]?.id ?? "";
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
  const protocolMethodSummary = initial.id ? experimentMethodNames(initial.protocolSnapshotJson).join('；') : selectedIds.map(id=>{const version=protocolVersions.find(v=>v.id===id);return version ? `${version.protocol.title} · ${version.displayVersion}` : '规程未记录';}).join('；') || '未选择规程';
  const completedStepCount = initial.steps?.filter((step) => step.completed).length ?? 0;

  return <form action={formAction} onKeyDown={preventImplicitEnterSubmit} className="space-y-5">
    {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
    <input type="hidden" name="methodMode" value={activeMethodMode} />
    {lockedPlan ? <input type="hidden" name="researchPlanId" value={planId} /> : null}
    <DocumentEditorLayout>
      <div className="document-editor-main"><ScientificDocumentEditor initialDocument={initial.document} compact trailingContent={initial.steps?.length ? <section aria-label="Run 执行记录" className="document-section"><h2 className="document-section-title">Run 执行记录</h2>{experimentExecutionDocument(undefined,initial.steps.map(step=>({...step,groupOrder:step.groupOrder??0,groupTitle:step.groupTitle??"步骤"}))).sections.find(section=>section.key==='execution')?.blocks.map(block=><div key={block.id} className="document-block"><ScientificBlockView block={block}/></div>)}</section>:null} documentType="Experiment" identifier={identifier} title={title} titlePlaceholder="Untitled Experiment" titleEditor={<input required value={title} onChange={(event) => setTitle(event.target.value)} className="document-page-title-input" placeholder="Untitled Experiment" aria-label="Experiment title" />} subtitle={purpose} hiddenSectionKeys={activeMethodMode === "protocol" ? ["background"] : []} headerFacts={[
        { label: "研究计划", value: plan?.title ?? "未选择" },
        { label: "方法来源", value: activeMethodMode === "protocol" ? protocolMethodSummary : "自行记录" },
      ]} /></div>
      <aside className="document-editor-sidebar" data-document-metadata="true" aria-label="Experiment metadata">
      <label className="md:col-span-2"><span className={formLabelClass}>Research Plan</span>{lockedPlan ? <div className={`${formInputClass} flex items-center bg-stone/50`}>{plan?.project.name} · {plan?.title}</div> : <select required name="researchPlanId" value={planId} onChange={(event) => setPlanId(event.target.value)} className={formInputClass}>{plans.map((item) => <option key={item.id} value={item.id}>{item.project.name} · {item.title}</option>)}</select>}</label>
    {!initial.id ? <section className="space-y-3 border-b border-hairline py-3"><h3 className="text-sm font-semibold">方法来源</h3><div className="space-y-3">
      <fieldset className="grid gap-3 md:grid-cols-2"><legend className="sr-only">方法来源</legend>
        <label className={`mt-2 flex cursor-pointer items-start gap-3 rounded-[var(--ln-radius-panel-inner)] border px-3 py-3 ${methodMode === "protocol" ? "border-moss bg-sage-surface" : "border-hairline bg-warm"}`}><input type="radio" checked={methodMode === "protocol"} onChange={() => setMethodMode("protocol")} className="mt-1 accent-[var(--moss)]" /><span><strong className="block text-sm font-medium text-ink">依据实验规程</strong></span></label>
        <label className={`mt-2 flex cursor-pointer items-start gap-3 rounded-[var(--ln-radius-panel-inner)] border px-3 py-3 ${methodMode === "custom" ? "border-moss bg-sage-surface" : "border-hairline bg-warm"}`}><input type="radio" checked={methodMode === "custom"} onChange={() => setMethodMode("custom")} className="mt-1 accent-[var(--moss)]" /><span><strong className="block text-sm font-medium text-ink">自行记录</strong></span></label>
      </fieldset>
        {methodMode === "protocol" ? <>
        <ExperimentProtocolPicker versions={[...protocolVersions].sort((a,b)=>Number(b.researchPlanIds?.includes(planId)??false)-Number(a.researchPlanIds?.includes(planId)??false))} initialSelectedIds={initialSelectedIds} onSelectionChange={setSelectedIds} />
      </> : <>
        <label className="flex items-start gap-3 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-sage-surface/60 px-3 py-3 text-sm">
          <input
            type="checkbox"
            checked={customChecklistEnabled}
            onChange={(event) => setCustomChecklistEnabled(event.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--moss)]"
          />
          <span><span className="font-medium text-ink">Enable on-bench checklist</span><span className="mt-1 block text-xs leading-5 text-muted">If enabled, this text becomes checkable steps in Run mode. If disabled, run notes stay freeform.</span></span>
        </label>
        {customChecklistEnabled ? (
          <label className="block"><span className={formLabelClass}>Custom execution steps · one step per line</span><textarea name="customSteps" className={`${formTextareaClass} min-h-36`} placeholder={"Seed cells | 2.0 × 10^5 cells per well\nIncubate overnight\nAcquire images | 20× objective"} /><span className="mt-1 block text-xs leading-5 text-muted">Optional detail follows a vertical bar. These lines become the checkable on-bench execution block.</span></label>
        ) : (
          <p className="rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm px-3 py-3 text-xs leading-5 text-muted">No step-by-step checklist for this custom protocol. Run notes will be recorded in a freeform execution log.</p>
        )}
      </>}
    </div></section> : null}

    <section className="border-b border-hairline py-3"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

      <RecordCodeField label="Experiment code" prefix="EXP-" name="runCodeSuffix" minimumDigits={3} placeholder="001" value={runCodeSuffix} onValueChange={setRunCodeSuffix} existingCode={initial.id ? initial.runCode : undefined} />
      <label><span className={formLabelClass}>Planned date</span><input required name="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={formInputClass} /></label>
      <label className="md:col-span-2"><span className={formLabelClass}>Title</span><input required name="title" value={title} onChange={(event) => setTitle(event.target.value)} className={formInputClass} /></label>
      <label className="md:col-span-2 xl:col-span-4"><span className={formLabelClass}>Objective / purpose · optional</span><input name="purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="One line: what this planned execution is meant to establish" className={formInputClass} /></label>
      <StatusRadioGroup label="Execution status" name="status" options={experimentStatusOptions} value={status} onValueChange={setStatus} required className="md:col-span-2" />
      <StatusRadioGroup label="Record status" name="recordStatus" options={recordStatusOptions} value={recordStatus} onValueChange={setRecordStatus} required className="md:col-span-2" />
      <label className="md:col-span-2 xl:col-span-4"><TagFieldLabel /><input name="tags" defaultValue={(initial.tags ?? []).join(", ")} placeholder="RNA, qPCR, imaging" className={formInputClass} /></label>
    </div></section>

    {initial.id && initial.steps?.length ? <Card>
      <CardHeader title="Execution record" eyebrow="Update completion and notes from run mode" action={<Link href={`/experiments/${initial.id}/run`} className="inline-flex h-9 items-center rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface px-3 py-1 text-xs font-medium text-moss hover:bg-warm">Open run mode</Link>} />
      <CardBody className="space-y-2 text-sm leading-6 text-graphite">{completedStepCount}/{initial.steps.length} executed steps · {initial.steps.filter((step) => Boolean(step.deviationNote)).length} deviations</CardBody>
    </Card> : null}
      </aside>
    </DocumentEditorLayout>
    <div className="document-editor-save-bar sticky bottom-4 z-20 flex flex-wrap items-center justify-end gap-3">
      {state.error ? <p role="alert" className="max-w-xl rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error shadow-soft">{state.error}</p> : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending || !plans.length || (!initial.id && methodMode === "protocol" && !selectedIds.length)} aria-busy={pending} className="shadow-soft">{pending ? "Saving…" : "Save Experiment"}</Button>
    </div>
  </form>;
}
