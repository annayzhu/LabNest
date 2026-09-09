import { experimentMethodNames, experimentPlanName } from '@/lib/experiment-provenance';
export function ExperimentBrief({id,plan,snapshot}:{id:string|null;plan:string|null;snapshot:unknown}) {
  const methods=experimentMethodNames(snapshot);
  plan=experimentPlanName(snapshot,plan);
  return <div className="ln-experiment-brief text-sm" aria-label="实验简报">
    <span>实验 ID：{id || '未分配'}</span>
    <div className="ln-brief-print">研究计划：{plan || '未记录'}</div><div className="ln-brief-print">方法来源：{methods.join('；')}</div>
    <details><summary title={plan || '未记录'}>研究计划：{plan || '未记录'}</summary><p>{plan || '未记录'}</p></details>
    <details><summary title={methods.join('；')}>方法来源：{methods[0]}{methods.length>1 ? ` +${methods.length-1}` : ''}</summary><ul>{methods.map((name,i)=><li key={i}>{name}</li>)}</ul></details>
  </div>;
}
