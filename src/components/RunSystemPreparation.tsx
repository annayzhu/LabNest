'use client';
import { readableError } from '@/lib/form-actions';
import { RunGroupPreparation } from './RunGroupPreparation';
import { RunPreparationChecklist } from './RunPreparationChecklist';
import { preparationChecklist, type PreparationSamples, type PreparationStock } from '@/lib/run-preparation';
import { runSampleCount } from '@/lib/experiment-samples';
import type { PlateAttachment } from './PlateLayoutView';

import { newClientMutationId } from '@/lib/client-mutation-id';

import { Fragment, useActionState, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { runQuantityLabels, runQuantityLabelText } from '@/lib/protocol-mix';
import { systemLabelText } from '@/lib/protocol-conditions';
import { confirmRunSystems, type ProtocolRunProgressState } from '@/app/experiments/[id]/run/actions';
import { resolveProtocolSystem, resolveProtocolDocument } from '@/lib/structured-protocol';
import Link from 'next/link';
import type { StructuredRunView } from '@/lib/structured-run';
import { ProtocolSystemChoice } from './ProtocolSystemLabels';
import { calculationGroups } from '@/lib/protocol-calculations';
import { formInputClass } from './forms';
import { Button } from './ui/Button';
import { ProtocolCalculationPreview } from './ProtocolCalculationPreview';
import { filledAtRun, parameterLongName } from '@/lib/protocol-chips';

type Version = StructuredRunView['versions'][number];

/** What a group enters in preparation besides 本次数量: values and calculations that no step shows. */
function preparationInputs(version: Version, view: StructuredRunView) {
  const systems = version.document.systems!;
  const stepChips = new Set(Object.values(view.steps).filter(step => step.versionId === version.id).flatMap(step => step.chipIds ?? []));
  // A calculation shown in a step is confirmed there, where its result is used; the rest stay here.
  const groups = calculationGroups(systems.parameters), inSteps = groups.filter(group => group.results.some(result => stepChips.has(result.id)));
  // Values filled at execution are entered where a step shows them (the chip or its calculation); only the rest stay here.
  const shownInSteps = new Set([...stepChips, ...inSteps.flatMap(group => Object.values(group.source.inputs))]);
  return { inSteps, calculations: groups.filter(group => !inSteps.includes(group)), values: systems.parameters.filter(p => filledAtRun(p) && !shownInSteps.has(p.id)) };
}

/** A group's systems, chosen only among the Protocol's own options, and the values no step asks for. */
function SystemsForm({ experimentId, version, view, editable }: { experimentId: string; version: Version; view: StructuredRunView; editable: boolean }) {
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
  const { inSteps, calculations, values } = preparationInputs(version, view);
  const choice = systems.dimensions.length > 0;
  // Chips are often nameless: name them by material, tool field or what they measure.
  const nameOf = (parameter: typeof systems.parameters[number]) => parameterLongName(parameter, systems);
  return <form action={action} className="ln-prep-systems" data-run-system-selection>
    <input type="hidden" name="experimentId" value={experimentId}/><input type="hidden" name="versionId" value={version.id}/><input type="hidden" name="executionPlanRevision" value={view.plan.revision}/><input type="hidden" name="selections" value={JSON.stringify(selections)}/><input type="hidden" name="actualInputs" value={JSON.stringify(actualInputs)}/>
    <input type="hidden" name="continuationKey" value={continuationKey}/>
    <fieldset disabled={!editable || pending} className="ln-prep-systems">
      {systems.presets.length ? <div className="flex flex-wrap gap-2">{systems.presets.map(p => <Button className="min-h-11 whitespace-normal md:min-h-0" type="button" key={p.id} size="sm" onClick={() => setSelections({ ...p.selections })}>{p.label}</Button>)}</div> : null}
      {choice ? <div className="protocol-system-fields">{systems.dimensions.map(d => <label key={d.id}>{systemLabelText(d.label)}<select className={formInputClass} value={selections[d.id] ?? ''} onChange={event => { const next = { ...selections }; if (event.target.value) next[d.id] = event.target.value; else delete next[d.id]; setSelections(next); }}><option value="">Not chosen</option>{d.options.map(o => <option key={o.id} value={o.id}>{systemLabelText(o.label)}</option>)}</select></label>)}</div> : null}
      {choice ? <p className="text-xs text-muted">Only the Protocol’s own systems can be chosen. One it lacks is added to the Protocol as a new version.</p> : null}
      {values.map(p => <label key={p.id}>{nameOf(p)} · {p.unit}<input aria-label={nameOf(p)} className={formInputClass} type="number" step="any" value={actualInputs[p.id]?.value ?? ''} onChange={e => { const next = { ...actualInputs }; if (e.target.value === '') delete next[p.id]; else next[p.id] = { value: Number(e.target.value), unit: p.unit }; setActualInputs(next); }}/></label>)}
      {choice ? <div className="protocol-system-legend">{Object.entries(selections).map(([dimensionId, optionId]) => <ProtocolSystemChoice key={dimensionId} systems={systems} dimensionId={dimensionId} optionId={optionId}/>)}</div> : null}
      {inSteps.length ? <p className="text-sm text-muted">{`${inSteps.length === 1 ? '1 calculation is' : `${inSteps.length} calculations are`} confirmed in the steps that use them: click a calculation result in a step to fill it in and confirm.`}</p> : null}
      {calculations.map(group => <ProtocolCalculationPreview key={group.results[0].id} group={group} resolution={resolution} receipts={adopted?.calculations ?? {}} disabled={!editable || pending}/>)}
      {dirty && adopted ? <p className="text-warning" role="status">Selection changed: above is a preview of the change, not yet applied. It is refused if it would overwrite existing run records.</p> : null}
      {dirty && adopted ? <ul aria-label="Effect of the change">{changes.map(s => <li key={s.source_ref}>{s.title} · {s.applicability === 'not-applicable' ? 'Becomes not applicable' : s.blocked ? 'Parameters still to be determined' : 'Takes new parameters or applicability'}</li>)}</ul> : null}
      {resolution.issues.filter(i => !i.code.startsWith('parameter-unknown')).length ? <ul className="text-error">{resolution.issues.filter(i => !i.code.startsWith('parameter-unknown')).map((i, index) => <li key={index}>{i.message}</li>)}</ul> : null}
      {choice && view.plan.groups.length > 1 ? <fieldset className="space-y-2"><legend>Also apply to other groups (ticked groups only)</legend>{view.versions.filter(other => other.sourceVersionId === version.sourceVersionId && other.id !== version.id).map(other => <label key={other.id} className="mr-4 inline-flex min-h-11 items-center gap-2"><input type="checkbox" name="applyToVersionIds" value={other.id}/>{other.groupLabel}</label>)}</fieldset> : null}
      {editable ? <Button className="min-h-11 whitespace-normal md:min-h-0" type="submit" variant="primary" disabled={pending || Boolean(adopted && !dirty && view.plan.groups.length < 2)}>{pending ? 'Saving…' : !choice ? 'Save values' : adopted ? 'Confirm and save changes' : 'Confirm systems for this run'}</Button> : null}
      {state.error?.includes('继续实例') || state.error?.includes('旧计时器') ? <div className="grid gap-2"><p>First check what has already been done to the samples. The new run lists only the operations still needed from the chosen point on, and the original completion records stay in the history; choosing an affected step that was already completed means doing it again, so confirm with care.</p><label>Continue from step<select name="continuationStartRef" className={formInputClass} defaultValue=""><option value="">Choose where to continue</option>{proposed.steps.filter(s => s.applicability !== 'not-applicable').map(s => <option key={`${version.id}:${s.source_ref}`} value={`${version.id}:${s.source_ref}`}>{s.title}</option>)}</select></label><label><input type="checkbox" name="cancelAffectedTimers" value="yes"/>Cancel running timers on the affected steps and keep a record of the cancellation (if any)</label><Button className="min-h-11 whitespace-normal md:min-h-0" type="submit" name="intent" value="continue" disabled={pending}>Keep the original record and create a continuation</Button></div> : null}
      {state.continuationUrl ? <Link className="text-moss underline" href={state.continuationUrl}>Open the continuation run</Link> : null}
    </fieldset>
    {state.error ? <p role="alert" className="text-error">{state.error}</p> : null}{state.message ? <p role="status">{state.message}</p> : null}
  </form>;
}

/** 本次数量 typed straight into the table: saved when the field is left, cleared when emptied. 样本数 can take the experiment's chosen samples (S15). */
function QuantityInput({ experimentId, version, label, name, view, editable, suggested }: { experimentId: string; version: Version; label: string; name: string; view: StructuredRunView; editable: boolean; suggested?: number }) {
  const router = useRouter();
  const saved = view.plan.quantities[version.id]?.[label];
  const [text, setText] = useState(saved === undefined ? '' : String(saved));
  const [seen, setSeen] = useState(saved);
  if (seen !== saved) { setSeen(saved); setText(saved === undefined ? '' : String(saved)); }
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const save = (value = text) => {
    const next = value.trim() ? Number(value.trim()) : null;
    if ((next ?? undefined) === saved) { setError(''); return; }
    if (next !== null && !(next > 0 && Number.isFinite(next))) { setError('Enter a number above 0'); return; }
    startTransition(async () => {
      const { setRunQuantities } = await import('@/app/experiments/[id]/run/actions');
      const result = await setRunQuantities({ experimentId, versionId: version.id, expectedRevision: view.plan.revision, quantities: { [label]: next } });
      setError(result.error ? readableError(result.error) : '');
      if (!result.error) router.refresh();
    });
  };
  return <span className="ln-prep-quantity">
    <input inputMode="numeric" aria-label={`${runQuantityLabelText(label, true)} · ${name}`} value={text} placeholder="—" disabled={!editable || pending} aria-invalid={Boolean(error) || undefined} data-missing={saved === undefined || undefined}
      onChange={event => setText(event.target.value)} onBlur={() => save()} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} />
    {suggested !== undefined && suggested !== saved && editable ? <button type="button" className="focus-ring ln-prep-link" disabled={pending} onClick={() => { setText(String(suggested)); save(String(suggested)); }}>{`Use the ${suggested} samples chosen`}</button> : null}
    {error ? <small role="alert">{error}</small> : null}
  </span>;
}

/** One row per group (or the Protocol, run as one group): its 本次数量 and its Protocol systems. Nothing to set, no table. */
function RunGroupTable({ experimentId, view, editable, inputGroups }: { experimentId: string; view: StructuredRunView; editable: boolean; inputGroups: Array<string | null> }) {
  const rows = view.versions.map(version => ({ version, labels: runQuantityLabels(version.document), inputs: preparationInputs(version, view), choice: version.document.systems!.dimensions.length > 0 }));
  // The first group whose systems are still to choose starts open.
  const [openRow, setOpenRow] = useState<string | null>(() => rows.find(row => row.choice && !view.plan.versions[row.version.id])?.version.id ?? null);
  const labels = [...new Set(rows.flatMap(row => row.labels))];
  const settable = rows.some(row => row.choice || row.inputs.values.length || row.inputs.calculations.length);
  if (!labels.length && !settable) return null;
  const several = new Set(view.versions.map(version => version.sourceVersionId)).size > 1;
  const nameOf = (version: Version) => version.groupLabel ? several ? `${version.groupLabel} · ${version.code ?? version.title}` : version.groupLabel : version.code ?? version.title;
  return <table className="ln-prep-groups">
    <thead><tr><th scope="col">{view.plan.groups.length ? 'Group' : 'Protocol'}</th>{labels.map(label => <th key={label} scope="col">{runQuantityLabelText(label, true)}</th>)}{settable ? <th scope="col">Protocol systems</th> : null}</tr></thead>
    <tbody>{rows.map(({ version, labels: own, inputs, choice }) => {
      const adopted = view.plan.versions[version.id], systems = version.document.systems!;
      const chosen = choice && adopted ? systems.dimensions.map(d => { const option = d.options.find(o => o.id === adopted.selections[d.id]); return option ? systemLabelText(option.label) : 'not chosen'; }).join(' · ') : '';
      const extra = inputs.values.length + inputs.calculations.length > 0;
      const open = openRow === version.id;
      return <Fragment key={version.id}>
        <tr>
          <th scope="row">{nameOf(version)}</th>
          {labels.map(label => <td key={label}>{own.includes(label) ? <QuantityInput experimentId={experimentId} version={version} label={label} name={nameOf(version)} view={view} editable={editable} suggested={label === '样本数' ? runSampleCount(inputGroups, version.groupLabel) : undefined} /> : '—'}</td>)}
          {settable ? <td>{choice || extra ? <button type="button" className="focus-ring ln-prep-systems-toggle" aria-expanded={open} data-missing={(choice && !adopted) || undefined} onClick={() => setOpenRow(open ? null : version.id)}>{choice ? chosen || 'Choose systems' : 'Fill in values'}</button> : '—'}</td> : null}
        </tr>
        {open ? <tr className="ln-prep-groups-form"><td colSpan={labels.length + 2}><SystemsForm key={`${version.id}:${view.plan.revision}`} experimentId={experimentId} version={version} view={view} editable={editable} /></td></tr> : null}
      </Fragment>;
    })}</tbody>
  </table>;
}

export function RunSystemPreparation({ experimentId, view, editable, started, plates = [], stock = [], recorded = [], samples, inputGroups = [], sampleGroupLabels = [] }: {
  experimentId: string; view: StructuredRunView; editable: boolean; started: boolean; plates?: PlateAttachment[]; stock?: PreparationStock[]; recorded?: Array<{ source: string }>;
  /** The boxes the experiment's samples come out of; their group names; the experiment's design groups (S13, S15). */
  samples?: PreparationSamples; inputGroups?: Array<string | null>; sampleGroupLabels?: string[];
}) {
  const list = useMemo(() => preparationChecklist(view, { plates: plates.map(plate => ({ id: plate.id, name: plate.originalFilename })), stock, recorded, samples }), [view, plates, stock, recorded, samples]);
  if (!view.hasSystems) return null;
  const continuation = view.plan.continuation;
  // Samples, their plate layouts and outputs live in 实验设置与样本; the bench only links there.
  return <RunPreparationChecklist experimentId={experimentId} view={view} list={list} editable={editable} plates={plates} startOpen={list.needsInput && !started}
    footer={editable ? <><RunGroupPreparation experimentId={experimentId} plan={view.plan} editable={editable && !started} suggestedLabels={sampleGroupLabels} /><span className="flex flex-wrap gap-x-4 gap-y-1"><Link className="focus-ring ln-prep-link" href={`/experiments/${experimentId}#section-setup`}>Samples and plate layouts</Link><Link className="focus-ring ln-prep-link" href={`/samples/new?experiment=${experimentId}`}>Register outputs</Link></span></> : null}>
    {continuation ? <div className="ln-prep-continuation"><Link className="text-moss underline" href={`/experiments/${continuation.experimentId}/run`}>View the earlier run and its original records</Link><p>{`Continuing from: ${Object.values(view.steps).find(s => `${s.versionId}:${s.source_ref}` === continuation.startSourceRef)?.title ?? ''}. Operations completed earlier are not copied as completed in this run.`}</p><details><summary>Earlier handling and adopted parameters (read-only history)</summary>{continuation.history.map(s => <div key={s.sourceRef} className="my-3"><strong>{s.title} · {s.completed ? 'Completed earlier' : 'Not completed in the original record'}</strong><p className="whitespace-pre-wrap">{s.description}</p>{Object.entries(s.actualValues).map(([id, v]) => <p key={id}>{`Original actual value: ${v.value} ${v.unit} · ${v.recordedAt}`}</p>)}{s.deviationNote ? <p>{`Original note: ${s.deviationNote}`}</p> : null}</div>)}</details></div> : null}
    <RunGroupTable experimentId={experimentId} view={view} editable={editable} inputGroups={inputGroups} />
  </RunPreparationChecklist>;
}
