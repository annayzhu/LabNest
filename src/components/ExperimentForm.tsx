"use client";

import { useActionState, useMemo, useState } from "react";
import { ScientificDocumentEditor } from "@/components/ScientificDocumentEditor";
import { RecordCodeField } from "@/components/RecordCodeField";
import { TagFieldLabel } from "@/components/TagFieldLabel";
import { formInputClass, formLabelClass } from "@/components/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import type { ScientificDocument } from "@/lib/scientific-document";
import { experimentStatusOptions, recordStatusOptions } from "@/lib/status-options";

type ProtocolVersionOption = { id: string; displayVersion: string; reviewStage: string; protocol: { id: string; humanCode: string | null; title: string; scope: string } };
type PlanOption = { id: string; code: string | null; title: string; project: { name: string }; protocols: ProtocolVersionOption[] };
type StepOption = { id: string; order: number; title: string; description: string; completed: boolean };
export type ExperimentFormState = { error?: string };
export type ExperimentFormAction = (
  previousState: ExperimentFormState,
  formData: FormData,
) => Promise<ExperimentFormState>;

const initialState: ExperimentFormState = {};

export function ExperimentForm({ action, plans, initial, lockedPlan = false }: {
  action: ExperimentFormAction;
  plans: PlanOption[];
  lockedPlan?: boolean;
  initial: {
    id?: string; researchPlanId?: string; runCode?: string | null; suggestedCodeSuffix?: string; title?: string; date?: string; status?: string; recordStatus?: string;
    purpose?: string | null; tags?: string[];
    primaryProtocolVersionId?: string | null; supportingProtocolVersionIds?: string[]; steps?: StepOption[]; document: ScientificDocument;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const initialPlan = initial.researchPlanId ?? plans[0]?.id ?? "";
  const [planId, setPlanId] = useState(initialPlan);
  const plan = plans.find((item) => item.id === planId);
  const defaultPrimary = initial.primaryProtocolVersionId ?? plan?.protocols[0]?.id ?? "";
  const [primaryVersionId, setPrimaryVersionId] = useState(defaultPrimary);
  const [title, setTitle] = useState(initial.title ?? "");
  const [runCodeSuffix, setRunCodeSuffix] = useState(initial.suggestedCodeSuffix ?? "");
  const [date, setDate] = useState(initial.date ?? new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState(initial.status ?? "planned");
  const [recordStatus, setRecordStatus] = useState(initial.recordStatus ?? "draft");
  const [purpose, setPurpose] = useState(initial.purpose ?? "");
  const versions = useMemo(() => plan?.protocols ?? [], [plan]);
  const supporting = new Set(initial.supportingProtocolVersionIds ?? []);
  const identifier = initial.runCode ?? (runCodeSuffix ? `EXP-${runCodeSuffix}` : "Draft Experiment");

  return <form action={formAction} className="space-y-5">
    {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
    {lockedPlan ? <input type="hidden" name="researchPlanId" value={planId} /> : null}
    <div className="document-editor-layout">
      <div className="document-editor-main"><ScientificDocumentEditor initialDocument={initial.document} compact documentType="Experiment" identifier={identifier} title={title} titlePlaceholder="Untitled Experiment" subtitle={purpose} headerFacts={[
        { label: "Research Plan", value: plan ? `${plan.code ?? plan.title} · ${plan.project.name}` : "Not selected" },
        { label: "Date", value: date },
        { label: "Execution", value: status.replaceAll("_", " ") },
        { label: "Record", value: recordStatus.replaceAll("_", " ") },
      ]} /></div>
      <aside className="document-editor-sidebar" aria-label="Experiment properties">
    <Card><CardHeader title="Experiment identity" eyebrow="One execution inside one Research Plan" /><CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="md:col-span-2"><span className={formLabelClass}>Research Plan</span>{lockedPlan ? <div className={`${formInputClass} flex items-center bg-stone/50`}>{plan?.project.name} · {plan?.code ?? plan?.title}</div> : <select required name="researchPlanId" value={planId} onChange={(event) => { const next = event.target.value; const nextPlan = plans.find((item) => item.id === next); setPlanId(next); setPrimaryVersionId(nextPlan?.protocols[0]?.id ?? ""); }} className={formInputClass}>{plans.map((item) => <option key={item.id} value={item.id}>{item.project.name} · {item.code ?? item.title}</option>)}</select>}</label>
      <RecordCodeField label="Experiment code" prefix="EXP-" name="runCodeSuffix" minimumDigits={3} placeholder="001" value={runCodeSuffix} onValueChange={setRunCodeSuffix} existingCode={initial.id ? initial.runCode : undefined} />
      <label><span className={formLabelClass}>Date</span><input required name="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={formInputClass} /></label>
      <label className="md:col-span-2"><span className={formLabelClass}>Title</span><input required name="title" value={title} onChange={(event) => setTitle(event.target.value)} className={formInputClass} /></label>
      <label className="md:col-span-2 xl:col-span-4"><span className={formLabelClass}>Purpose</span><input name="purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="One line: what this execution is meant to establish" className={formInputClass} /></label>
      <StatusRadioGroup label="Execution status" name="status" options={experimentStatusOptions} value={status} onValueChange={setStatus} required className="md:col-span-2" />
      <StatusRadioGroup label="Record status" name="recordStatus" options={recordStatusOptions} value={recordStatus} onValueChange={setRecordStatus} required className="md:col-span-2" />
      <label className="md:col-span-2 xl:col-span-4"><TagFieldLabel /><input name="tags" defaultValue={(initial.tags ?? []).join(", ")} placeholder="RNA, qPCR, imaging" className={formInputClass} /></label>
    </CardBody></Card>

    {!initial.id ? <Card><CardHeader title="ProtocolVersion lock" eyebrow="The source is snapshotted when this Experiment is created" /><CardBody className="space-y-4">
      {versions.length ? <><label className="block"><span className={formLabelClass}>Primary ProtocolVersion</span><select required name="primaryProtocolVersionId" value={primaryVersionId} onChange={(event) => setPrimaryVersionId(event.target.value)} className={formInputClass}>{versions.map((version) => <option key={version.id} value={version.id}>{version.protocol.humanCode ?? version.protocol.title} · {version.displayVersion} · {version.reviewStage}</option>)}</select></label>
      <div><p className={formLabelClass}>Supporting ProtocolVersions</p><div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{versions.filter((version) => version.id !== primaryVersionId).map((version) => <label key={version.id} className="flex gap-3 rounded-[8px] border border-hairline bg-warm px-3 py-3 text-sm text-graphite"><input type="checkbox" name="supportingProtocolVersionIds" value={version.id} defaultChecked={supporting.has(version.id)} /><span>{version.protocol.humanCode ?? version.protocol.title} · {version.displayVersion}</span></label>)}</div></div>
      <label className="flex items-start gap-3 rounded-[8px] border border-hairline bg-sage-surface/60 px-3 py-3 text-sm text-graphite"><input type="checkbox" name="createResultTemplates" defaultChecked /><span><strong className="block font-medium text-ink">Register result templates</strong>Create draft Result records defined by the primary ProtocolVersion; no measurements are fabricated.</span></label></> : <p className="rounded-[8px] border border-warning/30 bg-warning-surface p-3 text-sm text-warning">This Research Plan has no associated Protocol with a version. Edit the plan and associate a Protocol before creating an Experiment.</p>}
    </CardBody></Card> : null}

    {initial.steps?.length ? <Card><CardHeader title="Protocol steps" eyebrow="Execution checklist copied from the locked version" /><CardBody className="space-y-2">{initial.steps.map((step) => <label key={step.id} className="flex items-start gap-3 rounded-[8px] border border-hairline bg-warm px-3 py-3 text-sm text-graphite"><input type="checkbox" name="completedStepIds" value={step.id} defaultChecked={step.completed} className="mt-1" /><span><strong className="block font-medium text-ink">{step.order}. {step.title}</strong>{step.description}</span></label>)}</CardBody></Card> : null}
      </aside>
    </div>
    <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-end gap-3">
      {state.error ? <p role="alert" className="max-w-xl rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error shadow-soft">{state.error}</p> : null}
      <button type="submit" disabled={pending || (!initial.id && !versions.length)} className="focus-ring h-11 rounded-[8px] border border-moss bg-moss px-5 text-sm font-medium text-warm shadow-soft disabled:cursor-wait disabled:opacity-50">{pending ? "Saving…" : "Save Experiment"}</button>
    </div>
  </form>;
}
