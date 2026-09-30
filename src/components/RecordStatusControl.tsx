"use client";

import { Lock } from "lucide-react";
import { useActionState, useState } from "react";
import { setRecordStatus, type RecordStatusState } from "@/app/records/actions";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { isRecordLocked } from "@/lib/record-lifecycle";

const statuses = ["draft", "recorded", "submitted", "reviewed"] as const;

type Props = { targetType: "experiment" | "entry"; id: string; recordStatus: string };

// React resets a form after its action; remounting on the saved status keeps the select in sync with the record.
export function RecordStatusControl(props: Props) {
  return <RecordStatusForm key={props.recordStatus} {...props} />;
}

function RecordStatusForm({ targetType, id, recordStatus }: Props) {
  const [state, action, pending] = useActionState<RecordStatusState, FormData>(setRecordStatus, {});
  const [next, setNext] = useState(recordStatus);
  const locked = isRecordLocked(recordStatus);
  const reopening = locked && !isRecordLocked(next);
  return <form action={action} className="space-y-2">
    <input type="hidden" name="targetType" value={targetType} />
    <input type="hidden" name="id" value={id} />
    {locked ? <p className="flex items-start gap-1.5 text-xs leading-5 text-graphite"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-moss" aria-hidden /><span>Read-only while submitted or reviewed. Reopening needs a reason and is kept in the activity history.</span></p> : null}
    <div className="flex items-end gap-2">
      <label className="min-w-0 flex-1"><span className={formLabelClass}>Record status</span>
        <select name="recordStatus" value={next} onChange={(event) => setNext(event.target.value)} disabled={pending} className={`${formInputClass} h-9`}>
          {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </label>
      <Button type="submit" size="md" disabled={pending || next === recordStatus} className="h-9">{pending ? "Saving…" : "Update"}</Button>
    </div>
    {reopening ? <label className="block"><span className={formLabelClass}>Reason for reopening</span><textarea name="reason" required maxLength={2000} className={`${formTextareaClass} min-h-16`} /></label> : null}
    {state.error ? <p role="alert" className="text-xs text-error">{state.error}</p> : null}
    {state.message ? <p role="status" className="text-xs text-success">{state.message}</p> : null}
  </form>;
}
