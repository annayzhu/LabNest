/** Reorder complete saved IDs within a group; execution/evidence identity never changes. */
export function experimentStepOrder(steps: readonly {id:string;groupKey:string}[], ids:string[]) {
  if(ids.length!==steps.length || new Set(ids).size!==ids.length || ids.some(id=>!steps.some(step=>step.id===id)))throw new Error('Submit every saved step ID exactly once.');
  const groups=steps.map(step=>step.groupKey);
  if(ids.some((id,index)=>steps.find(step=>step.id===id)!.groupKey!==groups[index]))throw new Error('Steps must stay within their captured Protocol group.');
  const orderByGroup=new Map<string,number>();
  return ids.map(id=>{const step=steps.find(step=>step.id===id)!;const order=(orderByGroup.get(step.groupKey)??0)+1;orderByGroup.set(step.groupKey,order);return {id,order};});
}
