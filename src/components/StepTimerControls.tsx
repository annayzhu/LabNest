"use client";
import {useI18n} from "@/components/I18nProvider";

import { useRunClock } from "./useRunClock";
import { Pause, Play, RotateCcw, Timer, Square } from "lucide-react";
import { startTransition, useActionState, useEffect, useState } from "react";
import { updateStepTimer, type StepTimerActionState } from "@/app/experiments/[id]/run/actions";
import { formatStepTimer, remainingStepTimerSeconds } from "@/lib/step-timer";

const initialState: StepTimerActionState = {};

export function StepTimerControls({ experimentId, step, compact=false, executionPlanRevision, disabled=false }: {
  executionPlanRevision?: number;
  disabled?: boolean;
  compact?:boolean;
  experimentId: string;
  step: {
    id: string;
    timerDurationSeconds: number | null;
    timerRemainingSeconds: number | null;
    timerStartedAt: Date | null;
    timerPausedAt: Date | null;
  };
}) {
  const {locale}=useI18n();
  const [state, formAction, pending] = useActionState(updateStepTimer, initialState);
  const [expanded,setExpanded]=useState(false);
  const expansionKey = `labnest.timer-expanded:${experimentId}:${step.id}`;
  useEffect(() => {
    const frame = requestAnimationFrame(() => { try { setExpanded(sessionStorage.getItem(expansionKey) === 'true'); } catch {} });
    return () => cancelAnimationFrame(frame);
  }, [expansionKey]);
  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    try { sessionStorage.setItem(expansionKey, String(next)); } catch {}
  }
  const clock = useRunClock();
  const clockWarning = clock.uncertain;
  const [durationMinutes, setDurationMinutes] = useState("5");
  const durationSeconds = step.timerDurationSeconds ?? 300;
  const remaining = remainingStepTimerSeconds({
    remainingSeconds: step.timerRemainingSeconds ?? durationSeconds,
    startedAt: step.timerStartedAt,
    now: new Date(clock.now),
  });
  const running = Boolean(step.timerStartedAt) && remaining > 0;
  const configured = step.timerDurationSeconds !== null;

  function submitTimerIntent(timerIntent: "start" | "pause" | "reset" | "finish") {
    const formData = new FormData();
    formData.set("experimentId", experimentId);
    formData.set("stepId", step.id);
    formData.set("timerIntent", timerIntent);
    if (executionPlanRevision !== undefined) formData.set('executionPlanRevision', String(executionPlanRevision));
    if (!configured) formData.set("durationMinutes", durationMinutes);
    startTransition(() => formAction(formData));
  }

  return <>{compact?<button type="button" aria-expanded={expanded} onClick={toggleExpanded} className="flex min-h-11 items-center justify-center gap-1 rounded-lg border border-hairline px-2 text-sm text-moss"><Timer className="h-4 w-4" aria-hidden/>{locale==="zh"?"计时器":"Timer"}{configured?<span className="font-mono text-xs">{formatStepTimer(remaining)}</span>:null}</button>:null}<section hidden={compact&&!expanded} aria-label="Step timer" className="col-span-2 rounded-[var(--ln-radius-panel-inner)] border border-info/30 bg-info-surface p-3">
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm font-semibold text-ink"><Timer className="h-4 w-4 text-info" aria-hidden />Step timer</span>
      <span className="font-mono text-xl font-semibold tabular-nums text-ink" aria-live="off">{formatStepTimer(remaining)}</span>
    </div>
    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
      {!configured ? <label className="min-w-0"><span className="sr-only">Timer duration in minutes</span><input value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} type="number" min="0.1" max="1440" step="0.1" className="focus-ring h-11 w-full rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-3 text-sm text-ink" aria-label="Timer duration in minutes" /></label> : <span className="flex min-h-11 items-center text-xs text-muted">{Math.round(durationSeconds / 60)} min preset</span>}
      <button type="button" onClick={() => submitTimerIntent(running ? "pause" : "start")} disabled={pending || disabled || clockWarning || !clock.online || remaining === 0} className="focus-ring flex h-11 min-w-11 items-center justify-center gap-2 rounded-[var(--ln-radius-control-md)] border border-info/35 bg-surface px-3 text-sm font-semibold text-info">
        {running ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}<span className="hidden min-[360px]:inline">{running ? "Pause" : step.timerPausedAt ? "Resume" : "Start"}</span>
      </button>
      <button type="button" onClick={() => submitTimerIntent("reset")} disabled={pending || disabled || clockWarning || !clock.online} aria-label="Reset timer" className="focus-ring flex h-11 w-11 items-center justify-center rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface text-muted"><RotateCcw className="h-4 w-4" aria-hidden /></button>
    </div>
    {configured && (step.timerStartedAt || (step.timerRemainingSeconds ?? 0) > 0) ? <button type="button" disabled={pending || disabled || clockWarning || !clock.online} className="focus-ring mt-2 flex min-h-11 items-center gap-2 text-sm text-moss" onClick={() => submitTimerIntent('finish')}><Square size={14}/>End timer (the step still needs confirming)</button> : null}
    {configured && remaining === 0 ? <p role="status" className="mt-2 text-sm">The timer reached zero; the step is not completed automatically. Reset before timing again.</p> : null}
    {!clock.online ? <p role="status" className="text-warning">Offline, the timer keeps showing; start, pause and reset need a connection to confirm, so nothing runs late after reconnecting.</p> : null}
    {clockWarning ? <p role="alert" className="text-warning">The clock is not calibrated yet or the device time changed; check it once online. The current display is not a precise timing reference.</p> : null}
    {state.error ? <p role="alert" className="mt-2 text-xs text-error">{state.error}</p> : null}
    {state.message ? <p role="status" className="mt-2 text-xs text-success">{state.message} Synced.</p> : null}
  </section></>;
}
