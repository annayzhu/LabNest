'use client';
import { readableError } from '@/lib/form-actions';
import { RunGroupPreparation } from './RunGroupPreparation';
import { RunPreparationChecklist } from './RunPreparationChecklist';
import type { PreparationStock } from '@/lib/run-preparation';
import type { PlateAttachment } from './PlateLayoutView';
import { AttachmentUploadForm } from './AttachmentUploadForm';

import { newClientMutationId } from '@/lib/client-mutation-id';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { runQuantityLabels } from '@/lib/protocol-mix';
import { confirmRunSystems, type ProtocolRunProgressState } from '@/app/experiments/[id]/run/actions';
import { resolveProtocolSystem, resolveProtocolDocument } from '@/lib/structured-protocol';
import Link from 'next/link';
import type { StructuredRunView } from '@/lib/structured-run';
import { ProtocolSystemChoice } from './ProtocolSystemLabels';
import { calculationGroups } from '@/lib/protocol-calculations';
import { formInputClass } from './forms';
import { Button } from './ui/Button';
import { ProtocolCalculationPreview } from './ProtocolCalculationPreview';
import { parameterLongName } from '@/lib/protocol-chips';

function VersionSelection({ experimentId, version, view, editable }: { experimentId: string; version: StructuredRunView['versions'][number]; view: StructuredRunView; editable: boolean }) {
  const systems = version.document.systems!;
  const adopted = view.plan.versions[version.id];
  const [selections, setSelections] = useState(adopted?.selections ?? {});
  const [actualInputs, setActualInputs] = useState(adopted?.actualInputs ?? {});
  const [state, action, pending] = useActionState<ProtocolRunProgressState, FormData>(confirmRunSystems, {});
  const [expanded, setExpanded] = useState(!adopted);
  const [continuationKey] = useState(() => newClientMutationId());
  const resolution = resolveProtocolSystem(systems, selections, actualInputs, adopted?.calculations);
  const dirty = JSON.stringify(selections) !== JSON.stringify(adopted?.selections ?? {}) || JSON.stringify(actualInputs) !== JSON.stringify(adopted?.actualInputs ?? {});
  const proposed = resolveProtocolDocument(version.document, selections, actualInputs, adopted?.calculations);
  const prior = resolveProtocolDocument(version.document, adopted?.selections ?? {}, adopted?.actualInputs ?? {}, adopted?.calculations);
  const changes = proposed.steps.filter(step => JSON.stringify(step) !== JSON.stringify(prior.steps.find(s => s.source_ref === step.source_ref)));
  const stepChips = new Set(Object.values(view.steps).filter(step => step.versionId === version.id).flatMap(step => step.chipIds ?? []));
  // A calculation shown in a step is confirmed there, where its result is used; the rest stay here.
  const groups = calculationGroups(systems.parameters), inSteps = groups.filter(group => group.results.some(result => stepChips.has(result.id)));
  // Values filled at execution are entered where a step shows them (the chip or its calculation); only the rest stay here.
  const shownInSteps = new Set([...stepChips, ...inSteps.flatMap(group => Object.values(group.source.inputs))]);
  // Chips are often nameless: name them by material, tool field or what they measure.
  const nameOf = (parameter: typeof systems.parameters[number]) => parameterLongName(parameter, systems);
  return <details className="protocol-system-section" open={expanded || dirty || Boolean(state.error)} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary className="min-h-11 cursor-pointer font-medium">{version.groupLabel ?? version.title} · {adopted ? 'Confirmed · view or change systems' : 'Systems to confirm'}{adopted ? <span className="ml-2 text-sm font-normal text-muted">{systems.dimensions.map(d => d.options.find(o => o.id === adopted.selections[d.id])?.label ?? 'not chosen').join(' · ')}</span> : null}</summary>
    <form action={action} className="protocol-system-section" data-run-system-selection>
    <input type="hidden" name="experimentId" value={experimentId}/><input type="hidden" name="versionId" value={version.id}/><input type="hidden" name="executionPlanRevision" value={view.plan.revision}/><input type="hidden" name="selections" value={JSON.stringify(selections)}/><input type="hidden" name="actualInputs" value={JSON.stringify(actualInputs)}/>
    <input type="hidden" name="continuationKey" value={continuationKey}/>
    <h3>{version.groupLabel ? `${version.groupLabel} · ` : ''}{version.title} · v{version.displayVersion}</h3>
    <p>{adopted ? <>Confirmed · <time dateTime={adopted.confirmedAt} suppressHydrationWarning>{new Date(adopted.confirmedAt).toLocaleString()}</time></> : 'Systems not confirmed yet; operations that depend on these choices can’t run yet.'}</p>
    <fieldset disabled={!editable || pending} className="protocol-system-section">
      {systems.presets.length ? <div className="flex flex-wrap gap-2">{systems.presets.map(p => <Button className="min-h-11 whitespace-normal md:min-h-0" type="button" key={p.id} size="sm" onClick={() => setSelections({ ...p.selections })}>{p.label}</Button>)}</div> : null}
      <div className="protocol-system-fields">{systems.dimensions.map(d => <label key={d.id}>{d.label}<select className={formInputClass} value={selections[d.id] ?? ''} onChange={event => { const next = { ...selections }; if (event.target.value) next[d.id] = event.target.value; else delete next[d.id]; setSelections(next); }}><option value="">Not chosen</option>{d.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>)}</div>
      {systems.parameters.filter(p => p.source.kind === 'actual' && !shownInSteps.has(p.id)).map(p => <label key={p.id}>{nameOf(p)} · {p.unit}<input aria-label={nameOf(p)} className={formInputClass} type="number" step="any" value={actualInputs[p.id]?.value ?? ''} onChange={e => { const next = { ...actualInputs }; if (e.target.value === '') delete next[p.id]; else next[p.id] = { value: Number(e.target.value), unit: p.unit }; setActualInputs(next); }}/></label>)}
      <div className="protocol-system-legend">{Object.entries(selections).map(([dimensionId, optionId]) => <ProtocolSystemChoice key={dimensionId} systems={systems} dimensionId={dimensionId} optionId={optionId}/>)}</div>
      {inSteps.length ? <p className="text-sm text-muted">{`${inSteps.length === 1 ? '1 calculation is' : `${inSteps.length} calculations are`} confirmed in the steps that use them: click a calculation result in a step to fill it in and confirm.`}</p> : null}
      {groups.filter(group => !inSteps.includes(group)).map(group => <ProtocolCalculationPreview key={group.results[0].id} group={group} resolution={resolution} receipts={adopted?.calculations ?? {}} disabled={!editable || pending}/>)}
      {dirty && adopted ? <p className="text-warning" role="status">Selection changed: above is a preview of the change, not yet applied. It is refused if it would overwrite existing run records.</p> : null}
      {dirty && adopted ? <ul aria-label="Effect of the change">{changes.map(s => <li key={s.source_ref}>{s.title} · {s.applicability === 'not-applicable' ? 'Becomes not applicable' : s.blocked ? 'Parameters still to be determined' : 'Takes new parameters or applicability'}</li>)}</ul> : null}
      {resolution.issues.filter(i => !i.code.startsWith('parameter-unknown')).length ? <ul className="text-error">{resolution.issues.filter(i => !i.code.startsWith('parameter-unknown')).map((i, index) => <li key={index}>{i.message}</li>)}</ul> : null}
      {view.plan.groups.length > 1 ? <fieldset className="space-y-2"><legend>Also apply to other groups (ticked groups only)</legend>{view.versions.filter(other => other.sourceVersionId === version.sourceVersionId && other.id !== version.id).map(other => <label key={other.id} className="mr-4 inline-flex min-h-11 items-center gap-2"><input type="checkbox" name="applyToVersionIds" value={other.id}/>{other.groupLabel}</label>)}</fieldset> : null}
      {editable ? <Button className="min-h-11 whitespace-normal md:min-h-0" type="submit" variant="primary" disabled={pending || Boolean(adopted && !dirty && view.plan.groups.length < 2)}>{pending ? 'Saving selection…' : adopted ? 'Confirm and save changes' : 'Confirm systems for this run'}</Button> : null}
      {state.error?.includes('继续实例') || state.error?.includes('旧计时器') ? <div className="grid gap-2"><p>First check what has already been done to the samples. The new run lists only the operations still needed from the chosen point on, and the original completion records stay in the history; choosing an affected step that was already completed means doing it again, so confirm with care.</p><label>Continue from step<select name="continuationStartRef" className={formInputClass} defaultValue=""><option value="">Choose where to continue</option>{proposed.steps.filter(s => s.applicability !== 'not-applicable').map(s => <option key={`${version.id}:${s.source_ref}`} value={`${version.id}:${s.source_ref}`}>{s.title}</option>)}</select></label><label><input type="checkbox" name="cancelAffectedTimers" value="yes"/>Cancel running timers on the affected steps and keep a record of the cancellation (if any)</label><Button className="min-h-11 whitespace-normal md:min-h-0" type="submit" name="intent" value="continue" disabled={pending}>Keep the original record and create a continuation</Button></div> : null}
      {state.continuationUrl ? <Link className="text-moss underline" href={state.continuationUrl}>Open the continuation run</Link> : null}
    </fieldset>
    {state.error ? <p role="alert" className="text-error">{state.error}</p> : null}{state.message ? <p role="status">{state.message}</p> : null}
  </form></details>;
}

export function RunSystemPreparation({ experimentId, view, editable, plates = [], stock = [], recorded = [] }: { experimentId: string; view: StructuredRunView; editable: boolean; plates?: PlateAttachment[]; stock?: PreparationStock[]; recorded?: Array<{ source: string }> }) {
  if (!view.hasSystems) return null;
  return <section className="protocol-system-preparation" aria-label="Preparation and system choice"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Preparation · systems and groups</h2><a href="#run-execution" className="focus-ring inline-flex min-h-11 items-center text-moss underline">Start or continue the current step</a></div><RunGroupPreparation experimentId={experimentId} plan={view.plan} editable={editable}/><p>Preparation items don’t count toward step progress. The adopted source versions are fixed; the run works with AI turned off.</p>{view.plan.continuation ? <div className="my-3 border-b border-hairline pb-3"><Link className="text-moss underline" href={`/experiments/${view.plan.continuation.experimentId}/run`}>View the earlier run and its original records</Link><p>{`Continuing from: ${Object.values(view.steps).find(s => `${s.versionId}:${s.source_ref}` === view.plan.continuation!.startSourceRef)?.title ?? ''}. Operations completed earlier are not copied as completed in this run.`}</p><details open><summary>Earlier handling and adopted parameters (read-only history)</summary>{view.plan.continuation.history.map(s => <div key={s.sourceRef} className="my-3"><strong>{s.title} · {s.completed ? 'Completed earlier' : 'Not completed in the original record'}</strong><p className="whitespace-pre-wrap">{s.description}</p>{Object.entries(s.actualValues).map(([id, v]) => <p key={id}>{`Original actual value: ${v.value} ${v.unit} · ${v.recordedAt}`}</p>)}{s.deviationNote ? <p>{`Original note: ${s.deviationNote}`}</p> : null}</div>)}</details></div> : null}{view.versions.map(version => <div key={`${version.id}:${view.plan.revision}`}><VersionSelection experimentId={experimentId} version={version} view={view} editable={editable}/><RunQuantities experimentId={experimentId} version={version} view={view} editable={editable}/></div>)}<RunPreparationChecklist experimentId={experimentId} view={view} editable={editable} plates={plates} stock={stock} recorded={recorded}/>
    {editable ? <details className="ln-prep-upload"><summary>Attach a plate layout (the planner’s “Back up project” JSON, or an exported SVG or image)</summary><AttachmentUploadForm targetType="experiment" targetId={experimentId} hideTargetFields fileLabel="Plate layout file" accept=".json,.svg,image/*" linkType="plate_layout"/></details> : null}
  </section>;
}

/** Run quantities (本次数量) for one Protocol (group): the counts its mix cards and material amounts scale by, e.g. 反应数 24, 孔数 6. */
function RunQuantities({ experimentId, version, view, editable }: { experimentId: string; version: StructuredRunView['versions'][number]; view: StructuredRunView; editable: boolean }) {
  const router = useRouter();
  const labels = runQuantityLabels(version.document);
  const saved = view.plan.quantities[version.id] ?? {};
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  if (!labels.length) return null;
  const changed = Object.entries(draft).filter(([label, text]) => text.trim() !== String(saved[label] ?? ''));
  const valid = changed.every(([, text]) => !text.trim() || (Number(text) > 0 && Number.isFinite(Number(text))));
  const save = () => startTransition(async () => {
    const { setRunQuantities } = await import('@/app/experiments/[id]/run/actions');
    const result = await setRunQuantities({ experimentId, versionId: version.id, expectedRevision: view.plan.revision, quantities: Object.fromEntries(changed.map(([label, text]) => [label, text.trim() ? Number(text) : null])) });
    setMessage(result.error ? readableError(result.error) : 'Saved; mix cards that use it need confirming for the new quantity.');
    if (!result.error) { setDraft({}); router.refresh(); }
  });
  return <div className="ln-run-quantities" role="group" aria-label={`${version.groupLabel ?? version.title} · Run quantities`}>
    <span className="ln-run-quantities-title">Run quantities{version.groupLabel ? ` · ${version.groupLabel}` : ''}</span>
    {labels.map(label => <label key={label}>{label}<input inputMode="numeric" disabled={!editable || pending} value={draft[label] ?? String(saved[label] ?? '')} placeholder="—" onChange={event => setDraft(current => ({ ...current, [label]: event.target.value }))} /></label>)}
    {editable ? <Button type="button" size="sm" disabled={pending || !changed.length || !valid} onClick={save}>{pending ? 'Saving quantities…' : 'Save quantities'}</Button> : null}
    {message ? <small role="status">{message}</small> : null}
  </div>;
}
