"use client";

import { useRunStepSelection } from "./RunStepSelection";
import { MobileMeasurementCapture } from "@/components/MobileMeasurementCapture";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { OfflineCalculator } from "@/components/calculators/OfflineCalculator";
import { ProtocolContentBlockView } from "@/components/ProtocolDocumentView";
import { newClientMutationId } from "@/lib/client-mutation-id";

import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Circle, Play, Save, X } from "lucide-react";
import { useActionState, useEffect, useMemo, useState, useRef } from "react";
import { saveProtocolRunProgress, type ProtocolRunProgressState } from "@/app/experiments/[id]/run/actions";
import { formLabelClass, formTextareaClass } from "@/components/forms";
import { buttonStyles } from "@/components/ui/Button";
import { StepCalculator } from "@/components/calculators/StepCalculator";
import { StepTimerControls } from "@/components/StepTimerControls";
import type { StructuredRunView } from '@/lib/structured-run';
import { StructuredStepRecord } from './StructuredStepRecord';
import { ChipRenderContext, type ChipRender } from './protocol/ChipText';
import './protocol/protocol.css';
import { experimentStepGroupHeading } from "@/lib/experiment-planning";
import { useQueuedRunRecords } from "./useQueuedRunRecords";
import { enqueueMobileMutation, runQueueContext } from "@/lib/mobile-mutation-queue";

type RunStep = {
  protocolStepRef?: string | null;
  /** `chipVersion` names the resolved version whose adopted values its chips show. */
  richContent?: Omit<ReturnType<typeof import("@/lib/run-step-content").runStepContent>, "reference"> & { chipVersion?: string; derivedTitle?: boolean };
  id: string;
  groupKey: string;
  groupTitle: string;
  groupOrder: number;
  order: number;
  title: string;
  description: string;
  requiresConfirmation: boolean;
  allowsDeviation: boolean;
  completed: boolean;
  deviationNote: string | null;
  deviationType: string | null;
  deviationImpact: string | null;
  deviationAuthor: string | null;
  timerDurationSeconds: number | null;
  timerRemainingSeconds: number | null;
  timerStartedAt: Date | null;
  timerPausedAt: Date | null;
};

const initialState: ProtocolRunProgressState = {};
const secondaryButton = buttonStyles({ size: "lg", className: "bg-surface font-medium text-moss hover:bg-warm disabled:cursor-wait disabled:opacity-50" });
const primaryButton = buttonStyles({ variant: "primary", size: "lg", className: "font-medium disabled:cursor-wait disabled:opacity-50" });
const fieldClass = `${formTextareaClass} bg-surface`;

export function ProtocolRunProgressForm({ experimentId, status, steps, editable, evidenceByStep, frozenReferences, frozenReferenceTitles, protocolBased=false, structured, chipContexts = {} }: {
  structured?: Pick<StructuredRunView, 'steps' | 'plan'>;
  chipContexts?: Record<string, ChipRender>;
  experimentId: string;
  status: string;
  steps: RunStep[];
  editable: boolean;
  protocolBased?:boolean;
  frozenReferenceTitles?:Record<string,string>;
  frozenReferences?: Record<string, ReturnType<typeof import("@/lib/run-step-content").runStepContent>["reference"]>;
  evidenceByStep?: Record<string, { observations: number; measurements: number; files: number; consumptions: number }>;
}) {
  const { locale } = useI18n();
  const zh = locale === "zh";
  const queued = useQueuedRunRecords(experimentId);
  const pendingCompletions = new Set(queued.filter(item => item.actionType === "step.complete").map(item => item.payload.experimentStepId));
  const formRef=useRef<HTMLFormElement>(null);
  const [draftFields,setDraftFields]=useState<Record<string,string>>({});
  const draftInitialized=useRef(false);
  const [draftReady,setDraftReady]=useState(false);
  const [draftNotice,setDraftNotice]=useState("");
  const [olderDraft, setOlderDraft] = useState<Record<string,string> | null>(null);
  const [completedIds, setCompletedIds] = useState(() => new Set(steps.filter((step) => step.completed).map((step) => step.id)));
  const {selectedStepId, setSelectedStepId} = useRunStepSelection();
  const [state, formAction, pending] = useActionState(async (previous: ProtocolRunProgressState, data: FormData) => {
    const result = await saveProtocolRunProgress(previous, data);
    if (!result.error && result.completedStepIds) {
      const saved = new Set(result.completedStepIds);
      setCompletedIds(saved);
      setDraftFields({});setOlderDraft(null);try{sessionStorage.removeItem(`labnest.run-draft:${experimentId}`);}catch{};setDraftNotice("");
      if (result.completedCurrentStepId) {
        const next = steps.find((step) => !saved.has(step.id));
        if (next) setSelectedStepId(next.id);
      }
    }
    return result;
  }, initialState);
  const groups = useMemo(() => {
    const grouped = new Map<string, { key: string; title: string; order: number; steps: RunStep[] }>();
    for (const step of steps) {
      const key = structured?.plan.stepGroups[step.id] ? `${step.groupKey}@${structured.plan.stepGroups[step.id]}` : step.groupKey;
      const group = grouped.get(key) ?? { key, title: step.groupTitle, order: step.groupOrder, steps: [] };
      group.steps.push(step);
      grouped.set(key, group);
    }
    return [...grouped.values()].sort((a, b) => a.order - b.order);
  }, [steps, structured]);
  const referenceGroups=Object.keys(frozenReferences??{}).map(key=>({key,title:groups.find(group=>group.key===key)?.title??frozenReferenceTitles?.[key]??"Captured Protocol reference"}));
  const requiredSteps = steps.filter(s => !structured?.steps[s.id]?.optional);
  const requiredCompleted = requiredSteps.filter(s => completedIds.has(s.id)).length;
  const remaining = requiredSteps.length - requiredCompleted;
  const unavailable = (id: string) => Boolean(pendingCompletions.has(id) || structured?.steps[id]?.blocked || structured?.plan.skips[id] || structured?.steps[id]?.actualFields.some(f => f.required && !structured.plan.actualValues[id]?.[f.id] && !queued.some(item => item.actionType === "step.record" && item.state !== "conflict" && item.payload.experimentStepId === id && item.payload.intent === "actual" && item.payload.values[f.id])));
  const hasSteps = steps.length > 0;
  const currentStep = steps.find((step) => !completedIds.has(step.id));
  useEffect(()=>{const restore=()=>{const id=decodeURIComponent(window.location.hash.replace(/^#step-/,''));if(steps.some(step=>step.id===id))setSelectedStepId(id);};const frame=requestAnimationFrame(restore);window.addEventListener('hashchange',restore);return()=>{cancelAnimationFrame(frame);window.removeEventListener('hashchange',restore);};},[steps,setSelectedStepId]);
  const [recordOpen,setRecordOpen]=useState(false);
  const [allStepsOpen, setAllStepsOpen] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState("");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const selectedStep = steps.find((step) => step.id === selectedStepId) ?? currentStep ?? steps[0];
  useEffect(()=>{
    if(draftInitialized.current)return;draftInitialized.current=true;
    const frame=requestAnimationFrame(()=>{try{const saved=JSON.parse(sessionStorage.getItem(`labnest.run-draft:${experimentId}`)??'null');if(saved){if (structured && saved.revision !== structured.plan.revision) { if (Object.keys(saved.fields ?? {}).length) { setOlderDraft(saved.fields); setDraftNotice('执行记录已更新，旧草稿保留供核对。'); } } else { setDraftFields(saved.fields??{}); if(Array.isArray(saved.completed))setCompletedIds(new Set(saved.completed.filter((id:string)=>steps.some(s=>s.id===id)))); } if(steps.some(s=>s.id===saved.selectedStepId)&&!window.location.hash)setSelectedStepId(saved.selectedStepId);window.scrollTo(0,saved.scrollY??0);if(Object.keys(saved.fields??{}).length && (!structured || saved.revision === structured.plan.revision))setDraftNotice('Unsaved draft restored');}}catch{setDraftNotice('Draft storage unavailable');}setDraftReady(true);});
    return()=>cancelAnimationFrame(frame);
  },[experimentId,steps,structured,setSelectedStepId]);
  useEffect(()=>{
    if(!draftReady)return;
    const preserve=()=>{try{sessionStorage.setItem(`labnest.run-draft:${experimentId}`,JSON.stringify({revision:olderDraft ? -1 : structured?.plan.revision,fields:olderDraft ?? draftFields,selectedStepId,completed:[...completedIds],scrollY:window.scrollY}));}catch{setDraftNotice('Cannot save draft; keep this page');}};
    preserve();window.addEventListener('pagehide',preserve);window.addEventListener('labnest:preserve-run-draft',preserve);
    return()=>{window.removeEventListener('pagehide',preserve);window.removeEventListener('labnest:preserve-run-draft',preserve);};
  },[experimentId,selectedStepId,completedIds,draftFields,draftReady,structured,olderDraft]);
  const selectedStepIndex = selectedStep ? steps.findIndex((step) => step.id === selectedStep.id) : -1;
  const evidence = selectedStep && evidenceByStep ? evidenceByStep[selectedStep.id] : undefined;
  const evidenceTotals = Object.values(evidenceByStep ?? {}).reduce((total, item) => ({
    observations: total.observations + item.observations,
    measurements: total.measurements + item.measurements,
    files: total.files + item.files,
    consumptions: total.consumptions + item.consumptions,
  }), { observations: 0, measurements: 0, files: 0, consumptions: 0 });
  const totalEvidence = Object.values(evidenceTotals).reduce((sum, count) => sum + count, 0);

  function prepareMutation(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const mutationInput = form.elements.namedItem("clientMutationId") as HTMLInputElement | null;
    const createdInput = form.elements.namedItem("deviceCreatedAt") as HTMLInputElement | null;
    let clientMutationId: string;
    try { clientMutationId = newClientMutationId(); }
    catch (error) { event.preventDefault(); setOfflineStatus(error instanceof Error ? error.message : "Record ID could not be created."); return; }
    const deviceCreatedAt = new Date().toISOString();
    if (mutationInput) mutationInput.value = clientMutationId;
    if (createdInput) createdInput.value = deviceCreatedAt;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const stepId = submitter?.name === "completedCurrentStepId" ? submitter.value : "";
    if (navigator.onLine || !stepId) return;
    event.preventDefault();
    const data = new FormData(form);
    const optional = (name: string) => String(data.get(name) ?? "").trim() || undefined;
    let queueContext;
    try { queueContext = runQueueContext(steps.find(step => step.id === stepId)?.protocolStepRef ?? stepId); } catch { setOfflineStatus("本机存储不可用，未保存。请保留页面。"); return; }
    void enqueueMobileMutation({
      clientMutationId,
      actionType: "step.complete",
      deviceCreatedAt,
      state: "pending",
      retryCount: 0,
      payload: {
        experimentId,
        experimentStepId: stepId,
        executionPlanRevision: structured?.plan.revision,
        queueContext,
        deviationType: optional(`mobileDeviationType:${stepId}`),
        deviationNote: optional(`mobileDeviation:${stepId}`),
        deviationImpact: optional(`mobileDeviationImpact:${stepId}`),
        deviationAuthor: optional(`mobileDeviationAuthor:${stepId}`),
      },
    }).then(() => {
      setStep(stepId, true);
      const nextStep = steps.find((step) => step.id !== stepId && !completedIds.has(step.id));
      if (nextStep) setSelectedStepId(nextStep.id);
      setOfflineStatus("Step saved on this device · waiting to sync.");
    }).catch((error) => setOfflineStatus(error instanceof Error ? error.message : "Step could not be saved on this device."));
  }

  function setStep(id: string, checked: boolean) {
    setCompletedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function setGroup(groupSteps: RunStep[], checked: boolean) {
    setCompletedIds((current) => {
      const next = new Set(current);
      for (const step of groupSteps) {
        if (checked) next.add(step.id); else next.delete(step.id);
      }
      return next;
    });
  }

  const information = new Map<string, {step: RunStep; labels: string[]}>();
  for (const step of steps.filter(step => step.richContent?.common.length)) {
    const key = `${step.groupKey}:${JSON.stringify(step.richContent?.common)}`;
    const item = information.get(key) ?? {step, labels: []};
    const label = structured?.steps[step.id]?.groupLabel ?? step.groupTitle;
    if (!item.labels.includes(label)) item.labels.push(label);
    information.set(key, item);
  }
  return <form id="run-execution" ref={formRef} action={formAction} onSubmit={prepareMutation} className="space-y-4">
    <input type="hidden" name="experimentId" value={experimentId} />
    {structured ? <input type="hidden" name="executionPlanRevision" value={structured.plan.revision}/> : null}
    {queued.length ? <p role="status" className="text-warning">本机待同步 {queued.length} 条，其中冲突 {queued.filter(item => item.state === "conflict").length} 条。下方完成计数尚未代表全部已同步。</p> : null}
    {structured ? <p role="status" data-structured-progress>必需操作：{requiredCompleted}/{requiredSteps.length} 完成 · 可选：{steps.filter(s => structured.steps[s.id]?.optional && completedIds.has(s.id)).length}/{steps.filter(s => structured.steps[s.id]?.optional).length} · 跳过：{Object.keys(structured.plan.skips).length} · 待确定：{steps.filter(s => structured.steps[s.id]?.blocked).length}</p> : null}
    <input type="hidden" name="clientMutationId" />
    <input type="hidden" name="deviceCreatedAt" />
    {olderDraft ? <aside className="m-3 border border-warning p-3" role="status"><p>执行记录已更新。请核对服务器记录与旧草稿，再决定是否继续使用。</p><details><summary>查看旧草稿</summary>{Object.entries(olderDraft).map(([key,value]) => <p key={key} className="whitespace-pre-wrap">{value}</p>)}</details><button type="button" className="focus-ring min-h-11 text-moss" onClick={() => { setDraftFields(olderDraft); setOlderDraft(null); setDraftNotice('已恢复核对后的草稿，尚未保存'); }}>已核对，继续使用这些草稿</button></aside> : null}
    {[...completedIds].map((id) => <input key={`mobile-completed-${id}`} type="hidden" name="completedStepIds" value={id} />)}

    {[...information.entries()].map(([key,{step,labels}])=><details open key={key} className="min-w-0 rounded-[var(--ln-radius-panel)] border border-hairline p-3" data-run-information><summary className="focus-ring min-h-11 cursor-pointer text-sm text-moss">共同参考（不计步） · {labels.join('、')}</summary><div className="mt-3 min-w-0 space-y-3">{step.richContent?.common.map(block=><ProtocolContentBlockView key={block.id} block={block} executionContext/>)}</div></details>)}
    <section className="overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface lg:hidden">
      <div className="border-b border-hairline px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-xs text-muted">
          <span>{hasSteps ? zh ? `第${selectedStepIndex+1}/${steps.length}步 · 已完成${completedIds.size}步` : `${completedIds.size} of ${steps.length} complete` : "No fixed steps"}</span>
          {!zh ? <span>{selectedStep ? `Step ${selectedStepIndex + 1}` : "Ready to finish"}</span> : null}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone">
          <div className="h-full rounded-full bg-moss transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${requiredSteps.length ? Math.round((requiredCompleted / requiredSteps.length) * 100) : 0}%` }} />
        </div>
      </div>

      {draftNotice?<p role="status" className="text-xs text-warning">{draftNotice}</p>:null}
      {selectedStep ? (
        <div className="p-4">
          {groups.length>1 ? <p className="text-xs text-muted">{experimentStepGroupHeading(selectedStep.groupTitle).title}</p> : null}
          {selectedStep.richContent?.derivedTitle ? <p className="mt-1 font-mono text-xs text-muted">{completedIds.has(selectedStep.id)?"✓ ":""}{zh ? `第 ${selectedStepIndex + 1} 步` : `Step ${selectedStepIndex + 1}`}</p> : <h3 className="mt-1 text-base font-semibold leading-6 text-ink">{completedIds.has(selectedStep.id)?"✓ ":""}{selectedStep.title}</h3>}

          <div className="run-step-content mt-3 min-w-0 space-y-3" data-run-step-content><ChipRenderContext.Provider value={chipContexts[selectedStep.richContent?.chipVersion ?? ''] ?? null}>{selectedStep.richContent?.blocks.length?selectedStep.richContent.blocks.map(block=><ProtocolContentBlockView key={block.id} block={block} executionContext/>):<><p className="whitespace-pre-wrap text-base leading-7 text-graphite">{selectedStep.description}</p>{selectedStep.richContent?.source === "legacy-text" ? <p className="text-xs text-warning">{zh ? "此旧步骤的完整格式尚未确认，可查看规程参考。" : "Full formatting for this older step is unverified. See Protocol reference."}</p> : null}</>}</ChipRenderContext.Provider></div>
          <div data-run-tools className="mt-3 grid grid-cols-2 min-[360px]:grid-cols-3 gap-2">{editable ? <StepCalculator experimentId={experimentId} stepId={selectedStep.id} /> : null}
          <StepTimerControls compact key={selectedStep.id} experimentId={experimentId} step={selectedStep} executionPlanRevision={structured?.plan.revision} disabled={!editable || Boolean(structured?.steps[selectedStep.id] && (selectedStep.completed || structured.steps[selectedStep.id].blocked))}/>
          <button type="button" aria-expanded={recordOpen} onClick={()=>setRecordOpen(value=>!value)} className="focus-ring min-h-11 rounded-[var(--ln-radius-control-md)] border border-hairline px-2 text-sm font-medium text-moss">{zh?"记录":"Record"}</button></div>
          <div hidden={!recordOpen} className="mt-2" data-run-record><div className="grid grid-cols-3 gap-2">
            <Link onClick={()=>window.dispatchEvent(new Event("labnest:preserve-run-draft"))} href={`/entries/new?mode=capture&experiment=${experimentId}&step=${selectedStep.id}`} className="focus-ring flex min-h-11 items-center justify-center text-sm text-moss">{zh?"添加观察":"Observe"}</Link>
            <MobileMeasurementCapture key={selectedStep.id} experimentId={experimentId} step={selectedStep}/>
            <a href="#result-recording" className="focus-ring flex min-h-11 items-center justify-center text-sm text-moss">{zh?"实验结果":"Result"}</a>
          </div></div>



          <StructuredStepRecord key={`${selectedStep.id}:${structured?.plan.revision}`} experimentId={experimentId} stepId={selectedStep.id} structured={structured} editable={editable} completed={selectedStep.completed}/>
          {evidence && Object.values(evidence).some(count => count > 0) ? <p className="mt-3 rounded-[var(--ln-radius-control-lg)] bg-warm px-3 py-2 text-xs leading-5 text-graphite" aria-label="Current step evidence">{Object.entries(evidence).filter(([,count])=>count>0).map(([key,count])=>`${zh?({observations:"观察",measurements:"测量",files:"附件",consumptions:"耗材"} as Record<string,string>)[key]:key} ${count}`).join(" · ")}</p> : null}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button type="button" disabled={selectedStepIndex <= 0} onClick={() => setSelectedStepId(steps[selectedStepIndex - 1].id)} className="focus-ring flex min-h-11 items-center justify-center gap-1 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-2 text-xs font-semibold text-moss disabled:opacity-35"><ArrowLeft className="h-4 w-4" aria-hidden />Previous</button>
            <button type="button" onClick={() => setAllStepsOpen(true)} className="focus-ring min-h-11 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-2 text-xs font-semibold text-moss">All steps</button>
            <button type="button" disabled={selectedStepIndex >= steps.length - 1} onClick={() => setSelectedStepId(steps[selectedStepIndex + 1].id)} className="focus-ring flex min-h-11 items-center justify-center gap-1 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-2 text-xs font-semibold text-moss disabled:opacity-35">Next<ArrowRight className="h-4 w-4" aria-hidden /></button>
          </div>

          {selectedStep.allowsDeviation ? <details className="group mt-5 border-t border-hairline pt-2">
            <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold text-moss [&::-webkit-details-marker]:hidden">
              {zh ? "记录偏差" : "Record a deviation"}{(draftFields[`mobileDeviation:${selectedStep.id}`] ?? selectedStep.deviationNote)?.trim() ? <span className="ml-2 text-xs text-warning">{(draftFields[`mobileDeviationType:${selectedStep.id}`]??selectedStep.deviationType)==="incident" ? (zh?"异常":"Incident") : (zh?"偏差":"Deviation")} · {(draftFields[`mobileDeviation:${selectedStep.id}`]??selectedStep.deviationNote??"").slice(0,60)}</span> : null}
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
            </summary>
            <div className="grid gap-3 pb-3">
            <label className="block">
              <span className={formLabelClass}>Deviation type</span>
              <select name={`mobileDeviationType:${selectedStep.id}`} value={draftFields[`mobileDeviationType:${selectedStep.id}`]??selectedStep.deviationType??"method"} onChange={e=>setDraftFields(current=>({...current,[`mobileDeviationType:${selectedStep.id}`]:e.target.value}))} disabled={!editable || pending} className="focus-ring h-11 w-full rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-3 text-sm text-ink">
                <option value="method">Method change</option><option value="timing">Timing</option><option value="material">Material or reagent</option><option value="equipment">Equipment</option><option value="incident">Incident</option><option value="other">Other</option>
              </select>
            </label>
            <label className="block">
              <span className={formLabelClass}>What differed from the planned method?</span>
              <textarea name={`mobileDeviation:${selectedStep.id}`} value={draftFields[`mobileDeviation:${selectedStep.id}`]??selectedStep.deviationNote??""} onChange={e=>setDraftFields(current=>({...current,[`mobileDeviation:${selectedStep.id}`]:e.target.value}))} disabled={!editable || pending} placeholder="Record only the observed deviation or incident" className={`${fieldClass} min-h-24 resize-y`} />
            </label>
            <label className="block"><span className={formLabelClass}>Impact assessment</span><textarea name={`mobileDeviationImpact:${selectedStep.id}`} value={draftFields[`mobileDeviationImpact:${selectedStep.id}`]??selectedStep.deviationImpact??""} onChange={e=>setDraftFields(current=>({...current,[`mobileDeviationImpact:${selectedStep.id}`]:e.target.value}))} disabled={!editable || pending} placeholder="Effect on samples, quality, or interpretation; write unknown if not yet assessed" className={`${fieldClass} min-h-20 resize-y`} /></label>
            <label className="block"><span className={formLabelClass}>Recorded by</span><input name={`mobileDeviationAuthor:${selectedStep.id}`} value={draftFields[`mobileDeviationAuthor:${selectedStep.id}`]??selectedStep.deviationAuthor??""} onChange={e=>setDraftFields(current=>({...current,[`mobileDeviationAuthor:${selectedStep.id}`]:e.target.value}))} disabled={!editable || pending} className="focus-ring h-11 w-full rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-3 text-sm text-ink" /></label>
            </div>
          </details> : <p className="mt-4 border-t border-hairline pt-3 text-xs text-muted">This locked Protocol step does not allow a deviation record.</p>}

          {editable && !completedIds.has(selectedStep.id) ? <button type="submit" name="completedCurrentStepId" value={selectedStep.id} disabled={pending || unavailable(selectedStep.id)} className={`${primaryButton} h-auto! whitespace-normal! min-h-12 w-full py-2!`}><CheckCircle2 className="h-5 w-5" aria-hidden />{pending ? "Saving…" : selectedStep.requiresConfirmation ? "Confirm step completion" : "Mark step done"}</button> : null}
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-start gap-3 rounded-[var(--ln-radius-panel-inner)] bg-warm px-3 py-3 text-graphite">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div><h2 className="text-sm font-semibold">{hasSteps ? "All steps complete" : "No execution steps"}</h2><p className="mt-1 text-xs leading-5">No fixed steps are configured. This does not mean the Experiment is complete.</p></div>
          </div>
          <div className="mt-3 rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm px-3 py-3 text-xs leading-5 text-graphite" aria-label="Run evidence summary">
            <p className="font-semibold text-ink">Evidence review</p>
            <p className="mt-1">{evidenceTotals.observations} observations · {evidenceTotals.measurements} measurements · {evidenceTotals.files} files · {evidenceTotals.consumptions} inventory records</p>
            {!totalEvidence ? <p className="mt-1 text-warning">No step-linked evidence has been recorded. Confirm this is appropriate before completing the run.</p> : null}
          </div>
          {editable ? <><label className="mt-3 flex min-h-11 items-start gap-3 text-sm text-graphite"><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--moss)]" /><span>I reviewed the run evidence and unresolved deviations.</span></label><button type="submit" name="intent" value="complete" disabled={pending || !reviewConfirmed || (protocolBased&&!hasSteps)} className={`${primaryButton} mt-3 min-h-12 w-full`}>{pending ? "Working…" : "Complete run"}</button></> : null}
        </div>
      )}

      {hasSteps && remaining===0 && editable ? <details className="mx-4 mb-3 border-t border-hairline pt-2"><summary className="focus-ring cursor-pointer text-sm font-medium">{zh?"审核并完成本次实验":"Review and complete run"}</summary><label className="my-2 flex min-h-11 items-start gap-2 text-sm"><input type="checkbox" checked={reviewConfirmed} onChange={event=>setReviewConfirmed(event.target.checked)} className="mt-1 h-4 w-4"/>{zh?"已核对实验记录和未解决的偏差":"I reviewed the run evidence and unresolved deviations."}</label><button type="submit" name="intent" value="complete" disabled={pending||!reviewConfirmed} className={primaryButton}>{zh?"完成实验":"Complete run"}</button></details>:null}

      {state.error ? <p role="alert" className="mx-4 mb-4 flex gap-2 rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{state.error}</p> : null}
      {state.message ? <p role="status" className="mx-4 mb-4 rounded-[var(--ln-radius-control-lg)] border border-success/30 bg-success-surface px-3 py-2 text-sm text-success">{state.message}{state.savedAt ? ` Saved at ${new Date(state.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Synced` : ""}</p> : null}
      {offlineStatus ? <p role="status" className="mx-4 mb-4 rounded-[var(--ln-radius-control-lg)] border border-action-border bg-action-surface px-3 py-2 text-sm text-moss">{offlineStatus}</p> : null}


    </section>

    <details className="rounded-[var(--ln-radius-control-lg)] border border-hairline px-3 py-2" data-run-reference>
      <summary className="focus-ring cursor-pointer text-sm font-medium text-moss">{zh ? "规程参考与离线设置" : "Protocol reference and offline settings"}</summary>
      <div className="mt-3 space-y-3">
        <OfflineCalculator run zh={zh}/>
        {referenceGroups.map(group => <details key={group.key}>
          <summary className="focus-ring cursor-pointer text-sm font-medium">{group.title}</summary>
          <div className="run-step-content mt-2 min-w-0 space-y-3">
            <ChipRenderContext.Provider value={chipContexts[group.key] ?? null}>{(frozenReferences?.[group.key] ?? []).map(section => <section key={section.key}>
              <h3 className="mb-2 text-sm font-semibold">{section.title}</h3>
              {section.blocks.map(block => <ProtocolContentBlockView key={block.id} block={block} executionContext/>)}
            </section>)}</ChipRenderContext.Provider>
          </div>
        </details>)}
      </div>
    </details>

    {allStepsOpen ? <div className="ln-modal-layer fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label="Close all steps" onClick={() => setAllStepsOpen(false)} className="ln-modal-backdrop absolute inset-0 bg-ink/25 backdrop-blur-[1px]" />
      <section role="dialog" aria-modal="true" aria-labelledby="all-steps-title" className="ln-modal-card ln-modal-sheet absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-[var(--ln-radius-panel)] border-t border-hairline bg-surface pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-soft">
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-hairline bg-surface/95 px-4 py-3 backdrop-blur">
          <div><h2 id="all-steps-title" className="text-xl font-semibold text-ink">All steps</h2><p className="mt-0.5 text-xs text-muted">{completedIds.size} of {steps.length} complete</p></div>
          <button type="button" onClick={() => setAllStepsOpen(false)} aria-label="Close all steps" className="focus-ring flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-warm text-muted"><X className="h-4 w-4" aria-hidden /></button>
        </div>
        <ol className="divide-y divide-hairline">
          {steps.map((step, index) => <li key={`sheet-step-${step.id}`}><button type="button" onClick={() => { setSelectedStepId(step.id); setAllStepsOpen(false); }} className="focus-ring flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left text-sm">
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${completedIds.has(step.id) ? "border-moss bg-moss text-white" : step.id === currentStep?.id ? "border-action-border bg-action-surface text-moss" : "border-hairline text-muted"}`}>{completedIds.has(step.id) ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : index + 1}</span>
            <span className="min-w-0"><span className="block font-semibold text-ink">{step.title}</span><span className="mt-1 block text-xs text-muted">{step.groupTitle}</span></span>
          </button></li>)}
        </ol>
      </section>
    </div> : null}

    <section className="hidden overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface lg:block">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
        <h2 className="text-lg font-semibold text-ink">Execution record</h2>
        <span className="text-xs text-muted">{hasSteps ? "Check planned execution steps or log deviations by step." : "No fixed steps configured; use freeform execution notes."}</span>
      </div>
      {hasSteps ? <div className="divide-y-4 divide-stone/70">
        {groups.map((group) => {
          const groupCompleted = group.steps.filter((step) => completedIds.has(step.id)).length;
          const allCompleted = group.steps.length > 0 && groupCompleted === group.steps.length;
          const heading = experimentStepGroupHeading(group.title);
          return <section key={group.key} aria-labelledby={`run-group-${group.key}`}>
            <label className="flex cursor-pointer items-start gap-3 border-b border-hairline bg-sage-surface/55 px-4 py-3">
              <button type="button" onClick={()=>setGroup(group.steps,!allCompleted)} disabled={!editable||pending||group.steps.some(s => unavailable(s.id))} className="focus-ring min-h-11 rounded border border-hairline px-2 text-xs">{allCompleted?"取消整组勾选":"勾选整组"}</button>
              <span className="min-w-0"><strong id={`run-group-${group.key}`} className="block text-sm font-semibold text-ink">{group.order + 1}. {heading.title}</strong><span className="mt-0.5 block text-xs text-muted">{heading.detail ? `${heading.detail} · ` : ""}Whole block · {groupCompleted}/{group.steps.length} steps checked</span></span>
            </label>
            <div className="divide-y divide-hairline">
              {group.steps.map((step) => <div id={`step-${step.id}`} key={step.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)]">
                <div className="min-w-0">
                <label className="flex min-w-0 cursor-pointer items-start gap-3">
                  <input type="checkbox" name="completedStepIds" value={step.id} checked={completedIds.has(step.id)} onChange={(event) => setStep(step.id, event.target.checked)} disabled={!editable || pending || unavailable(step.id)} className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--moss)]" />
                  <span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-muted">Step {step.order}</span>{completedIds.has(step.id) ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> : <Circle className="h-4 w-4 text-muted" aria-hidden />}</span>{step.richContent?.derivedTitle ? null : <strong className="mt-1 block font-medium text-ink">{step.title}</strong>}{step.description && !step.richContent?.blocks.length ? <span className="mt-1 block whitespace-pre-wrap text-sm leading-6 text-graphite">{step.description}</span> : null}</span>
                </label>
                {step.richContent?.blocks.length ? <div className={step.richContent.derivedTitle ? "run-step-content mt-1 space-y-3 pl-9" : "run-step-content mt-3 space-y-3"} data-run-step-content><ChipRenderContext.Provider value={chipContexts[step.richContent.chipVersion ?? ''] ?? null}>{step.richContent.blocks.map(block => <ProtocolContentBlockView key={block.id} block={block} executionContext />)}</ChipRenderContext.Provider></div> : null}
                </div>
                <div>
                  <StructuredStepRecord key={`${step.id}:${structured?.plan.revision}`} experimentId={experimentId} stepId={step.id} structured={structured} editable={editable} completed={step.completed}/>
                  {structured?.steps[step.id] ? <StepTimerControls compact experimentId={experimentId} step={step} executionPlanRevision={structured.plan.revision} disabled={!editable || step.completed || structured.steps[step.id].blocked}/> : null}
                  {editable ? <StepCalculator experimentId={experimentId} stepId={step.id}/> : null}
                  {step.allowsDeviation ? <><label><span className={formLabelClass}>Deviation or incident</span><textarea name={`deviation:${step.id}`} value={draftFields[`deviation:${step.id}`] ?? step.deviationNote ?? ""} onChange={e => setDraftFields(current => ({ ...current, [`deviation:${step.id}`]: e.target.value }))} disabled={!editable || pending} placeholder="Only record what differed from the planned method" className={`${fieldClass} min-h-20 resize-y`} /></label></> : <p className="rounded-[var(--ln-radius-control-lg)] bg-warm px-3 py-2 text-xs text-muted">Deviation recording is disabled by the locked Protocol step.</p>}
                </div>
              </div>)}
            </div>
          </section>;
        })}
      </div> : <p className="px-4 py-8 text-center text-sm text-muted">No execution steps were planned. Review the Protocol structure before starting a protocol-based run.</p>}
      <div className="px-4 pb-4 pt-3"><label><span className={formLabelClass}>Execution notes</span><textarea key={state.savedAt ?? "initial"} name="quickNote" value={draftFields.quickNote ?? ""} onChange={e => setDraftFields(current => ({ ...current, quickNote: e.target.value }))} disabled={!editable || pending} placeholder="What happened at this stage? This is timestamped and appended to execution notes." className={`${fieldClass} min-h-24 resize-y`} /></label></div>
    </section>

    {editable ? <div className="sticky bottom-20 z-30 hidden space-y-2 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface/95 p-3 shadow-soft backdrop-blur lg:bottom-4 lg:block">
      {state.error ? <p role="alert" className="rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
      {state.message ? <p role="status" className="rounded-[var(--ln-radius-control-lg)] border border-success/30 bg-success-surface px-3 py-2 text-sm text-success">{state.message}</p> : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-xs text-muted">{hasSteps ? (remaining ? `${remaining} step${remaining === 1 ? "" : "s"} remaining` : "All planned steps checked") : "No checklist steps configured"}</span>
        {status === "planned" || status === "failed" ? <button type="submit" name="intent" value="start" disabled={pending} className={secondaryButton}><Play className="h-4 w-4" aria-hidden />{pending ? "Working…" : status === "failed" ? "Resume run" : "Start run"}</button> : null}
        <button type="submit" name="intent" value="save" disabled={pending} className={secondaryButton}><Save className="h-4 w-4" aria-hidden />{pending ? "Saving…" : "Save progress"}</button>
        <button type="submit" name="intent" value="complete" disabled={pending||(protocolBased&&!hasSteps)} className={primaryButton}><CheckCircle2 className="h-4 w-4" aria-hidden />{pending ? "Working…" : "Complete run"}</button>
      </div>
    </div> : null}
  </form>;
}
