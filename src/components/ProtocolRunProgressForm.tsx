"use client";

import { CheckCircle2, Circle, Play, Save } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { saveProtocolRunProgress, type ProtocolRunProgressState } from "@/app/experiments/[id]/run/actions";
import { formLabelClass, formTextareaClass } from "@/components/forms";
import { buttonStyles } from "@/components/ui/Button";
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

  return <form action={formAction} className="space-y-4">
    <input type="hidden" name="experimentId" value={experimentId} />
    <section className="overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
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

    {editable ? <div className="sticky bottom-20 z-30 space-y-2 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface/95 p-3 shadow-soft backdrop-blur md:bottom-4">
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
