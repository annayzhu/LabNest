import { experimentPlanName } from '@/lib/experiment-provenance';
/** The record's header line: ID, Research Plan and the date of the Experiment. Methods are listed in 执行记录, one part per Protocol. */
export function ExperimentBrief({id,plan,snapshot,date}:{id:string|null;plan:string|null;snapshot:unknown;date:Date}) {
  const planName=experimentPlanName(snapshot,plan);
  const day=date.toISOString().slice(0,10);
  return <div className="ln-experiment-brief text-sm" aria-label="实验简报">
    <span title={id || '未分配'}>实验 ID：{id || '未分配'}</span>
    <details><summary title={planName}>研究计划：{planName}</summary><p>{planName}</p></details>
    <span>实验日期：<time dateTime={day}>{day}</time></span>
  </div>;
}
