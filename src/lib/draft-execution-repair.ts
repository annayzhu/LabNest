import type {ProtocolStep} from './types';
type SavedStep={id:string;title:string;description:string;protocolStepRef:string|null;groupKey:string;groupOrder:number;groupTitle:string;order:number;completed:boolean;completedAt:Date|null;deviationNote:string|null;deviationType:string|null;deviationImpact:string|null;deviationAuthor:string|null;timerDurationSeconds:number|null;timerRemainingSeconds:number|null;timerStartedAt:Date|null;timerPausedAt:Date|null};
/** Explicit audited mapping only; no text matching, progress inference or ordinal migration. */
export function draftExecutionRepair(steps:SavedStep[],desired:ProtocolStep[],mapping:Record<string,string>,keepers:Record<string,string>,versionId:string){
 if(steps.some(step=>step.completed||step.completedAt||step.timerStartedAt||step.timerPausedAt))throw new Error('Started execution evidence cannot be rebuilt.');
 if(steps.length!==Object.keys(mapping).length||steps.some(step=>!mapping[step.id]))throw new Error('Every old step needs an explicit mapping.');
 const refs=desired.map(step=>step.source_ref!);
 if(refs.some(ref=>!ref)||steps.some(step=>mapping[step.id]!=='info'&&!refs.includes(mapping[step.id])))throw new Error('Unverified source mapping.');
 const used=new Set<string>();
 const updates=desired.map(target=>{
  const members=steps.filter(step=>mapping[step.id]===target.source_ref);
  const retained=members.find(step=>step.id===keepers[target.source_ref!]);
  if(!retained||used.has(retained.id))throw new Error('Each operation needs a distinct, explicitly retained saved step ID.');used.add(retained.id);
  const merge=(key:'deviationNote'|'deviationImpact'|'deviationAuthor')=>{const values=members.filter(step=>step[key]?.trim());return values.length<=1?values[0]?.[key]??null:values.map(step=>`[${step.id}] ${step[key]}`).join('\n');};
  const timers=members.filter(step=>step.timerDurationSeconds!==null);if(timers.length>1&&timers.some(step=>step.timerDurationSeconds!==timers[0].timerDurationSeconds))throw new Error('Conflicting planned timers require manual review.');
  const deviationTypes=new Set(members.filter(step=>step.deviationNote?.trim()).map(step=>step.deviationType));
  if(deviationTypes.size>1)throw new Error('Conflicting deviation categories require manual review.');
  return {id:retained.id,data:{title:target.title,description:target.description,protocolStepRef:`${versionId}:${target.source_ref}`,order:target.order,deviationNote:merge('deviationNote'),deviationImpact:merge('deviationImpact'),deviationAuthor:merge('deviationAuthor'),deviationType:members.find(step=>step.deviationNote)?.deviationType??null,timerDurationSeconds:timers[0]?.timerDurationSeconds??null,timerRemainingSeconds:timers[0]?.timerRemainingSeconds??null}};
 });
 const removed=steps.filter(step=>!used.has(step.id)).map(step=>({id:step.id,targetId:mapping[step.id]==='info'?null:keepers[mapping[step.id]],informationNote: mapping[step.id]==='info'?[step.deviationNote,step.deviationImpact,step.deviationAuthor].filter(Boolean).join('\n'):null}));
 return {updates,removed};
}
