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
  if (plan.groups.length) return <p className="text-sm" aria-label="已配置实验组">实验组：{plan.groups.map(group => group.label).join('、')}。共同准备只计一次，各组分别确认体系。</p>;
  return <div className="border-b border-hairline pb-3">
    <p className="text-sm">当前按单组执行。需要不同处理组时，请在开始操作前建立分组。</p>
    {editable && !editing ? <Button className="min-h-11 whitespace-normal md:min-h-0" type="button" onClick={() => { setGroups([{ id: newClientMutationId(), label: 'A组' }, { id: newClientMutationId(), label: 'B组' }]); setEditing(true); }}>设置多个实验组</Button> : null}
    {editing && editable ? <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="experimentId" value={experimentId}/><input type="hidden" name="executionPlanRevision" value={plan.revision}/><input type="hidden" name="groups" value={JSON.stringify(groups)}/>
      <fieldset disabled={pending} className="space-y-2"><legend className="text-sm font-medium">本次实验分组</legend>
        {groups.map((group, index) => <div key={group.id} className="flex items-end gap-2"><label className="min-w-0 flex-1 text-sm">第 {index + 1} 组<input required className={formInputClass} value={group.label} maxLength={100} onChange={event => setGroups(groups.map(item => item.id === group.id ? { ...item, label: event.target.value } : item))}/></label><Button className="min-h-11 whitespace-normal md:min-h-0" type="button" disabled={groups.length <= 1} onClick={() => setGroups(groups.filter(item => item.id !== group.id))}>移除</Button></div>)}
        <div className="flex flex-wrap gap-2"><Button className="min-h-11 whitespace-normal md:min-h-0" type="button" disabled={groups.length >= 24} onClick={() => setGroups([...groups, { id: newClientMutationId(), label: `第${groups.length + 1}组` }])}>添加组</Button><Button className="min-h-11 whitespace-normal md:min-h-0" type="submit" variant="primary">确认分组</Button><Button className="min-h-11 whitespace-normal md:min-h-0" type="button" onClick={() => setEditing(false)}>取消</Button></div>
      </fieldset><p className="text-xs text-muted">确认后固定分组与步骤身份。各组不会自动继承已经确认的单组体系，需重新核对。</p>
      {state.error ? <p role="alert" className="text-error">{state.error}</p> : null}
    </form> : null}
  </div>;
}
