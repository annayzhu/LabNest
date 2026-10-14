import { experimentPlanName } from '@/lib/experiment-provenance';
export function ExperimentBrief({id,plan,snapshot,date}:{id:string|null;plan:string|null;snapshot:unknown;date?:string}) {
  const planName=experimentPlanName(snapshot,plan);
  return <>
    <div className="ln-experiment-brief text-sm" aria-label="实验简报">
      <span title={id || '未分配'}>实验 ID：{id || '未分配'}</span>
      <details><summary title={planName}>研究计划：{planName}</summary><p>{planName}</p></details>
      <span>实验日期：{date ?? '未记录'}</span>
    </div>
    <section className="ln-brief-source text-sm" aria-label="完整执行来源">
      <h2 className="font-semibold">执行来源</h2><p>研究计划：{planName}</p>
      <p>实验日期：{date ?? '未记录'}</p>
    </section>
  </>;
}
