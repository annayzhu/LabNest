'use client';

import { newClientMutationId } from '@/lib/client-mutation-id';
import { startTransition, useActionState, useEffect, useState } from 'react';
import type { StructuredRunView } from '@/lib/structured-run';
import { saveStructuredStepRecord } from '@/app/experiments/[id]/run/actions';
import { formInputClass } from './forms';
import { Button } from './ui/Button';

export function StructuredStepRecord({ experimentId, stepId, structured, editable, completed }: { experimentId: string; stepId: string; structured?: Pick<StructuredRunView, 'steps' | 'plan'>; editable: boolean; completed: boolean }) {
  const [state, action, pending] = useActionState(saveStructuredStepRecord, {});
  const [values, setValues] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const draftKey = `labnest.structured-values:${experimentId}:${stepId}:${structured?.plan.revision}`;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null'); if (saved) { setValues(saved.values ?? {}); setReason(saved.reason ?? ''); } } catch { /* Draft recovery is best effort; server data stays authoritative. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, [draftKey]);
  const preserve = (nextValues: Record<string, string>, nextReason: string) => {
    try { sessionStorage.setItem(draftKey, JSON.stringify({ values: nextValues, reason: nextReason })); } catch { /* No persistence claim when storage is unavailable. */ }
  };
  const step = structured?.steps[stepId];
  if (!step || !structured) return null;
  const skipped = structured.plan.skips[stepId];
  const submit = (intent: 'actual' | 'skip' | 'unskip') => {
    const form = new FormData();
    form.set('experimentId', experimentId); form.set('stepId', stepId); form.set('executionPlanRevision', String(structured.plan.revision)); form.set('clientMutationId', newClientMutationId()); form.set('intent', intent); form.set('reason', reason);
    form.set('values', JSON.stringify(Object.fromEntries(step.actualFields.filter(f => values[f.id]?.trim()).map(f => [f.id, { value: Number(values[f.id]), unit: f.unit }]))));
    startTransition(() => action(form));
  };
  return <section className="mt-3 grid gap-2" data-structured-step-record>
    <p role="status">{completed ? '已完成' : skipped ? `已跳过 · ${skipped.reason}（不计为完成）` : step.blocked ? '待确定 · 请确认体系及依赖参数' : step.optional ? '可选操作' : '必需操作'}</p>
    {step.actualFields.map(field => <label key={field.id}>{field.label} · {field.unit}{field.required ? ' · 必填' : ''}<input aria-label={field.label} className={formInputClass} type="number" step="any" disabled={!editable || completed || pending || step.blocked} value={values[field.id] ?? structured.plan.actualValues[stepId]?.[field.id]?.value ?? ''} onChange={e => { const next = { ...values, [field.id]: e.target.value }; setValues(next); preserve(next, reason); }}/>{structured.plan.actualValues[stepId]?.[field.id] ? <small>已保存 · {structured.plan.actualValues[stepId][field.id].recordedAt}</small> : null}</label>)}
    {editable && !completed ? <>
      {step.actualFields.length ? <Button type="button" size="sm" disabled={pending || step.blocked || !Object.keys(values).length} onClick={() => submit('actual')}>保存实际值</Button> : null}
      <details><summary className="min-h-11 cursor-pointer">跳过操作</summary><label>跳过原因<input className={formInputClass} value={reason} onChange={e => { setReason(e.target.value); preserve(values, e.target.value); }}/></label><Button type="button" size="sm" disabled={pending || step.blocked || (!skipped && !reason.trim())} onClick={() => submit(skipped ? 'unskip' : 'skip')}>{skipped ? '撤销跳过' : '记录跳过'}</Button></details>
    </> : null}
    {state.error ? <p role="alert" className="text-error">{state.error}</p> : null}{state.message ? <p role="status">{state.message}</p> : null}
  </section>;
}
