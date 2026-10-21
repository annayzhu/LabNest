"use client";

import { experimentExecutionDocument } from "@/lib/experiment-document";
import { ExecutionRecordPreview } from "./ExecutionRecordPreview";
import { ExecutionRecordBlocks, ExecutionRecordProvider } from "./ExecutionRecordSteps";
import { isRecordLocked } from "@/lib/record-lifecycle";
import { newClientMutationId } from "@/lib/client-mutation-id";
import { runProgressFromSource, structuredRunView } from '@/lib/structured-run';
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
import { Disclosure } from "@/components/ui/Disclosure";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import type { ScientificDocument } from "@/lib/scientific-document";
import { experimentStatusOptions, recordStatusOptions } from "@/lib/status-options";

type PlanOption = { id: string; code: string | null; title: string; project: { name: string } };
type StepOption = { evidence?: ScientificDocument["sections"][number]["blocks"]; groupOrder?:number;groupTitle?:string;deviationType?:string|null;deviationImpact?:string|null;deviationAuthor?:string|null; id: string; order: number; title: string; description: string; completed: boolean; deviationNote?: string | null; groupKey?: string; protocolStepRef?: string | null };
export type ExperimentFormState = { error?: string };
export type ExperimentFormAction = (
  previousState: ExperimentFormState,
  formData: FormData,
) => Promise<ExperimentFormState>;

const initialState: ExperimentFormState = {};

export function ExperimentForm({ intro, action, plans, protocolVersions = [], initial, lockedPlan = false }: {
  /** One line at the top of the metadata drawer: where this Experiment comes from and what to do first. */
  intro?: string;
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
  // Follows the saved status (a step checked on this page may start the run) until the author picks one.
  const [statusChoice, setStatus] = useState<string | null>(null);
  const status = statusChoice ?? initial.status ?? "planned";
  const [recordStatus, setRecordStatus] = useState(initial.recordStatus ?? "draft");
  const [purpose, setPurpose] = useState(initial.purpose ?? "");
  const [customChecklistEnabled, setCustomChecklistEnabled] = useState(false);
  const statusSummary = `${status} · ${recordStatus}`;
  const identifier = initial.runCode ?? (runCodeSuffix ? `EXP-${runCodeSuffix}` : "Draft Experiment");
  const lockedMethodMode = initialSelectedIds.length ? "protocol" : "custom";
  const activeMethodMode = initial.id ? lockedMethodMode : methodMode;
  const selectedVersions=selectedIds.map(id=>protocolVersions.find(version=>version.id===id)).filter(version=>!!version);
  const executionUnconfirmed=selectedVersions.some(version=>version.execution?.executionNeedsReview) || (selectedVersions.length>0 && selectedVersions.every(version=>version.execution && !version.execution.steps.length));
  const structuredRun = initial.id ? structuredRunView(initial.protocolSnapshotJson, initial.executionPlan, []) : undefined;
  const structuredExecution = structuredRun ? structuredRun.hasSystems : selectedVersions.some(version => version.hasSystems);
  const stepProgress = runProgressFromSource(initial.protocolSnapshotJson, initial.executionPlan, initial.steps?.map(step => ({ ...step, groupKey: step.groupKey ?? "manual", protocolStepRef: step.protocolStepRef ?? null })) ?? []);
  // A saved Experiment's run, as in the record: steps are checked and deviations recorded one at a time, apart from this form.
  const runRecord = initial.id && initial.steps?.length ? experimentExecutionDocument(undefined, initial.steps.map(step => ({ ...step, groupOrder: step.groupOrder ?? 0, groupTitle: step.groupTitle ?? "步骤" })), initial.executionParameters, initial.protocolSnapshotJson, initial.executionPlan) : undefined;
  const recordBlocks = (key: string) => runRecord?.sections.find(section => section.key === key)?.blocks.filter(block => block.id.startsWith("run-derived:")) ?? [];
  const runControls = initial.id ? { experimentId: initial.id, revision: structuredRun?.plan.revision, editable: !isRecordLocked(initial.recordStatus ?? "draft") && initial.status !== "archived" && !(structuredExecution && initial.status === "completed") } : undefined;
  const runAddons = runControls && runRecord ? Object.fromEntries(["execution", "deviations"].flatMap(key => recordBlocks(key).length ? [[key, <ExecutionRecordProvider key={key} value={runControls}><ExecutionRecordBlocks blocks={recordBlocks(key)} /></ExecutionRecordProvider>]] : [])) : undefined;
  const executionPreview = !initial.id && methodMode === "protocol" && selectedVersions.some(version => version.execution)
    ? <ExecutionRecordPreview protocols={selectedVersions.flatMap(version => version.execution ? [{ id: version.id, title: version.protocol.title, displayVersion: version.displayVersion, editHref: `/protocols/${version.protocol.id}/versions/${version.id}/edit`, execution: version.execution }] : [])} />
    : null;

  return <form inert={pending} aria-busy={pending} action={formAction} onKeyDown={preventImplicitEnterSubmit} className="space-y-5">
    {!initial.id?<input type="hidden" name="creationKey" value={creationKey}/>:null}
    {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
    {initial.updatedAt ? <input type="hidden" name="expectedUpdatedAt" value={new Date(initial.updatedAt).toISOString()} /> : null}
    <input type="hidden" name="methodMode" value={activeMethodMode} />
    {lockedPlan ? <input type="hidden" name="researchPlanId" value={planId} /> : null}
    <DocumentEditorLayout initialView={initial.id ? "document" : "metadata"}>
      <div className="document-editor-main"><ScientificDocumentEditor initialDocument={initial.document} compact sectionAddons={executionPreview ? { execution: executionPreview } : runAddons} documentType="Experiment" identifier={identifier} title={title} titlePlaceholder="Untitled Experiment" titleEditor={<input required value={title} onChange={(event) => setTitle(event.target.value)} className="document-page-title-input" placeholder="Untitled Experiment" aria-label="Experiment title" />} subtitle={purpose} hiddenSectionKeys={activeMethodMode === "protocol" ? ["background"] : []} headerFacts={[
        { label: "Plan", value: plan?.title ?? "No plan chosen" },
        { label: "Experiment date", value: date || "Not set" },
      ]} /></div>
      <aside className="document-editor-sidebar" data-document-metadata="true" aria-label="Experiment metadata">
      {intro ? <p className="ln-form-intro">{intro}</p> : null}
      <label className="block"><span className={formLabelClass}>Plan</span>{lockedPlan ? <div className={`${formInputClass} flex items-center bg-stone/50`}>{plan ? `${plan.project.name} · ${plan.title}` : "No plan chosen"}</div> : <select name="researchPlanId" value={planId} onChange={(event) => setPlanId(event.target.value)} className={formInputClass}><option value="">No plan chosen</option>{plans.map((item) => <option key={item.id} value={item.id}>{item.project.name} · {item.title}</option>)}</select>}{!lockedPlan && !planId ? <span className="mt-1 block text-xs leading-5 text-muted">You can leave it empty and choose a plan later in the metadata; the experiment then also joins that plan’s project.</span> : null}</label>
    {!initial.id ? <section className="ln-method-source space-y-2 border-b border-hairline py-3" aria-label="Method source"><div className="flex items-center justify-between gap-3"><h3 className={`${formLabelClass} shrink-0 whitespace-nowrap`}>Method source</h3>
      <div className="ln-segmented" role="group" aria-label="Method source">
        <button type="button" aria-pressed={methodMode === "protocol"} onClick={() => setMethodMode("protocol")} className="focus-ring">Follow a Protocol</button>
        <button type="button" aria-pressed={methodMode === "custom"} onClick={() => setMethodMode("custom")} className="focus-ring">Write my own steps</button>
      </div></div>
        {methodMode === "protocol" ? <>
        <ExperimentProtocolPicker versions={[...protocolVersions].sort((a,b)=>Number(b.researchPlanIds?.includes(planId)??false)-Number(a.researchPlanIds?.includes(planId)??false))} initialSelectedIds={initialSelectedIds} onSelectionChange={setSelectedIds} />
      </> : <>
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={customChecklistEnabled}
            onChange={(event) => setCustomChecklistEnabled(event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--moss)]"
          />
          <span><span className="font-medium text-ink">Tick off step by step during the run</span><span className="mt-0.5 block text-xs leading-5 text-muted">When ticked, each line below becomes a step to tick off during the run.</span></span>
        </label>
        {customChecklistEnabled ? (
          <label className="block"><span className={formLabelClass}>Steps · one per line</span><textarea name="customSteps" className={`${formTextareaClass} min-h-32`} placeholder={"Seed cells | 2.0 × 10^5 cells per well\nIncubate overnight\nImage | 20× objective"} /><span className="mt-1 block text-xs leading-5 text-muted">After a vertical bar, add a note for that step.</span></label>
        ) : null}
      </>}
    </section> : null}

    <section className="border-b border-hairline py-3">
      <input type="hidden" name="title" value={title} />
      <div className="grid gap-3">
      <label><span className={formLabelClass}>Planned date</span><input required name="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={formInputClass} /></label>
      </div>
    </section>
    <Disclosure title="Purpose" summary={purpose.trim() || "One line: what this run should establish"} defaultOpen={Boolean(purpose.trim())}>
      <label><span className={formLabelClass}>Objective / purpose · optional</span><input name="purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="One line: what this planned execution is meant to establish" className={formInputClass} /></label>
    </Disclosure>
    <Disclosure title="Code, status and tags" summary={`EXP-${runCodeSuffix} · ${statusSummary}`}>
      <RecordCodeField label="Experiment code" prefix="EXP-" name="runCodeSuffix" minimumDigits={3} placeholder="001" value={runCodeSuffix} onValueChange={setRunCodeSuffix} existingCode={initial.id ? initial.runCode : undefined} />
      {structuredExecution ? <div><input type="hidden" name="status" value={initial.id ? initial.status : 'planned'}/><p>Execution status · {initial.id ? initial.status : 'planned'}</p><p className="text-xs text-muted">The execution status follows what is done in Run.</p></div> : <StatusRadioGroup label="Execution status" name="status" options={experimentStatusOptions} value={status} onValueChange={setStatus} required />}
      <StatusRadioGroup label="Record status" name="recordStatus" options={recordStatusOptions} value={recordStatus} onValueChange={setRecordStatus} required />
      <label><TagFieldLabel /><input name="tags" defaultValue={(initial.tags ?? []).join(", ")} placeholder="RNA, qPCR, imaging" className={formInputClass} /></label>
    </Disclosure>

    {initial.id && initial.steps?.length ? <Card>
      <CardHeader title="Execution record" eyebrow="Update completion and notes from run mode" action={<Link href={`/experiments/${initial.id}/run`} className="inline-flex h-9 items-center rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface px-3 py-1 text-xs font-medium text-moss hover:bg-warm">Open run mode</Link>} />
      <CardBody className="space-y-2 text-sm leading-6 text-graphite">{stepProgress.done}/{stepProgress.total} executed steps · {initial.steps.filter((step) => Boolean(step.deviationNote)).length} deviations</CardBody>
    </Card> : null}
      </aside>
    </DocumentEditorLayout>
    <div className="document-editor-save-bar sticky bottom-4 z-20 flex flex-wrap items-center justify-end gap-3">
      {state.error ? <p role="alert" className="max-w-xl rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error shadow-soft">{state.error}</p> : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending || (!initial.id && methodMode === "protocol" && (!selectedIds.length || executionUnconfirmed))} aria-busy={pending} className="shadow-soft">{pending ? "Saving…" : "Save Experiment"}</Button>
    </div>
  </form>;
}
