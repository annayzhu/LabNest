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
        void enqueueMobileMutation({ clientMutationId: String(form.get('clientMutationId')), actionType: 'step.record', deviceCreatedAt: new Date().toISOString(), state: 'pending', retryCount: 0, payload: { experimentId, experimentStepId: stepId, executionPlanRevision: structured.plan.revision, queueContext, intent, reason, values: JSON.parse(String(form.get('values'))) } }).then(() => setOfflineMessage('已保存至本机，等待同步；服务端实际记录尚未改变。')).catch(error => setOfflineMessage(`本机保存失败：${String(error)}`));
      } catch { setOfflineMessage('本机存储不可用，未保存。请保留页面。'); }
      return;
    }
    submitted.current = { key: draftKey, intent, values, reason };
    startTransition(() => action(form));
  };
  return <section className="mt-3 grid gap-2" data-structured-step-record>
    {offlineMessage || queued.length ? <p role="status" className="text-warning">{offlineMessage || `本步骤有 ${queued.length} 条本机记录等待核对或同步。`}</p> : null}
    {reviewDraft ? <div role="alert" className="text-warning"><p>此操作或已保存记录发生变更，本机草稿尚未应用，请先核对。</p><ul>{Object.entries(reviewDraft.values).map(([id, value]) => <li key={id}>{reviewDraft.contextChanged ? "此前实际值" : ruleFields.find(field => field.id === id)?.label ?? "此前实际值"}：{value || "未填写"}{!reviewDraft.contextChanged ? ` ${ruleFields.find(field => field.id === id)?.unit ?? ""}` : "（请核对原操作单位）"}</li>)}{reviewDraft.reason ? <li>未提交原因：{reviewDraft.reason}</li> : null}</ul>
      {!reviewDraft.contextChanged ? <Button type="button" onClick={() => { setValues(reviewDraft.values); setReason(reviewDraft.reason); preserve(reviewDraft.values, reviewDraft.reason); setReviewDraft(null); }}>核对后保留本机草稿</Button> : <p>操作或单位已变化，请按当前要求重新填写。</p>}
      <Button type="button" onClick={() => { setValues({}); setReason(''); setReviewDraft(null); try { sessionStorage.removeItem(draftKey); } catch { /* Best effort. */ } }}>放弃本机草稿</Button></div> : null}
    <p role="status">{completed ? '已完成' : skipped ? `已跳过 · ${skipped.reason}（不计为完成）` : step.blocked ? '待确定 · 请确认体系及依赖参数' : step.optional ? '可选操作' : '必需操作'}</p>
    {ruleFields.map(field => {
      const saved = structured.plan.actualValues[stepId]?.[field.id];
      const draft = values[field.id];
      const dirty = draft !== undefined && (draft.trim() === '' || Number(draft) !== saved?.value);
      return <label key={field.id}>{field.label} · {field.unit}{field.required ? ' · 必填' : ''}<input aria-label={field.label} className={formInputClass} type="number" step="any" disabled={!editable || completed || pending || step.blocked || Boolean(reviewDraft)} value={draft ?? saved?.value ?? ''} onChange={e => { const next = { ...values, [field.id]: e.target.value }; setValues(next); preserve(next, reason); }}/>
        {dirty ? <small role="status" className="text-warning">{pendingValues?.[field.id]?.value===Number(draft) && draft?.trim() ? "本机已保存 · 待同步" : "未保存修改"}</small> : null}
        {saved ? <small>{dirty ? `上次保存：${saved.value} ${saved.unit}` : '已保存'} · <time dateTime={saved.recordedAt} suppressHydrationWarning>{new Date(saved.recordedAt).toLocaleString()}</time></small> : null}
      </label>;
    })}
    {editable && !completed ? <>
      {ruleFields.length ? <Button type="button" size="sm" disabled={pending || step.blocked || Boolean(reviewDraft) || !hasChanges || matchesPending} onClick={() => submit('actual')}>{pending ? '正在保存…' : '保存实际值'}</Button> : null}
      <details><summary className="min-h-11 cursor-pointer">跳过操作</summary><label>跳过原因<input className={formInputClass} disabled={pending || Boolean(reviewDraft)} value={reason} onChange={e => { setReason(e.target.value); preserve(values, e.target.value); }}/></label><Button type="button" size="sm" disabled={pending || step.blocked || Boolean(reviewDraft) || (!skipped && !reason.trim())} onClick={() => submit(skipped ? 'unskip' : 'skip')}>{skipped ? '撤销跳过' : '记录跳过'}</Button></details>
    </> : null}
    {state.error ? <p role="alert" className="text-error">{state.error}</p> : null}{state.message && !hasChanges ? <p role="status">{state.message}</p> : null}
  </section>;
}
