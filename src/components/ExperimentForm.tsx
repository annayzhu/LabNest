"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ExperimentProtocolPicker, type ExperimentProtocolVersionOption } from "@/components/ExperimentProtocolPicker";
import { ScientificDocumentEditor } from "@/components/ScientificDocumentEditor";
import { RecordCodeField } from "@/components/RecordCodeField";
import { TagFieldLabel } from "@/components/TagFieldLabel";
import { formInputClass, formLabelClass, formTextareaClass, preventImplicitEnterSubmit } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import type { ScientificDocument } from "@/lib/scientific-document";
import { experimentStatusOptions, recordStatusOptions } from "@/lib/status-options";

type PlanOption = { id: string; code: string | null; title: string; project: { name: string } };
type StepOption = { id: string; order: number; title: string; description: string; completed: boolean; deviationNote?: string | null };
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
    selectedProtocolVersionIds?: string[]; steps?: StepOption[]; document: ScientificDocument;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const initialPlan = initial.researchPlanId ?? plans[0]?.id ?? "";
  const [planId, setPlanId] = useState(initialPlan);
  const plan = plans.find((item) => item.id === planId);
  const initialSelectedIds = initial.selectedProtocolVersionIds ?? [];
  const [methodMode, setMethodMode] = useState<"protocol" | "custom">(initial.methodMode ?? "protocol");
  const [selectedProtocolCount, setSelectedProtocolCount] = useState(initialSelectedIds.length);
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
  const protocolMethodSummary = initial.id
    ? `${initialSelectedIds.length} locked ProtocolVersion(s)`
    : selectedProtocolCount
      ? `${selectedProtocolCount} ProtocolVersion(s) selected · locks on Save`
      : "Select ProtocolVersion(s)";
  const completedStepCount = initial.steps?.filter((step) => step.completed).length ?? 0;

  return <form action={formAction} onKeyDown={preventImplicitEnterSubmit} className="space-y-5">
    {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
    <input type="hidden" name="methodMode" value={activeMethodMode} />
    {lockedPlan ? <input type="hidden" name="researchPlanId" value={planId} /> : null}
    <div className="document-editor-layout">
      <div className="document-editor-main"><ScientificDocumentEditor initialDocument={initial.document} compact documentType="Experiment" identifier={identifier} title={title} titlePlaceholder="Untitled Experiment" subtitle={purpose} hiddenSectionKeys={activeMethodMode === "protocol" ? ["background"] : []} headerFacts={[
        { label: "Research Plan", value: plan ? `${plan.code ?? plan.title} · ${plan.project.name}` : "Not selected" },
        { label: "Method", value: activeMethodMode === "protocol" ? protocolMethodSummary : "Fully custom" },
        { label: "Date", value: date },
        { label: "Execution", value: status.replaceAll("_", " ") },
        { label: "Record", value: recordStatus.replaceAll("_", " ") },
      ]} /></div>
      <aside className="document-editor-sidebar" aria-label="Experiment properties">
    {!initial.id ? <Card><CardHeader title="Protocol association & method source" eyebrow="Choose in execution order; Protocol Steps become the on-bench checklist" /><CardBody className="space-y-5">
      <fieldset className="grid gap-3 md:grid-cols-2"><legend className={formLabelClass}>Planning mode</legend>
        <label className={`mt-2 flex cursor-pointer items-start gap-3 rounded-[9px] border px-3 py-3 ${methodMode === "protocol" ? "border-moss bg-sage-surface" : "border-hairline bg-warm"}`}><input type="radio" checked={methodMode === "protocol"} onChange={() => setMethodMode("protocol")} className="mt-1 accent-[var(--moss)]" /><span><strong className="block text-sm font-medium text-ink">Plan from Protocol</strong><span className="mt-1 block text-xs leading-5 text-muted">Select one or more exact versions in execution order. Their Steps become the field checklist.</span></span></label>
        <label className={`mt-2 flex cursor-pointer items-start gap-3 rounded-[9px] border px-3 py-3 ${methodMode === "custom" ? "border-moss bg-sage-surface" : "border-hairline bg-warm"}`}><input type="radio" checked={methodMode === "custom"} onChange={() => setMethodMode("custom")} className="mt-1 accent-[var(--moss)]" /><span><strong className="block text-sm font-medium text-ink">Fully custom Experiment</strong><span className="mt-1 block text-xs leading-5 text-muted">No Protocol dependency. Enter your own execution steps instead.</span></span></label>
      </fieldset>
        {methodMode === "protocol" ? <>
        <ExperimentProtocolPicker versions={protocolVersions} initialSelectedIds={initialSelectedIds} onSelectionChange={(ids) => setSelectedProtocolCount(ids.length)} />
        <div className="rounded-[8px] border border-hairline bg-sage-surface/60 px-3 py-3 text-sm text-graphite"><strong className="block font-medium text-ink">One Result report per Experiment</strong><span className="mt-1 block text-xs leading-5 text-muted">Selected Protocols contribute optional report modules. After execution, choose the modules you need; duplicate evidence fields are merged.</span></div>
      </> : <>
        <label className="flex items-start gap-3 rounded-[9px] border border-hairline bg-sage-surface/60 px-3 py-3 text-sm">
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
          <p className="rounded-[8px] border border-hairline bg-warm px-3 py-3 text-xs leading-5 text-muted">No step-by-step checklist for this custom protocol. Run notes will be recorded in a freeform execution log.</p>
        )}
      </>}
    </CardBody></Card> : null}

    <Card><CardHeader title="Experiment identity" eyebrow="Plan a future execution inside one Research Plan" /><CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="md:col-span-2"><span className={formLabelClass}>Research Plan</span>{lockedPlan ? <div className={`${formInputClass} flex items-center bg-stone/50`}>{plan?.project.name} · {plan?.code ?? plan?.title}</div> : <select required name="researchPlanId" value={planId} onChange={(event) => setPlanId(event.target.value)} className={formInputClass}>{plans.map((item) => <option key={item.id} value={item.id}>{item.project.name} · {item.code ?? item.title}</option>)}</select>}</label>
      <RecordCodeField label="Experiment code" prefix="EXP-" name="runCodeSuffix" minimumDigits={3} placeholder="001" value={runCodeSuffix} onValueChange={setRunCodeSuffix} existingCode={initial.id ? initial.runCode : undefined} />
      <label><span className={formLabelClass}>Planned date</span><input required name="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={formInputClass} /></label>
      <label className="md:col-span-2"><span className={formLabelClass}>Title</span><input required name="title" value={title} onChange={(event) => setTitle(event.target.value)} className={formInputClass} /></label>
      <label className="md:col-span-2 xl:col-span-4"><span className={formLabelClass}>Objective / purpose · optional</span><input name="purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="One line: what this planned execution is meant to establish" className={formInputClass} /></label>
      <StatusRadioGroup label="Execution status" name="status" options={experimentStatusOptions} value={status} onValueChange={setStatus} required className="md:col-span-2" />
      <StatusRadioGroup label="Record status" name="recordStatus" options={recordStatusOptions} value={recordStatus} onValueChange={setRecordStatus} required className="md:col-span-2" />
      <label className="md:col-span-2 xl:col-span-4"><TagFieldLabel /><input name="tags" defaultValue={(initial.tags ?? []).join(", ")} placeholder="RNA, qPCR, imaging" className={formInputClass} /></label>
    </CardBody></Card>

    {initial.id && initial.steps?.length ? <Card>
      <CardHeader title="Execution record" eyebrow="Update completion and notes from run mode" action={<Link href={`/experiments/${initial.id}/run`} className="inline-flex h-9 items-center rounded-[8px] border border-hairline bg-surface px-3 py-1 text-xs font-medium text-moss hover:bg-warm">Open run mode</Link>} />
      <CardBody className="space-y-2 text-sm leading-6 text-graphite">{completedStepCount}/{initial.steps.length} executed steps · {initial.steps.filter((step) => Boolean(step.deviationNote)).length} deviations</CardBody>
    </Card> : null}
      </aside>
    </div>
    <div className="document-editor-save-bar sticky bottom-4 z-20 flex flex-wrap items-center justify-end gap-3">
      {state.error ? <p role="alert" className="max-w-xl rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error shadow-soft">{state.error}</p> : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending || !plans.length || (!initial.id && methodMode === "protocol" && !selectedProtocolCount)} className="shadow-soft">{pending ? "Saving…" : "Save Experiment"}</Button>
    </div>
  </form>;
}
