'use client';
import { useActionState, useState } from 'react';
import { saveRunGroups } from '@/app/experiments/[id]/run/actions';
import { newClientMutationId } from '@/lib/client-mutation-id';
import type { ExecutionPlan } from '@/lib/structured-run';
import { Button } from './ui/Button';
import { formInputClass } from './forms';

/**
 * Splitting a single-group run into treatment groups, before anything is recorded. Groups already set up show in the group table.
 * The experiment's sample groups give the names when it has two or more (S13), so one experiment has one set of group names.
 */
export function RunGroupPreparation({ experimentId, plan, editable, suggestedLabels = [] }: { experimentId: string; plan: ExecutionPlan; editable: boolean; suggestedLabels?: string[] }) {
  const [editing, setEditing] = useState(false);
  const [groups, setGroups] = useState<Array<{ id: string; label: string }>>([]);
  const [state, action, pending] = useActionState(saveRunGroups, {});
  if (plan.groups.length || !editable) return null;
  const initial = suggestedLabels.length > 1 ? suggestedLabels.slice(0, 24) : ['A组', 'B组'];
  if (!editing) return <button type="button" className="focus-ring ln-prep-link" onClick={() => { setGroups(initial.map(label => ({ id: newClientMutationId(), label }))); setEditing(true); }}>Set up several groups</button>;
  return <form action={action} className="ln-prep-group-setup space-y-3">
    <input type="hidden" name="experimentId" value={experimentId}/><input type="hidden" name="executionPlanRevision" value={plan.revision}/><input type="hidden" name="groups" value={JSON.stringify(groups)}/>
    <fieldset disabled={pending} className="space-y-2"><legend className="text-sm font-medium">Groups in this run</legend>
      {groups.map((group, index) => <div key={group.id} className="flex items-end gap-2"><label className="min-w-0 flex-1 text-sm">{`Group ${index + 1}`}<input required className={formInputClass} value={group.label} maxLength={100} onChange={event => setGroups(groups.map(item => item.id === group.id ? { ...item, label: event.target.value } : item))}/></label><Button className="min-h-11 whitespace-normal md:min-h-0" type="button" disabled={groups.length <= 1} onClick={() => setGroups(groups.filter(item => item.id !== group.id))}>Remove</Button></div>)}
      <div className="flex flex-wrap gap-2"><Button className="min-h-11 whitespace-normal md:min-h-0" type="button" disabled={groups.length >= 24} onClick={() => setGroups([...groups, { id: newClientMutationId(), label: `第${groups.length + 1}组` }])}>Add group</Button><Button className="min-h-11 whitespace-normal md:min-h-0" type="submit" variant="primary">Confirm groups</Button><Button className="min-h-11 whitespace-normal md:min-h-0" type="button" onClick={() => setEditing(false)}>Cancel</Button></div>
    </fieldset><p className="text-xs text-muted">Confirming fixes the groups and step identities. Groups don’t inherit systems already confirmed for the single group; check them again.</p>
    {state.error ? <p role="alert" className="text-error">{state.error}</p> : null}
  </form>;
}
