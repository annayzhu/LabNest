"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Circle, Play, Save, X } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { saveProtocolRunProgress, type ProtocolRunProgressState } from "@/app/experiments/[id]/run/actions";
import { formLabelClass, formTextareaClass } from "@/components/forms";
import { buttonStyles } from "@/components/ui/Button";
import { StepTimerControls } from "@/components/StepTimerControls";
import { experimentStepGroupHeading } from "@/lib/experiment-planning";

type RunStep = {
  id: string;
  groupKey: string;
  groupTitle: string;
  groupOrder: number;
  order: number;
  title: string;
  description: string;
  completed: boolean;
  deviationNote: string | null;
  timerDurationSeconds: number | null;
  timerRemainingSeconds: number | null;
  timerStartedAt: Date | null;
  timerPausedAt: Date | null;
};

const initialState: ProtocolRunProgressState = {};
const secondaryButton = buttonStyles({ size: "lg", className: "bg-surface font-medium text-moss hover:bg-warm disabled:cursor-wait disabled:opacity-50" });
const primaryButton = buttonStyles({ variant: "primary", size: "lg", className: "font-medium disabled:cursor-wait disabled:opacity-50" });
const fieldClass = `${formTextareaClass} bg-surface`;

export function ProtocolRunProgressForm({ experimentId, status, steps, editable }: {
  experimentId: string;
  status: string;
  steps: RunStep[];
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveProtocolRunProgress, initialState);
  const [completedIds, setCompletedIds] = useState(() => new Set(steps.filter((step) => step.completed).map((step) => step.id)));
  const groups = useMemo(() => {
    const grouped = new Map<string, { key: string; title: string; order: number; steps: RunStep[] }>();
    for (const step of steps) {
      const group = grouped.get(step.groupKey) ?? { key: step.groupKey, title: step.groupTitle, order: step.groupOrder, steps: [] };
      group.steps.push(step);
      grouped.set(step.groupKey, group);
    }
    return [...grouped.values()].sort((a, b) => a.order - b.order);
  }, [steps]);
  const remaining = steps.length - completedIds.size;
  const hasSteps = steps.length > 0;
  const currentStep = steps.find((step) => !completedIds.has(step.id));
  const [selectedStepId, setSelectedStepId] = useState(() => currentStep?.id ?? steps[0]?.id ?? "");
  const [allStepsOpen, setAllStepsOpen] = useState(false);
  const selectedStep = steps.find((step) => step.id === selectedStepId) ?? currentStep ?? steps[0];
  const selectedStepIndex = selectedStep ? steps.findIndex((step) => step.id === selectedStep.id) : -1;

  function prepareMutation(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const mutationInput = form.elements.namedItem("clientMutationId") as HTMLInputElement | null;
    const createdInput = form.elements.namedItem("deviceCreatedAt") as HTMLInputElement | null;
    if (mutationInput) mutationInput.value = crypto.randomUUID();
    if (createdInput) createdInput.value = new Date().toISOString();
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

  return <form action={formAction} onSubmit={prepareMutation} className="space-y-4">
    <input type="hidden" name="experimentId" value={experimentId} />
    <input type="hidden" name="clientMutationId" />
    <input type="hidden" name="deviceCreatedAt" />
    {[...completedIds].map((id) => <input key={`mobile-completed-${id}`} type="hidden" name="completedStepIds" value={id} />)}

    <section className="overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface lg:hidden">
      <div className="border-b border-hairline px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-xs text-muted">
          <span>{hasSteps ? `${completedIds.size} of ${steps.length} complete` : "No fixed steps"}</span>
          <span>{selectedStep ? `Step ${selectedStepIndex + 1}` : "Ready to finish"}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone">
          <div className="h-full rounded-full bg-moss transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${hasSteps ? Math.round((completedIds.size / steps.length) * 100) : 0}%` }} />
        </div>
      </div>

      {selectedStep && currentStep ? (
        <div className="p-4">
          <h2 className="text-sm font-semibold text-ink">{selectedStep.id === currentStep.id ? "Current step" : "Step review"}</h2>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{selectedStep.groupTitle} · Step {selectedStep.order}</p>
          <h3 className="mt-1 text-xl font-semibold leading-7 tracking-[-0.015em] text-ink">{selectedStep.title}</h3>
          {selectedStep.description ? <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-graphite">{selectedStep.description}</p> : null}

          <StepTimerControls key={`${selectedStep.id}:${selectedStep.timerStartedAt?.toISOString() ?? "idle"}:${selectedStep.timerRemainingSeconds ?? "unset"}`} experimentId={experimentId} step={selectedStep} />

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button type="button" disabled={selectedStepIndex <= 0} onClick={() => setSelectedStepId(steps[selectedStepIndex - 1].id)} className="focus-ring flex min-h-11 items-center justify-center gap-1 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-2 text-xs font-semibold text-moss disabled:opacity-35"><ArrowLeft className="h-4 w-4" aria-hidden />Previous</button>
            <button type="button" onClick={() => setAllStepsOpen(true)} className="focus-ring min-h-11 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-2 text-xs font-semibold text-moss">All steps</button>
            <button type="button" disabled={selectedStepIndex >= steps.length - 1} onClick={() => setSelectedStepId(steps[selectedStepIndex + 1].id)} className="focus-ring flex min-h-11 items-center justify-center gap-1 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-2 text-xs font-semibold text-moss disabled:opacity-35">Next<ArrowRight className="h-4 w-4" aria-hidden /></button>
          </div>

          <details className="group mt-5 border-t border-hairline pt-2">
            <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold text-moss [&::-webkit-details-marker]:hidden">
              Record a deviation
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
            </summary>
            <label className="block pb-3">
              <span className={formLabelClass}>What differed from the planned method?</span>
              <textarea name={`mobileDeviation:${selectedStep.id}`} defaultValue={selectedStep.deviationNote ?? ""} disabled={!editable || pending} placeholder="Record only the observed deviation or incident" className={`${fieldClass} min-h-24 resize-y`} />
            </label>
          </details>

          {editable && !completedIds.has(selectedStep.id) ? <button type="submit" name="completedCurrentStepId" value={selectedStep.id} disabled={pending} className={`${primaryButton} min-h-12 w-full`}><CheckCircle2 className="h-5 w-5" aria-hidden />{pending ? "Saving…" : "Complete step"}</button> : <p className="rounded-[var(--ln-radius-control-lg)] bg-success-surface px-3 py-2 text-sm text-success">This step is complete.</p>}
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-start gap-3 rounded-[var(--ln-radius-panel-inner)] bg-success-surface px-3 py-3 text-success">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div><h2 className="text-sm font-semibold">All steps complete</h2><p className="mt-1 text-xs leading-5">Review the run, then mark the experiment complete.</p></div>
          </div>
          {editable ? <button type="submit" name="intent" value="complete" disabled={pending} className={`${primaryButton} mt-4 min-h-12 w-full`}>{pending ? "Working…" : "Complete run"}</button> : null}
        </div>
      )}

      {state.error ? <p role="alert" className="mx-4 mb-4 flex gap-2 rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{state.error}</p> : null}
      {state.message ? <p role="status" className="mx-4 mb-4 rounded-[var(--ln-radius-control-lg)] border border-success/30 bg-success-surface px-3 py-2 text-sm text-success">{state.message}{state.savedAt ? ` Saved at ${new Date(state.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Synced` : ""}</p> : null}

      {hasSteps ? <button type="button" onClick={() => setAllStepsOpen(true)} className="focus-ring flex min-h-12 w-full items-center justify-between border-t border-hairline bg-warm/45 px-4 text-sm font-semibold text-moss">All steps<ChevronDown className="h-4 w-4" aria-hidden /></button> : null}
    </section>

    {allStepsOpen ? <div className="ln-modal-layer fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label="Close all steps" onClick={() => setAllStepsOpen(false)} className="ln-modal-backdrop absolute inset-0 bg-ink/25 backdrop-blur-[1px]" />
      <section role="dialog" aria-modal="true" aria-labelledby="all-steps-title" className="ln-modal-card ln-modal-sheet absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-[var(--ln-radius-panel)] border-t border-hairline bg-surface pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-soft">
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-hairline bg-surface/95 px-4 py-3 backdrop-blur">
          <div><h2 id="all-steps-title" className="font-serif text-xl font-medium text-ink">All steps</h2><p className="mt-0.5 text-xs text-muted">{completedIds.size} of {steps.length} complete</p></div>
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
        <h2 className="font-serif text-lg font-medium text-ink">Execution record</h2>
        <span className="text-xs text-muted">{hasSteps ? "Check planned execution steps or log deviations by step." : "No fixed steps configured; use freeform execution notes."}</span>
      </div>
      {hasSteps ? <div className="divide-y-4 divide-stone/70">
        {groups.map((group) => {
          const groupCompleted = group.steps.filter((step) => completedIds.has(step.id)).length;
          const allCompleted = group.steps.length > 0 && groupCompleted === group.steps.length;
          const heading = experimentStepGroupHeading(group.title);
          return <section key={group.key} aria-labelledby={`run-group-${group.key}`}>
            <label className="flex cursor-pointer items-start gap-3 border-b border-hairline bg-sage-surface/55 px-4 py-3">
              <input type="checkbox" checked={allCompleted} onChange={(event) => setGroup(group.steps, event.target.checked)} disabled={!editable || pending} className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--moss)]" />
              <span className="min-w-0"><strong id={`run-group-${group.key}`} className="block text-sm font-semibold text-ink">{group.order + 1}. {heading.title}</strong><span className="mt-0.5 block text-xs text-muted">{heading.detail ? `${heading.detail} · ` : ""}Whole block · {groupCompleted}/{group.steps.length} steps checked</span></span>
            </label>
            <div className="divide-y divide-hairline">
              {group.steps.map((step) => <div key={step.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)]">
                <label className="flex min-w-0 cursor-pointer items-start gap-3">
                  <input type="checkbox" name="completedStepIds" value={step.id} checked={completedIds.has(step.id)} onChange={(event) => setStep(step.id, event.target.checked)} disabled={!editable || pending} className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--moss)]" />
                  <span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-muted">Step {step.order}</span>{completedIds.has(step.id) ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> : <Circle className="h-4 w-4 text-muted" aria-hidden />}</span><strong className="mt-1 block font-medium text-ink">{step.title}</strong>{step.description ? <span className="mt-1 block whitespace-pre-wrap text-sm leading-6 text-graphite">{step.description}</span> : null}</span>
                </label>
                <div>
                  <label><span className={formLabelClass}>Deviation or incident</span><textarea name={`deviation:${step.id}`} defaultValue={step.deviationNote ?? ""} disabled={!editable || pending} placeholder="Only record what differed from the planned method" className={`${fieldClass} min-h-20 resize-y`} /></label>
                  {editable ? <button type="submit" name="intent" value="save" disabled={pending} className={`${secondaryButton} mt-2 w-full`}>{pending ? "Saving..." : "Save execution record"}</button> : null}
                </div>
              </div>)}
            </div>
          </section>;
        })}
      </div> : <p className="px-4 py-8 text-center text-sm text-muted">No execution steps were planned. You can still record observations and complete this Experiment.</p>}
      <div className="px-4 pb-4 pt-3"><label><span className={formLabelClass}>Execution notes</span><textarea key={state.savedAt ?? "initial"} name="quickNote" disabled={!editable || pending} placeholder="What happened at this stage? This is timestamped and appended to execution notes." className={`${fieldClass} min-h-24 resize-y`} /></label></div>
    </section>

    {editable ? <div className="sticky bottom-20 z-30 hidden space-y-2 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface/95 p-3 shadow-soft backdrop-blur lg:bottom-4 lg:block">
      {state.error ? <p role="alert" className="rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
      {state.message ? <p role="status" className="rounded-[var(--ln-radius-control-lg)] border border-success/30 bg-success-surface px-3 py-2 text-sm text-success">{state.message}</p> : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-xs text-muted">{hasSteps ? (remaining ? `${remaining} step${remaining === 1 ? "" : "s"} remaining` : "All planned steps checked") : "No checklist steps configured"}</span>
        {status === "planned" || status === "failed" ? <button type="submit" name="intent" value="start" disabled={pending} className={secondaryButton}><Play className="h-4 w-4" aria-hidden />{pending ? "Working…" : status === "failed" ? "Resume run" : "Start run"}</button> : null}
        <button type="submit" name="intent" value="save" disabled={pending} className={secondaryButton}><Save className="h-4 w-4" aria-hidden />{pending ? "Saving…" : "Save progress"}</button>
        <button type="submit" name="intent" value="complete" disabled={pending} className={primaryButton}><CheckCircle2 className="h-4 w-4" aria-hidden />{pending ? "Working…" : "Complete run"}</button>
      </div>
    </div> : null}
  </form>;
}
