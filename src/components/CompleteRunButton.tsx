"use client";

import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { saveProtocolRunProgress } from "@/app/experiments/[id]/run/actions";
import { CompletionConsumptionDialog, recordRunConsumption, type ConsumptionChoice, type ConsumptionStock } from "@/components/RunConsumption";
import { Button } from "@/components/ui/Button";
import { DialogHeader, dialogClass } from "@/components/ui/DialogShell";
import type { ConsumptionLine } from "@/lib/run-consumption";

/**
 * 完成执行 where the record shows its status (Q462): offered once every required step is checked, from wherever they were checked.
 * It asks first: about this run's unrecorded use when there is some, otherwise a plain confirmation.
 */
export function CompleteRunButton({ experimentId, executionPlanRevision, consumption, stock }: {
  experimentId: string;
  /** Only a structured run has one: the save refuses a plan changed since, and the run is fixed once complete. */
  executionPlanRevision?: number;
  consumption: ConsumptionLine[];
  stock: ConsumptionStock[];
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function complete(choices: ConsumptionChoice[] = []) {
    setAsking(false);
    setError("");
    startTransition(async () => {
      const data = new FormData();
      data.set("experimentId", experimentId);
      data.set("intent", "complete");
      if (executionPlanRevision !== undefined) data.set("executionPlanRevision", String(executionPlanRevision));
      // The saved ticks stand: a step ticked or unticked elsewhere since this page loaded is not overwritten.
      data.set("checklist", "saved");
      const result = await saveProtocolRunProgress({}, data);
      if (result.error) { setError(result.error); return; }
      // Usage is written only once the run really completed, as on the run page.
      if (choices.length) {
        try { await recordRunConsumption(experimentId, choices); }
        catch (cause) { setError(`The run is complete, but not all of its use was written · ${cause instanceof Error ? cause.message : "record it under “Reagents and consumables used in this run”"}`); }
      }
      router.refresh();
    });
  }

  return <div className="space-y-1.5">
    <Button type="button" variant="primary" size="md" className="w-full" disabled={pending} onClick={() => setAsking(true)}><CheckCircle2 className="h-4 w-4" aria-hidden />{pending ? "Working…" : "Complete run"}</Button>
    {error ? <p role="alert" className="text-xs leading-5 text-error">{error}</p> : null}
    {asking && consumption.length ? <CompletionConsumptionDialog lines={consumption} stock={stock} onCancel={() => setAsking(false)} onSkip={() => complete()} onDeduct={complete} /> : null}
    {asking && !consumption.length ? <ConfirmCompletion fixesSteps={executionPlanRevision !== undefined} onCancel={() => setAsking(false)} onConfirm={() => complete()} /> : null}
  </div>;
}

function ConfirmCompletion({ fixesSteps, onCancel, onConfirm }: { fixesSteps: boolean; onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; if (element && !element.open) element.showModal(); return () => element?.close(); }, []);
  return createPortal(<dialog ref={dialog} aria-labelledby="complete-run-title" className={dialogClass()} onCancel={event => { event.preventDefault(); onCancel(); }}>
    <DialogHeader title="Complete this run?" titleId="complete-run-title" onClose={onCancel} />
    <div className="ln-dialog-body"><p className="text-sm text-graphite">{fixesSteps ? "Steps, actual values and deviations can no longer be changed once the run is complete." : "Unticking a step later reopens the run."}</p></div>
    <div className="ln-dialog-footer">
      <Button type="button" onClick={onCancel}>Back</Button>
      <Button type="button" variant="primary" onClick={onConfirm}>Complete run</Button>
    </div>
  </dialog>, document.body);
}
