import { experimentMethodNames, experimentPlanName } from '@/lib/experiment-provenance';
export function ExperimentBrief({id,plan,snapshot}:{id:string|null;plan:string|null;snapshot:unknown}) {
  const methods=experimentMethodNames(snapshot);
  const planName=experimentPlanName(snapshot,plan);
  return <>
    <div className="ln-experiment-brief text-sm" aria-label="实验简报">
      <span title={id || '未分配'}>实验 ID：{id || '未分配'}</span>
      <details><summary title={planName}>研究计划：{planName}</summary><p>{planName}</p></details>
      <details><summary title={methods.join('；')}>方法来源：{methods[0]}{methods.length>1 ? ` +${methods.length-1}` : ''}</summary><ul>{methods.map((name,i)=><li key={i}>{name}</li>)}</ul></details>
    </div>
    <section className="ln-brief-source text-sm" aria-label="完整执行来源">
      <h2 className="font-semibold">执行来源</h2><p>研究计划：{planName}</p>
      <p>方法来源：</p><ul>{methods.map((name,i)=><li key={i}>{name}</li>)}</ul>
    </section>
  </>;
}
