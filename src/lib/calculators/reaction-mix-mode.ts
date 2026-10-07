import type {MixRow} from './planning';

type Group={name:string;reactions:string;rows:MixRow[]};
type SingleDraft={samples:unknown;replicates:unknown;controls:unknown;rows:unknown};
type ModeDrafts={single?:SingleDraft;multiple?:Group[]};

/** UI drafts never enter the group list used by the calculation engine. */
export function switchReactionMixMode(inputs:Record<string,unknown>,mode:'single'|'multiple',sourceGroup?:number):Record<string,unknown>{
 const multiple=Array.isArray(inputs.groups);
 if(multiple===(mode==='multiple'))return inputs;
 const next=structuredClone(inputs),drafts=structuredClone((inputs.__mixModeDrafts??{}) as ModeDrafts);
 if(mode==='multiple'){
  drafts.single={samples:inputs.samples,replicates:inputs.replicates,controls:inputs.controls,rows:structuredClone(inputs.rows??[])};
  const count=Number(inputs.samples)*Number(inputs.replicates)+Number(inputs.controls);
  next.groups=drafts.multiple??[{name:'Group 1',reactions:Number.isInteger(count)&&count>0?String(count):'',rows:structuredClone(inputs.rows??[])}];
  next.__mixSingleSource??='Group 1';
 }else{
  const groups=inputs.groups as Group[];
  drafts.multiple=structuredClone(groups);
  if(!drafts.single){
   const group=sourceGroup===undefined?undefined:groups[sourceGroup];
   if(!group)throw new Error('Choose the group to use for the single draft.');
   drafts.single={samples:group.reactions,replicates:'1',controls:'0',rows:structuredClone(group.rows)};
   next.__mixSingleSource=group.name||`Group ${sourceGroup!+1}`;
  }
  delete next.groups;
  Object.assign(next,drafts.single);
 }
 next.__mixModeDrafts=drafts;
 return next;
}
