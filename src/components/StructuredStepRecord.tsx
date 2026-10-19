'use client';

import { useQueuedRunRecords } from './useQueuedRunRecords';
import { enqueueMobileMutation, orderMobileMutations, runQueueContext } from '@/lib/mobile-mutation-queue';
import { newClientMutationId } from '@/lib/client-mutation-id';
import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { reconcileStructuredStepDraft, type StructuredStepDraft } from '@/lib/structured-step-draft';
import type { StructuredRunView } from '@/lib/structured-run';
import { saveStructuredStepRecord } from '@/app/experiments/[id]/run/actions';
import { formInputClass } from './forms';
import { Button } from './ui/Button';

export function StructuredStepRecord({ experimentId, stepId, structured, editable, completed }: { experimentId: string; stepId: string; structured?: Pick<StructuredRunView, 'steps' | 'plan'>; editable: boolean; completed: boolean }) {
  const [state, action, pending] = useActionState(saveStructuredStepRecord, {});
  const queued = useQueuedRunRecords(experimentId).filter(item => item.payload.experimentStepId === stepId);
  const [offlineMessage, setOfflineMessage] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const submitted = useRef<{ key: string; intent: string; values: Record<string, string>; reason: string } | null>(null);
  const step = structured?.steps[stepId];
  const draftKey = `labnest.structured-values:${experimentId}:${stepId}`;
  const context = JSON.stringify({ source: step?.source_ref, fields: step?.actualFields, content: step?.content_blocks, blocked: step?.blocked });
  const recorded = JSON.stringify(structured?.plan.actualValues[stepId] ?? {});
  const [reviewDraft, setReviewDraft] = useState<ReturnType<typeof reconcileStructuredStepDraft> | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null') as StructuredStepDraft | null;
        if (saved) {
          const restored = reconcileStructuredStepDraft(saved, context, JSON.parse(recorded));
          setReviewDraft(restored.needsReview ? restored : null);
          if (!restored.contextChanged) { setValues(restored.values); setReason(restored.reason); }
          if (!restored.needsReview) {
            if (Object.keys(restored.values).length || restored.reason) sessionStorage.setItem(draftKey, JSON.stringify({ values: restored.values, reason: restored.reason, context, recorded }));
            else sessionStorage.removeItem(draftKey);
          }
        }
      } catch { /* Draft recovery is best effort; server data stays authoritative. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, [draftKey, context, recorded]);
  const preserve = (nextValues: Record<string, string>, nextReason: string) => {
    try { sessionStorage.setItem(draftKey, JSON.stringify({ values: nextValues, reason: nextReason, context, recorded })); } catch { /* No persistence claim when storage is unavailable. */ }
  };
  useEffect(() => {
    if (!state.savedAt || !submitted.current) return;
    const saved = submitted.current;
    submitted.current = null;
    // Clear only the successfully submitted part; unrelated notes stay local.
    const remaining = saved.intent === 'actual' ? { values: {}, reason: saved.reason } : { values: saved.values, reason: '' };
    try {
      if (Object.keys(remaining.values).length || remaining.reason) sessionStorage.setItem(draftKey, JSON.stringify({ ...remaining, context, recorded }));
      else sessionStorage.removeItem(draftKey);
      if (saved.key !== draftKey) sessionStorage.removeItem(saved.key);
    } catch { /* A successful server write does not depend on browser storage. */ }
    const frame = requestAnimationFrame(() => { setValues(remaining.values); setReason(remaining.reason); });
    return () => cancelAnimationFrame(frame);
  }, [state.savedAt, draftKey, context, recorded]);
  if (!step || !structured) return null;
  // Fields the Protocol lists for this step; a chip's own actual value is recorded by clicking the chip.
  const ruleFields = step.actualFields.filter(field => !field.source);
  const skipped = structured.plan.skips[stepId];
  const queuedActual = [...orderMobileMutations(queued)].reverse().find(item=>item.actionType==='step.record' && item.payload.intent==='actual');
  const pendingValues = queuedActual?.actionType==='step.record' ? queuedActual.payload.values : undefined;
  const matchesPending = Boolean(pendingValues && ruleFields.every(field=>values[field.id]?.trim() && Number(values[field.id])===pendingValues[field.id]?.value && field.unit===pendingValues[field.id]?.unit));
  const hasChanges = ruleFields.some(field => values[field.id] !== undefined &&
    (values[field.id].trim() === '' || Number(values[field.id]) !== structured.plan.actualValues[stepId]?.[field.id]?.value));
  const submit = (intent: 'actual' | 'skip' | 'unskip') => {
    const form = new FormData();
    form.set('experimentId', experimentId); form.set('stepId', stepId); form.set('executionPlanRevision', String(structured.plan.revision)); form.set('clientMutationId', newClientMutationId()); form.set('intent', intent); form.set('reason', reason);
    form.set('values', JSON.stringify(Object.fromEntries(ruleFields.filter(f => values[f.id]?.trim()).map(f => [f.id, { value: Number(values[f.id]), unit: f.unit }]))));
    if (!navigator.onLine) {
      try {
        const queueContext = runQueueContext(`${step.versionId.split('@')[0]}:${step.source_ref}`);
        void enqueueMobileMutation({ clientMutationId: String(form.get('clientMutationId')), actionType: 'step.record', deviceCreatedAt: new Date().toISOString(), state: 'pending', retryCount: 0, payload: { experimentId, experimentStepId: stepId, executionPlanRevision: structured.plan.revision, queueContext, intent, reason, values: JSON.parse(String(form.get('values'))) } }).then(() => setOfflineMessage('Saved on this device, waiting to sync; the actual values on the server have not changed yet.')).catch(error => setOfflineMessage(`Not saved on this device · ${String(error)}`));
      } catch { setOfflineMessage('Storage on this device is unavailable; nothing was saved. Keep this page open.'); }
      return;
    }
    submitted.current = { key: draftKey, intent, values, reason };
    startTransition(() => action(form));
  };
  return <section className="mt-3 grid gap-2" data-structured-step-record>
    {offlineMessage || queued.length ? <p role="status" className="text-warning">{offlineMessage || `${queued.length} record${queued.length === 1 ? '' : 's'} on this device for this step, waiting to be checked or synced.`}</p> : null}
    {reviewDraft ? <div role="alert" className="text-warning"><p>This operation or its saved record has changed, so the draft on this device was not applied. Check it first.</p><ul>{Object.entries(reviewDraft.values).map(([id, value]) => { const field = reviewDraft.contextChanged ? undefined : ruleFields.find(item => item.id === id); return <li key={id}>{field ? `Draft value for ${field.label} (${field.unit}) · ${value || 'not filled in'}` : `Earlier actual value · ${value || 'not filled in'}${reviewDraft.contextChanged ? ' · check the unit of the original operation' : ' '}`}</li>; })}{reviewDraft.reason ? <li>{`Skip reason not submitted · ${reviewDraft.reason}`}</li> : null}</ul>
      {!reviewDraft.contextChanged ? <Button type="button" onClick={() => { setValues(reviewDraft.values); setReason(reviewDraft.reason); preserve(reviewDraft.values, reviewDraft.reason); setReviewDraft(null); }}>Keep the draft on this device after checking</Button> : <p>The operation or its unit has changed; fill it in again as now required.</p>}
      <Button type="button" onClick={() => { setValues({}); setReason(''); setReviewDraft(null); try { sessionStorage.removeItem(draftKey); } catch { /* Best effort. */ } }}>Discard the draft on this device</Button></div> : null}
    <p role="status">{completed ? 'Completed' : skipped ? `Skipped · ${skipped.reason} (not counted as complete)` : step.blocked ? 'To be determined · confirm the systems and the parameters it depends on' : step.optional ? 'Optional operation' : 'Required operation'}</p>
    {ruleFields.map(field => {
      const saved = structured.plan.actualValues[stepId]?.[field.id];
      const draft = values[field.id];
      const dirty = draft !== undefined && (draft.trim() === '' || Number(draft) !== saved?.value);
      return <label key={field.id}>{field.label} · {field.unit}{field.required ? ' · required' : ''}<input aria-label={field.label} className={formInputClass} type="number" step="any" disabled={!editable || completed || pending || step.blocked || Boolean(reviewDraft)} value={draft ?? saved?.value ?? ''} onChange={e => { const next = { ...values, [field.id]: e.target.value }; setValues(next); preserve(next, reason); }}/>
        {dirty ? <small role="status" className="text-warning">{pendingValues?.[field.id]?.value===Number(draft) && draft?.trim() ? "Saved on this device · waiting to sync" : "Unsaved change"}</small> : null}
        {saved ? <small>{dirty ? `Last saved value ${saved.value} ${saved.unit}` : 'Saved'} · <time dateTime={saved.recordedAt} suppressHydrationWarning>{new Date(saved.recordedAt).toLocaleString()}</time></small> : null}
      </label>;
    })}
    {editable && !completed ? <>
      {ruleFields.length ? <Button type="button" size="sm" disabled={pending || step.blocked || Boolean(reviewDraft) || !hasChanges || matchesPending} onClick={() => submit('actual')}>{pending ? 'Saving the values…' : 'Save actual values'}</Button> : null}
      <details><summary className="min-h-11 cursor-pointer">Skip this operation</summary><label>Reason for skipping<input className={formInputClass} disabled={pending || Boolean(reviewDraft)} value={reason} onChange={e => { setReason(e.target.value); preserve(values, e.target.value); }}/></label><Button type="button" size="sm" disabled={pending || step.blocked || Boolean(reviewDraft) || (!skipped && !reason.trim())} onClick={() => submit(skipped ? 'unskip' : 'skip')}>{skipped ? 'Undo skip' : 'Record skip'}</Button></details>
    </> : null}
    {state.error ? <p role="alert" className="text-error">{state.error}</p> : null}{state.message && !hasChanges ? <p role="status">{state.message}</p> : null}
  </section>;
}
