'use client';

import { newClientMutationId } from '@/lib/client-mutation-id';

import { startTransition, useActionState, useRef, useState } from 'react';
import { confirmRunSystems, type ProtocolRunProgressState } from '@/app/experiments/[id]/run/actions';
import { resolveProtocolSystem, resolveProtocolDocument } from '@/lib/structured-protocol';
import Link from 'next/link';
import type { StructuredRunView } from '@/lib/structured-run';
import { ProtocolSystemChoice } from './ProtocolSystemLabels';
import { formInputClass } from './forms';
import { Button } from './ui/Button';
import { ProtocolCalculationPreview } from './ProtocolCalculationPreview';

function VersionSelection({ experimentId, version, view, editable, embedded }: { experimentId: string; version: StructuredRunView['versions'][number]; view: StructuredRunView; editable: boolean; embedded?: boolean }) {
  const systems = version.document.systems!;
  const adopted = view.plan.versions[version.id];
  const [selections, setSelections] = useState(adopted?.selections ?? {});
  const [actualInputs, setActualInputs] = useState(adopted?.actualInputs ?? {});
  const [state, action, pending] = useActionState<ProtocolRunProgressState, FormData>(confirmRunSystems, {});
  const [continuationKey] = useState(() => newClientMutationId());
  const resolution = resolveProtocolSystem(systems, selections, actualInputs, adopted?.calculations);
  const dirty = JSON.stringify(selections) !== JSON.stringify(adopted?.selections ?? {}) || JSON.stringify(actualInputs) !== JSON.stringify(adopted?.actualInputs ?? {});
  const proposed = resolveProtocolDocument(version.document, selections, actualInputs, adopted?.calculations);
  const prior = resolveProtocolDocument(version.document, adopted?.selections ?? {}, adopted?.actualInputs ?? {}, adopted?.calculations);
  const changes = proposed.steps.filter(step => JSON.stringify(step) !== JSON.stringify(prior.steps.find(s => s.source_ref === step.source_ref)));
  const scope = useRef<HTMLElement | null>(null);
  function submitEmbedded(intent = 'save', calculationId?: string) {
    const form = new FormData();
    scope.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[name], select[name]').forEach(field => {
      if (field.matches(':disabled') || field instanceof HTMLInputElement && ['checkbox', 'radio'].includes(field.type) && !field.checked) return;
      form.append(field.name, field.value);
    });
    form.set('intent', intent);
    if (calculationId) form.set('confirmCalculations', calculationId);
    startTransition(() => action(form));
  }
  const Container = embedded ? 'div' : 'form';
  return <Container ref={(node: HTMLDivElement | HTMLFormElement | null) => { scope.current = node; }} action={embedded ? undefined : action} className="protocol-system-section" data-run-system-selection>
    <input type="hidden" name="experimentId" value={experimentId}/><input type="hidden" name="versionId" value={version.id}/><input type="hidden" name="executionPlanRevision" value={view.plan.revision}/><input type="hidden" name="selections" value={JSON.stringify(selections)}/><input type="hidden" name="actualInputs" value={JSON.stringify(actualInputs)}/>
    <input type="hidden" name="continuationKey" value={continuationKey}/>
    <h3>{version.title} · v{version.displayVersion}</h3>
    <p>{adopted ? <>已确认 · <time dateTime={adopted.confirmedAt} suppressHydrationWarning>{new Date(adopted.confirmedAt).toLocaleString()}</time></> : '尚未确认体系；依赖这些选择的操作暂不可执行。'}</p>
    <fieldset disabled={!editable || pending} className="protocol-system-section">
      {systems.presets.length ? <div className="flex flex-wrap gap-2">{systems.presets.map(p => <Button type="button" key={p.id} size="sm" onClick={() => setSelections({ ...p.selections })}>{p.label}</Button>)}</div> : null}
      <div className="protocol-system-fields">{systems.dimensions.map(d => <label key={d.id}>{d.label}<select className={formInputClass} value={selections[d.id] ?? ''} onChange={event => { const next = { ...selections }; if (event.target.value) next[d.id] = event.target.value; else delete next[d.id]; setSelections(next); }}><option value="">待选择</option>{d.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>)}</div>
      {systems.parameters.filter(p => p.source.kind === 'actual').map(p => <label key={p.id}>{p.label} · {p.unit}<input aria-label={p.label} className={formInputClass} type="number" step="any" value={actualInputs[p.id]?.value ?? ''} onChange={e => { const next = { ...actualInputs }; if (e.target.value === '') delete next[p.id]; else next[p.id] = { value: Number(e.target.value), unit: p.unit }; setActualInputs(next); }}/></label>)}
      <div className="protocol-system-legend">{Object.entries(selections).map(([dimensionId, optionId]) => <ProtocolSystemChoice key={dimensionId} systems={systems} dimensionId={dimensionId} optionId={optionId}/>)}</div>
      {systems.parameters.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>参数</th><th>采用值</th><th>来源</th></tr></thead><tbody>{systems.parameters.map(p => <tr key={p.id}><td>{p.label}</td><td>{resolution.parameters[p.id]?.status === 'resolved' ? `${resolution.parameters[p.id].value} ${p.unit}` : resolution.parameters[p.id]?.message ?? '待填写'}</td><td>{{ fixed: '固定值', lookup: '条件查表', actual: '本次实际填写', calculator: '计算后确认' }[p.source.kind]}</td></tr>)}</tbody></table></div> : null}
      {systems.parameters.filter(p => p.source.kind === 'calculator').map(p => <ProtocolCalculationPreview key={p.id} parameter={p} resolution={resolution} receipt={adopted?.calculations[p.id]} disabled={!editable || pending} onConfirm={embedded ? () => submitEmbedded('save', p.id) : undefined}/>)}
      {dirty && adopted ? <p className="text-warning" role="status">选择已修改，以上是变更预览，尚未应用。影响已有执行记录时将拒绝覆盖。</p> : null}
      {dirty && adopted ? <ul aria-label="变更影响">{changes.map(s => <li key={s.source_ref}>{s.title} · {s.applicability === 'not-applicable' ? '改为不适用' : s.blocked ? '参数待确定' : '采用新参数／适用状态'}</li>)}</ul> : null}
      {resolution.issues.filter(i => !i.code.startsWith('parameter-unknown')).length ? <ul className="text-error">{resolution.issues.filter(i => !i.code.startsWith('parameter-unknown')).map((i, index) => <li key={index}>{i.message}</li>)}</ul> : null}
      {editable ? <Button type={embedded ? "button" : "submit"} onClick={embedded ? () => submitEmbedded() : undefined} variant="primary" disabled={pending || Boolean(adopted && !dirty)}>{pending ? '正在保存…' : adopted ? '确认变更并保存' : '确认本次体系'}</Button> : null}
      {state.error?.includes('继续实例') || state.error?.includes('旧计时器') ? <div className="grid gap-2"><p>请先核对样本此前已进行的操作。新实例只列出选定位置及之后尚需进行的操作，原完成记录保留在历史中；若选择已经完成的受影响步骤，会要求再次执行，请谨慎确认。</p><label>从哪一步继续<select name="continuationStartRef" className={formInputClass} defaultValue=""><option value="">请选择继续位置</option>{proposed.steps.filter(s => s.applicability !== 'not-applicable').map(s => <option key={`${version.id}:${s.source_ref}`} value={`${version.id}:${s.source_ref}`}>{s.title}</option>)}</select></label><label><input type="checkbox" name="cancelAffectedTimers" value="yes"/>确认取消受影响步骤的活动计时器，并保留取消记录（若有）</label><Button type={embedded ? "button" : "submit"} onClick={embedded ? () => submitEmbedded("continue") : undefined} name="intent" value="continue" disabled={pending}>保留原记录，创建继续实例</Button></div> : null}
      {state.continuationUrl ? <Link className="text-moss underline" href={state.continuationUrl}>打开继续执行实例</Link> : null}
    </fieldset>
    {state.error ? <p role="alert" className="text-error">{state.error}</p> : null}{state.message ? <p role="status">{state.message}</p> : null}
  </Container>;
}

export function RunSystemPreparation({ experimentId, view, editable, embedded = false }: { experimentId: string; view: StructuredRunView; editable: boolean; embedded?: boolean }) {
  if (!view.hasSystems) return null;
  return <section className="protocol-system-preparation" aria-label="实验准备与体系选择"><h3 className="font-semibold">本次实验体系</h3>{view.plan.continuation ? <div className="my-3 border-b border-hairline pb-3"><Link className="text-moss underline" href={`/experiments/${view.plan.continuation.experimentId}/run`}>查看此前执行及原始记录</Link><p>本次继续位置：{Object.values(view.steps).find(s => `${s.versionId}:${s.source_ref}` === view.plan.continuation!.startSourceRef)?.title}。此前已完成操作并未复制为本次完成。</p><details open><summary>此前处理与原采用参数（只读历史）</summary>{view.plan.continuation.history.map(s => <div key={s.sourceRef} className="my-3"><strong>{s.title} · {s.completed ? '此前已完成' : '原记录未完成'}</strong><p className="whitespace-pre-wrap">{s.description}</p>{Object.entries(s.actualValues).map(([id, v]) => <p key={id}>原实际记录：{v.value} {v.unit} · {v.recordedAt}</p>)}{s.deviationNote ? <p>原备注：{s.deviationNote}</p> : null}</div>)}</details></div> : null}{view.versions.map(version => <VersionSelection key={`${version.id}:${view.plan.revision}`} experimentId={experimentId} version={version} view={view} editable={editable} embedded={embedded}/>)}</section>;
}
