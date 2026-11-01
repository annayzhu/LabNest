"use client";

import { useRunStepSelection } from "./RunStepSelection";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import { ProtocolContentBlockView } from "@/components/ProtocolDocumentView";
import { newClientMutationId } from "@/lib/client-mutation-id";

import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronDown, Circle, Play, Save, X } from "lucide-react";
import { Fragment, useActionState, useEffect, useMemo, useState, useRef } from "react";
import { saveProtocolRunProgress, type ProtocolRunProgressState } from "@/app/experiments/[id]/run/actions";
import { formLabelClass, formTextareaClass } from "@/components/forms";
import { buttonStyles } from "@/components/ui/Button";
import { StepCalculator } from "@/components/calculators/StepCalculator";
import { StepTimerControls } from "@/components/StepTimerControls";
import { stepQuantities, type StructuredRunView } from '@/lib/structured-run';
import { StructuredStepRecord } from './StructuredStepRecord';
import { StepRecordMenu } from './StepRecordMenu';
import { ProtocolReferenceSheet } from './ProtocolReferenceSheet';
import { ChipRenderContext, type ChipRender } from './protocol/ChipText';
import { RunChipContext, type RunChipStep } from './protocol/RunChip';
import { RunStepMixes } from './protocol/MixCard';
import { CompletionConsumptionDialog, recordRunConsumption, type ConsumptionChoice, type ConsumptionStock } from './RunConsumption';
import type { ConsumptionLine } from '@/lib/run-consumption';
import type { ProtocolContentBlock } from '@/lib/protocol-document';
import './protocol/protocol.css';
import './run-bench.css';
import { experimentStepGroupHeading } from "@/lib/experiment-planning";
import { scheduleDayLabel } from "@/lib/experiment-schedule";
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

/** A day of the run's schedule; `title` only when the block was given its own name (the steps below already say which Protocol). */
export type RunScheduleBlock = { id: string; dayIndex: number; dayKey: string; clock: string | null; title: string | null; stepIds: string[] };

const initialState: ProtocolRunProgressState = {};
const secondaryButton = buttonStyles({ size: "lg", className: "bg-surface font-medium text-moss hover:bg-warm disabled:cursor-wait disabled:opacity-50" });
const primaryButton = buttonStyles({ variant: "primary", size: "lg", className: "font-medium disabled:cursor-wait disabled:opacity-50" });
const fieldClass = `${formTextareaClass} bg-surface`;

export function ProtocolRunProgressForm({ experimentId, status, steps, editable, evidenceByStep, frozenReferences, frozenReferenceTitles, protocolBased=false, structured, chipContexts = {}, consumption = [], stock = [], bench = false, schedule }: {
  /** 日程段 (Q263): the days the steps are planned on; the current day's block stays open, the others fold away. */
  schedule?: { blocks: RunScheduleBlock[] };
  /** Materials this run used and not yet recorded: completing the run first asks whether to deduct them. */
  consumption?: ConsumptionLine[];
  stock?: ConsumptionStock[];
  /** 现场模式: one step at a time at any width, with a step rail beside it. */
  bench?: boolean;
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
  // Completing asks once about inventory when this run used materials that are not yet recorded.
  const [consumptionReview, setConsumptionReview] = useState<HTMLButtonElement | null>(null);
  const consumptionReviewed = useRef(false);
  const consumptionChoices = useRef<ConsumptionChoice[] | null>(null);
  const [state, formAction, pending] = useActionState(async (previous: ProtocolRunProgressState, data: FormData) => {
    const result = await saveProtocolRunProgress(previous, data);
    // Usage chosen at completion is written only once the run really completed.
    const choices = consumptionChoices.current;
    consumptionChoices.current = null;
    if (result.error && data.get("intent") === "complete") consumptionReviewed.current = false; // ask again on the next try
    if (choices?.length && !result.error && data.get("intent") === "complete") {
      try { await recordRunConsumption(experimentId, choices); return { ...result, message: `${result.message ?? ""} This run’s use is recorded${choices.some(choice => choice.stockId) ? " and deducted from stock" : ""}.` }; }
      catch (cause) { return { ...result, error: `The run is complete, but not all of its use was written · ${cause instanceof Error ? cause.message : "record it under “Reagents and consumables used in this run”"}` }; }
    }
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
  const blockOf = useMemo(() => new Map((schedule?.blocks ?? []).flatMap(block => block.stepIds.map(id => [id, block] as const))), [schedule]);
  const currentBlockId = currentStep ? blockOf.get(currentStep.id)?.id : undefined;
  const [openBlocks, setOpenBlocks] = useState<ReadonlySet<string>>(() => new Set());
  const blockOpen = (id: string) => id === currentBlockId || openBlocks.has(id);
  const blockLabel = (block: RunScheduleBlock) => `${scheduleDayLabel(block.dayIndex, block.dayKey, zh)}${block.clock ? ` ${block.clock}` : ""}${block.title ? ` · ${block.title}` : ""}`;
  // A step linked from Today or the schedule opens its day.
  useEffect(() => {
    const open = () => { const block = blockOf.get(decodeURIComponent(window.location.hash.replace(/^#step-/, ""))); if (block) setOpenBlocks(current => new Set([...current, block.id])); };
    const frame = requestAnimationFrame(open);
    window.addEventListener("hashchange", open);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", open); };
  }, [blockOf]);
  const blockHead = (block: RunScheduleBlock) => {
    const done = block.stepIds.filter(id => completedIds.has(id)).length;
    const current = block.id === currentBlockId, open = blockOpen(block.id);
    return <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm ${current ? "bg-action-surface text-moss" : "bg-warm/50 text-graphite"}`} data-schedule-block={block.id}>
      <span className="font-semibold" data-i18n-ignore>{blockLabel(block)}</span>
      <span className="font-mono text-xs text-muted" data-i18n-ignore>{done}/{block.stepIds.length}</span>
      {current ? <span className="text-xs font-semibold">{zh ? "当前" : "Now"}</span> : <button type="button" className="focus-ring ml-auto min-h-9 rounded px-2 text-xs font-medium text-moss" aria-expanded={open} onClick={() => setOpenBlocks(currentSet => { const next = new Set(currentSet); if (next.has(block.id)) next.delete(block.id); else next.add(block.id); return next; })}>{open ? (zh ? "收起" : "Fold") : (zh ? "展开" : "Show steps")}</button>}
    </div>;
  };
  const startsBlock = (list: RunStep[], index: number) => { const block = blockOf.get(list[index].id); return block && (index === 0 || blockOf.get(list[index - 1].id)?.id !== block.id) ? block : undefined; };
  useEffect(()=>{const restore=()=>{const id=decodeURIComponent(window.location.hash.replace(/^#step-/,''));if(steps.some(step=>step.id===id))setSelectedStepId(id);};const frame=requestAnimationFrame(restore);window.addEventListener('hashchange',restore);return()=>{cancelAnimationFrame(frame);window.removeEventListener('hashchange',restore);};},[steps,setSelectedStepId]);
  const [allStepsOpen, setAllStepsOpen] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState("");
  // 规程原文 opened beside a step: the step's source reference, null for the whole Protocol, undefined while closed.
  const [referenceFor, setReferenceFor] = useState<string | null | undefined>(undefined);
  // Required is the default and goes unsaid; only an optional or skipped step is marked.
  const stepTag = (id: string) => structured?.plan.skips[id] ? <span className="ln-step-tag">Skipped</span> : structured?.steps[id]?.optional ? <span className="ln-step-tag">Optional</span> : null;
  // Why a step cannot be completed, said where the completion control is.
  const stepNote = (id: string) => {
    const skip = structured?.plan.skips[id], step = structured?.steps[id];
    const text = skip ? `Skipped · ${skip.reason} (not counted as complete)` : step?.blocked ? step.awaitingInput ? "To be determined · enter the values marked “Filled in at run time” in this step" : "To be determined · confirm the systems and the parameters it depends on" : "";
    return text && !completedIds.has(id) ? <p role="status" className="ln-step-note">{text}</p> : null;
  };
  const originalButton = (step: RunStep) => referenceGroups.length ? <button type="button" className="focus-ring ln-original-link" onClick={() => setReferenceFor(step.protocolStepRef ?? null)}><BookOpen aria-hidden />{zh ? "原文" : "Original"}</button> : null;
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const selectedStep = steps.find((step) => step.id === selectedStepId) ?? currentStep ?? steps[0];
  useEffect(()=>{
    if(draftInitialized.current)return;draftInitialized.current=true;
    const frame=requestAnimationFrame(()=>{try{const saved=JSON.parse(sessionStorage.getItem(`labnest.run-draft:${experimentId}`)??'null');if(saved){if (structured && saved.revision !== structured.plan.revision) { if (Object.keys(saved.fields ?? {}).length) { setOlderDraft(saved.fields); setDraftNotice('The run record was updated; the older draft is kept for checking.'); } } else { setDraftFields(saved.fields??{}); if(Array.isArray(saved.completed))setCompletedIds(new Set(saved.completed.filter((id:string)=>steps.some(s=>s.id===id)))); } if(steps.some(s=>s.id===saved.selectedStepId)&&!window.location.hash)setSelectedStepId(saved.selectedStepId);window.scrollTo(0,saved.scrollY??0);if(Object.keys(saved.fields??{}).length && (!structured || saved.revision === structured.plan.revision))setDraftNotice('Unsaved draft restored');}}catch{setDraftNotice('Draft storage unavailable');}setDraftReady(true);});
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
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    // Only once completion can succeed: never deduct stock for a run that then stays open.
    if (submitter?.name === "intent" && submitter.value === "complete" && consumption.length && editable && remaining === 0 && !consumptionReviewed.current) { event.preventDefault(); setConsumptionReview(submitter); return; }
    const mutationInput = form.elements.namedItem("clientMutationId") as HTMLInputElement | null;
    const createdInput = form.elements.namedItem("deviceCreatedAt") as HTMLInputElement | null;
    let clientMutationId: string;
    try { clientMutationId = newClientMutationId(); }
    catch (error) { event.preventDefault(); setOfflineStatus(error instanceof Error ? error.message : "Record ID could not be created."); return; }
    const deviceCreatedAt = new Date().toISOString();
    if (mutationInput) mutationInput.value = clientMutationId;
    if (createdInput) createdInput.value = deviceCreatedAt;
    const stepId = submitter?.name === "completedCurrentStepId" ? submitter.value : "";
    if (navigator.onLine || !stepId) return;
    event.preventDefault();
    const data = new FormData(form);
    const optional = (name: string) => String(data.get(name) ?? "").trim() || undefined;
    let queueContext;
    try { queueContext = runQueueContext(steps.find(step => step.id === stepId)?.protocolStepRef ?? stepId); } catch { setOfflineStatus("Storage on this device is unavailable; nothing was saved. Keep this page open."); return; }
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

  // What a step's chips need on the bench: its adopted values, recorded actuals and countdown.
  const runChipStep = (step: RunStep): RunChipStep | null => {
    const resolved = structured?.steps[step.id];
    if (!resolved || !structured) return null;
    // Shared preparation reads its group-independent values from the first group's adoption.
    const { versionId, quantities } = stepQuantities(structured, step.id);
    const systems = versionId ? chipContexts[versionId]?.systems : undefined;
    if (!versionId || !systems) return null;
    const adopted = structured.plan.versions[versionId];
    const iso = (value: Date | string | null) => value ? new Date(value).toISOString() : null;
    return { experimentId, stepId: step.id, versionId, revision: structured.plan.revision, editable, completed: step.completed, blocked: resolved.blocked, systems,
      selections: adopted?.selections ?? {}, actualInputs: adopted?.actualInputs ?? {}, receipts: adopted?.calculations ?? {}, actualValues: structured.plan.actualValues[step.id] ?? {}, fields: resolved.actualFields,
      timer: { durationSeconds: step.timerDurationSeconds, remainingSeconds: step.timerRemainingSeconds, startedAt: iso(step.timerStartedAt), pausedAt: iso(step.timerPausedAt), parameterId: structured.plan.timerSources[step.id] },
      quantities, mixes: structured.plan.mixes, strikes: structured.plan.mixStrikes };
  };

  const runChips = new Map(steps.map(step => [step.id, runChipStep(step)]));
  return <form id="run-execution" ref={formRef} action={formAction} onSubmit={prepareMutation} className="space-y-4">
    <input type="hidden" name="experimentId" value={experimentId} />
    {structured ? <input type="hidden" name="executionPlanRevision" value={structured.plan.revision}/> : null}
    {queued.length ? <p role="status" className="text-warning">{`${queued.length} record${queued.length === 1 ? "" : "s"} on this device waiting to sync, ${queued.filter(item => item.state === "conflict").length} in conflict. The completion count below does not cover them all yet.`}</p> : null}
    {/* 现场模式's step rail already counts progress. */}
    {structured && !bench ? <p role="status" data-structured-progress>{`Required ${requiredCompleted}/${requiredSteps.length} done · optional ${steps.filter(s => structured.steps[s.id]?.optional && completedIds.has(s.id)).length}/${steps.filter(s => structured.steps[s.id]?.optional).length} · skipped ${Object.keys(structured.plan.skips).length} · to be determined ${steps.filter(s => structured.steps[s.id]?.blocked).length}`}</p> : null}
    <input type="hidden" name="clientMutationId" />
    <input type="hidden" name="deviceCreatedAt" />
    {olderDraft ? <aside className="m-3 border border-warning p-3" role="status"><p>The run record was updated. Compare the server record with the older draft before deciding whether to keep using it.</p><details><summary>Show the older draft</summary>{Object.entries(olderDraft).map(([key,value]) => <p key={key} className="whitespace-pre-wrap">{value}</p>)}</details><button type="button" className="focus-ring min-h-11 text-moss" onClick={() => { setDraftFields(olderDraft); setOlderDraft(null); setDraftNotice('Checked draft restored, not saved yet'); }}>Checked; keep using these drafts</button></aside> : null}
    {[...completedIds].map((id) => <input key={`mobile-completed-${id}`} type="hidden" name="completedStepIds" value={id} />)}

    <div className={bench ? "ln-bench-grid" : "contents"}>
    {bench ? <aside className="ln-bench-steps" aria-label={zh ? "步骤列表" : "Steps"}>
      <header><strong>{zh ? "步骤" : "Steps"}</strong><small>{requiredCompleted}/{requiredSteps.length}{remaining ? ` · ${remaining} ${zh ? "步待做" : "remaining"}` : ` · ${zh ? "全部完成" : "all done"}`}</small></header>
      <ol>{groups.map(group => <Fragment key={`rail-${group.key}`}>
        {groups.length > 1 ? <li><span className="ln-bench-group">{experimentStepGroupHeading(group.title).title}</span></li> : null}
        {group.steps.map((step, stepIndex) => { const index = steps.findIndex(item => item.id === step.id); const block = startsBlock(group.steps, stepIndex); return <Fragment key={`rail-${step.id}`}>
          {block ? <li><span className="ln-bench-group" data-i18n-ignore>{blockLabel(block)}</span></li> : null}
          <li className={completedIds.has(step.id) ? "is-done" : undefined}>
          <button type="button" aria-current={selectedStep?.id === step.id ? "step" : undefined} onClick={() => setSelectedStepId(step.id)}><span className="ln-bench-number" aria-hidden>{completedIds.has(step.id) ? "✓" : index + 1}</span><span>{step.title}</span></button>
        </li></Fragment>; })}
      </Fragment>)}</ol>
      <footer><a className="focus-ring" href="#run-preparation">{zh ? "准备清单" : "Preparation"}</a><a className="focus-ring" href="#result-recording">{zh ? "实验结果" : "Results"}</a></footer>
    </aside> : null}
    <section className={`${bench ? "" : "lg:hidden "}overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface`}>
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
          {blockOf.get(selectedStep.id) ? <p className="text-xs font-medium text-moss" data-i18n-ignore>{blockLabel(blockOf.get(selectedStep.id)!)}</p> : null}
          {groups.length>1 ? <p className="text-xs text-muted">{experimentStepGroupHeading(selectedStep.groupTitle).title}</p> : null}
          <RunStepNotes blocks={selectedStep.richContent?.notesBefore} className="mb-3" />
          <div className="flex items-start justify-between gap-3">{selectedStep.richContent?.derivedTitle ? <p className="mt-1 font-mono text-xs text-muted">{completedIds.has(selectedStep.id)?"✓ ":""}{zh ? `第 ${selectedStepIndex + 1} 步` : `Step ${selectedStepIndex + 1}`}{stepTag(selectedStep.id)}</p> : <h3 className="mt-1 text-base font-semibold leading-6 text-ink">{completedIds.has(selectedStep.id)?"✓ ":""}{selectedStep.title}{stepTag(selectedStep.id)}</h3>}{originalButton(selectedStep)}</div>

          <div className="run-step-content mt-3 min-w-0 space-y-3" data-run-step-content><RunChipContext.Provider value={runChips.get(selectedStep.id) ?? null}><ChipRenderContext.Provider value={chipContexts[selectedStep.richContent?.chipVersion ?? ''] ?? null}>{selectedStep.richContent?.blocks.length?selectedStep.richContent.blocks.map(block=><ProtocolContentBlockView key={block.id} block={block} executionContext/>):<><p className="whitespace-pre-wrap text-base leading-7 text-graphite">{selectedStep.description}</p>{selectedStep.richContent?.source === "legacy-text" ? <p className="text-xs text-warning">{zh ? "此旧步骤的完整格式尚未确认，可点“原文”查看。" : "Full formatting for this older step is unverified. See the original."}</p> : null}</>}{runChips.get(selectedStep.id) ? <RunStepMixes step={runChips.get(selectedStep.id)!} mixes={structured?.plan.runMixes[selectedStep.id] ?? []} /> : null}</ChipRenderContext.Provider></RunChipContext.Provider></div>
          <RunStepNotes blocks={selectedStep.richContent?.notesAfter} className="mt-3" />
          <div data-run-tools className="mt-3 grid grid-cols-2 min-[360px]:grid-cols-3 gap-2">{editable ? <StepCalculator experimentId={experimentId} stepId={selectedStep.id} /> : null}
          <StepTimerControls compact key={selectedStep.id} experimentId={experimentId} step={selectedStep} executionPlanRevision={structured?.plan.revision} disabled={!editable || Boolean(structured?.steps[selectedStep.id] && (selectedStep.completed || structured.steps[selectedStep.id].blocked))}/>
          <StepRecordMenu experimentId={experimentId} step={selectedStep}/></div>
          <StructuredStepRecord key={`${selectedStep.id}:${structured?.plan.revision}`} experimentId={experimentId} stepId={selectedStep.id} structured={structured} editable={editable} completed={selectedStep.completed}>{record => <>
          {record.values}
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

          {stepNote(selectedStep.id)}
          {editable && !completedIds.has(selectedStep.id) ? <button type="submit" name="completedCurrentStepId" value={selectedStep.id} disabled={pending || unavailable(selectedStep.id)} className={`${primaryButton} h-auto! whitespace-normal! min-h-12 w-full py-2!`}><CheckCircle2 className="h-5 w-5" aria-hidden />{pending ? "Saving…" : selectedStep.requiresConfirmation ? "Confirm step completion" : "Mark step done"}</button> : null}
          {record.skip}
          </>}</StructuredStepRecord>
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
    </div>

    {referenceFor !== undefined ? <ProtocolReferenceSheet groups={referenceGroups} references={frozenReferences ?? {}} chipContexts={chipContexts} stepRef={referenceFor} onClose={() => setReferenceFor(undefined)} /> : null}

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

    <section className={`${bench ? "hidden" : "hidden lg:block"} overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface`}>
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
              <button type="button" onClick={()=>setGroup(group.steps,!allCompleted)} disabled={!editable||pending||group.steps.some(s => unavailable(s.id))} className="focus-ring min-h-11 rounded border border-hairline px-2 text-xs">{allCompleted?"Untick the whole group":"Tick the whole group"}</button>
              <span className="min-w-0"><strong id={`run-group-${group.key}`} className="block text-sm font-semibold text-ink">{group.order + 1}. {heading.title}</strong><span className="mt-0.5 block text-xs text-muted">{heading.detail ? `${heading.detail} · ` : ""}Whole block · {groupCompleted}/{group.steps.length} steps checked</span></span>
            </label>
            <div className="divide-y divide-hairline">
              {group.steps.map((step, stepIndex) => { const block = startsBlock(group.steps, stepIndex); const folded = Boolean(blockOf.get(step.id)) && !blockOpen(blockOf.get(step.id)!.id); return <Fragment key={step.id}>{block ? blockHead(block) : null}<div hidden={folded} className="divide-y divide-hairline">{step.richContent?.notesBefore?.length ? <div className="px-4 py-3"><RunStepNotes blocks={step.richContent.notesBefore} /></div> : null}<div id={`step-${step.id}`} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)]">
                <div className="min-w-0">
                <label className="flex min-w-0 cursor-pointer items-start gap-3">
                  <input type="checkbox" name="completedStepIds" value={step.id} checked={completedIds.has(step.id)} onChange={(event) => setStep(step.id, event.target.checked)} disabled={!editable || pending || unavailable(step.id)} className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--moss)]" />
                  <span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-muted">Step {step.order}</span>{completedIds.has(step.id) ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> : <Circle className="h-4 w-4 text-muted" aria-hidden />}{stepTag(step.id)}</span>{step.richContent?.derivedTitle ? null : <strong className="mt-1 block font-medium text-ink">{step.title}</strong>}{step.description && !step.richContent?.blocks.length ? <span className="mt-1 block whitespace-pre-wrap text-sm leading-6 text-graphite">{step.description}</span> : null}</span>
                </label>
                {step.richContent?.blocks.length ? <div className={step.richContent.derivedTitle ? "run-step-content mt-1 space-y-3 pl-9" : "run-step-content mt-3 space-y-3"} data-run-step-content><RunChipContext.Provider value={runChips.get(step.id) ?? null}><ChipRenderContext.Provider value={chipContexts[step.richContent.chipVersion ?? ''] ?? null}>{step.richContent.blocks.map(block => <ProtocolContentBlockView key={block.id} block={block} executionContext />)}{runChips.get(step.id) ? <RunStepMixes step={runChips.get(step.id)!} mixes={structured?.plan.runMixes[step.id] ?? []} /> : null}</ChipRenderContext.Provider></RunChipContext.Provider></div> : null}
                </div>
                <div>
                  {stepNote(step.id)}
                  <StructuredStepRecord key={`${step.id}:${structured?.plan.revision}`} experimentId={experimentId} stepId={step.id} structured={structured} editable={editable} completed={step.completed}/>
                  {structured?.steps[step.id] ? <StepTimerControls compact experimentId={experimentId} step={step} executionPlanRevision={structured.plan.revision} disabled={!editable || step.completed || structured.steps[step.id].blocked}/> : null}
                  {editable ? <StepCalculator experimentId={experimentId} stepId={step.id}/> : null}
                  <Link onClick={() => window.dispatchEvent(new Event("labnest:preserve-run-draft"))} href={`/entries/new?mode=capture&experiment=${experimentId}&step=${step.id}`} className="focus-ring inline-flex min-h-9 items-center text-sm text-moss">Jot a note</Link>
                  {originalButton(step)}
                  {step.allowsDeviation ? <><label><span className={formLabelClass}>Deviation or incident</span><textarea name={`deviation:${step.id}`} value={draftFields[`deviation:${step.id}`] ?? step.deviationNote ?? ""} onChange={e => setDraftFields(current => ({ ...current, [`deviation:${step.id}`]: e.target.value }))} disabled={!editable || pending} placeholder="Only record what differed from the planned method" className={`${fieldClass} min-h-20 resize-y`} /></label></> : <p className="rounded-[var(--ln-radius-control-lg)] bg-warm px-3 py-2 text-xs text-muted">Deviation recording is disabled by the locked Protocol step.</p>}
                </div>
              </div>{step.richContent?.notesAfter?.length ? <div className="px-4 py-3"><RunStepNotes blocks={step.richContent.notesAfter} /></div> : null}</div></Fragment>; })}
            </div>
          </section>;
        })}
      </div> : <p className="px-4 py-8 text-center text-sm text-muted">No execution steps were planned. Review the Protocol structure before starting a protocol-based run.</p>}
      <div className="px-4 pb-4 pt-3"><label><span className={formLabelClass}>Execution notes</span><textarea key={state.savedAt ?? "initial"} name="quickNote" value={draftFields.quickNote ?? ""} onChange={e => setDraftFields(current => ({ ...current, quickNote: e.target.value }))} disabled={!editable || pending} placeholder="What happened at this stage? This is timestamped and appended to execution notes." className={`${fieldClass} min-h-24 resize-y`} /></label></div>
    </section>

    {consumptionReview ? <CompletionConsumptionDialog lines={consumption} stock={stock} onCancel={() => setConsumptionReview(null)}
      onSkip={() => { const button = consumptionReview; consumptionReviewed.current = true; setConsumptionReview(null); formRef.current?.requestSubmit(button); }}
      onDeduct={choices => { const button = consumptionReview; consumptionChoices.current = choices; consumptionReviewed.current = true; setConsumptionReview(null); formRef.current?.requestSubmit(button); }} /> : null}
    {editable ? <div className={`sticky bottom-20 z-30 hidden space-y-2 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface/95 p-3 shadow-soft backdrop-blur lg:bottom-4 ${bench ? "" : "lg:block"}`}>
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

/** The Protocol's notes where they were written: before this step, or after the last one. No number and nothing to check. */
function RunStepNotes({ blocks, className = "" }: { blocks: ProtocolContentBlock[] | undefined; className?: string }) {
  if (!blocks?.length) return null;
  return <div className={`min-w-0 space-y-2 rounded-[var(--ln-radius-control-lg)] bg-warm px-3 py-2 text-sm leading-6 text-graphite ${className}`} data-run-note>{blocks.map(block => <ProtocolContentBlockView key={block.id} block={block} executionContext />)}</div>;
}
