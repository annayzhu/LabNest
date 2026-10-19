'use client';
import { useActionState, useState } from 'react';
import { saveRunGroups } from '@/app/experiments/[id]/run/actions';
import { newClientMutationId } from '@/lib/client-mutation-id';
import type { ExecutionPlan } from '@/lib/structured-run';
import { Button } from './ui/Button';
import { formInputClass } from './forms';

export function RunGroupPreparation({ experimentId, plan, editable }: { experimentId: string; plan: ExecutionPlan; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [groups, setGroups] = useState<Array<{ id: string; label: string }>>([]);
  const [state, action, pending] = useActionState(saveRunGroups, {});
  if (plan.groups.length) return <p className="text-sm" aria-label="Experiment groups set up">{`Groups: ${plan.groups.map(group => group.label).join('、')}. Shared preparation counts once; each group confirms its own systems.`}</p>;
  return <div className="border-b border-hairline pb-3">
    <p className="text-sm">Running as a single group. If you need different treatment groups, set them up before you start.</p>
    {editable && !editing ? <Button className="min-h-11 whitespace-normal md:min-h-0" type="button" onClick={() => { setGroups([{ id: newClientMutationId(), label: 'A组' }, { id: newClientMutationId(), label: 'B组' }]); setEditing(true); }}>Set up several groups</Button> : null}
    {editing && editable ? <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="experimentId" value={experimentId}/><input type="hidden" name="executionPlanRevision" value={plan.revision}/><input type="hidden" name="groups" value={JSON.stringify(groups)}/>
      <fieldset disabled={pending} className="space-y-2"><legend className="text-sm font-medium">Groups in this run</legend>
        {groups.map((group, index) => <div key={group.id} className="flex items-end gap-2"><label className="min-w-0 flex-1 text-sm">{`Group ${index + 1}`}<input required className={formInputClass} value={group.label} maxLength={100} onChange={event => setGroups(groups.map(item => item.id === group.id ? { ...item, label: event.target.value } : item))}/></label><Button className="min-h-11 whitespace-normal md:min-h-0" type="button" disabled={groups.length <= 1} onClick={() => setGroups(groups.filter(item => item.id !== group.id))}>Remove</Button></div>)}
        <div className="flex flex-wrap gap-2"><Button className="min-h-11 whitespace-normal md:min-h-0" type="button" disabled={groups.length >= 24} onClick={() => setGroups([...groups, { id: newClientMutationId(), label: `第${groups.length + 1}组` }])}>Add group</Button><Button className="min-h-11 whitespace-normal md:min-h-0" type="submit" variant="primary">Confirm groups</Button><Button className="min-h-11 whitespace-normal md:min-h-0" type="button" onClick={() => setEditing(false)}>Cancel</Button></div>
      </fieldset><p className="text-xs text-muted">Confirming fixes the groups and step identities. Groups don’t inherit systems already confirmed for the single group; check them again.</p>
      {state.error ? <p role="alert" className="text-error">{state.error}</p> : null}
    </form> : null}
  </div>;
}
