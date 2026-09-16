import type {CalculatorResult} from './calculator-engine';
import {convert} from './quantities';
import {formatQuantity} from './quantity-format';

/** A view of the existing immutable plan, never a second reaction calculator. */
export function reactionMixGroups(result:CalculatorResult,zh:boolean) {
 const operations=result.operations??[];
 const ids=[...new Set(operations.map(o=>o.group).filter((id):id is string=>id!==undefined))];
 return ids.map(id=>{
  const ops=operations.filter(o=>o.group===id),originalName=ops[0].groupName??id;
  const name=originalName==='default'?(zh?'预混液':'Premix'):originalName;
  const rows=(result.table??[]).filter(row=>ids.length===1||String(row.group)===originalName);
  const total=rows.reduce((sum,row)=>sum+(typeof row.batchUl==='number'?row.batchUl:0),0);
  return {id,name,rows,operations:ops,total,dispense:ops.find(o=>o.role==='dispense')};
 });
}
export function reactionMixUnit(result:CalculatorResult){return result.displayUnits?.['table:perReactionUl']??'µL';}
export function reactionMixQuantity(value:number,result:CalculatorResult){const unit=reactionMixUnit(result);return `${formatQuantity(convert(value,'µL',unit))} ${unit}`;}
export function reactionComponent(value:unknown,zh:boolean){return value==='水 / Water'?(zh?'水':'Water'):String(value);}
export function reactionMixClipboard(result:CalculatorResult,zh:boolean,groupId?:string){
 const all=reactionMixGroups(result,zh),groups=groupId===undefined?all:all.filter(g=>g.id===groupId);
 if(!groups.length)return '';
 const lines=[`${zh?'独立配液组':'Separate mix groups'}: ${groups.length}`];
 if(groups.length===1)lines.push(`${zh?'各组预混总量（分别配制）':'Premix to prepare'}: ${reactionMixQuantity(groups[0].total,result)}`);
 for(const group of groups){
  lines.push('');
  lines.push(`${group.name}: ${group.dispense?`${zh?'预混液':'Premix'}: ${reactionMixQuantity(group.dispense.quantity.value,result)} × ${group.dispense.repetitions}`:(zh?'单独加入各组分':'Add components separately')}`);
  if(groups.length>1)lines.push(`${zh?'预混总量':'Premix to prepare'}: ${reactionMixQuantity(group.total,result)}`);
  for(const row of group.rows){
   const premix=row.premix==='是 / Yes';
   const batch=typeof row.batchUl==='number'?`; ${zh?'整批':'Batch'}: ${reactionMixQuantity(row.batchUl,result)}`:'';
   lines.push(`${reactionComponent(row.component,zh)}${zh?'每反应': ' per reaction'}: ${reactionMixQuantity(Number(row.perReactionUl),result)}; ${premix?(zh?'预混':'Premix'):(zh?'单独加入':'Add separately')}${batch};`);
  }
 }
 return lines.join('\n');
}
export function reactionMixSteps(result:CalculatorResult,zh:boolean,groupId?:string){
 const container=(result.rawInputs?.__context as {wellIds?:unknown}|undefined)?.wellIds? (zh?'孔加样':'wells'):(zh?'个反应':'reactions');
 const steps:string[]=[];
 for(const group of reactionMixGroups(result,zh).filter(g=>groupId===undefined||g.id===groupId)){
  steps.push(`${group.name}${zh?'配制':' preparation'}`);
  for(const op of group.operations.filter(o=>o.role==='add'&&o.destination.startsWith('premix:')))steps.push(`${reactionComponent(op.component,zh)}: ${reactionMixQuantity(op.quantity.value,result)} → ${group.name}`);
  if(group.dispense)steps.push(`${group.name}${zh?'预混液':' premix'}: ${reactionMixQuantity(group.dispense.quantity.value,result)} × ${group.dispense.repetitions} ${container}`);
  for(const op of group.operations.filter(o=>o.role==='add'&&!o.destination.startsWith('premix:')))steps.push(`${reactionComponent(op.component,zh)}: ${reactionMixQuantity(op.quantity.value,result)} × ${op.repetitions} ${container}${zh?'，单独加入':'，add separately'}`);
 }
 return steps;
}
