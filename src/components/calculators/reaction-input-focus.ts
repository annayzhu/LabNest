import {convert,parseScalar} from '@/lib/calculators/quantities';
import type {MixRow} from '@/lib/calculators/planning';

/** Locate malformed input only; calculation feasibility remains owned by the engine. */
function scalarInvalid(value:unknown,positive=false,integer=false){
 try{const n=parseScalar(value);return positive?n<=0||(integer&&!Number.isInteger(n)):n<0;}catch{return true;}
}
export function mixRowIssue(rows:MixRow[]):{row:number;field:string}|undefined {
 for(const [row,value] of rows.entries()){
  if(!value.name?.trim())return {row,field:'name'};
  if(value.inputMode==='concentration'){
   if(scalarInvalid(value.stock,true))return {row,field:'stock'};
   if(scalarInvalid(value.target))return {row,field:'target'};
   try{if(parseScalar(value.target)>convert(parseScalar(value.stock),value.stockUnit??'mM',value.targetUnit??'µM'))return {row,field:'target'};}catch{return {row,field:'stock'};}
  }else if(scalarInvalid(value.volume))return {row,field:'volume'};
 }
}
export function mixGroupIssue(groups:{name:string;reactions:string;rows:MixRow[]}[]){
 const names=new Set<string>();
 for(const [group,value] of groups.entries()){
  const name=value.name.trim();if(!name||names.has(name))return {group,selector:'[data-group-name]'};names.add(name);
  if(scalarInvalid(value.reactions,true,true))return {group,selector:'[data-group-reactions]'};
  const row=mixRowIssue(value.rows);if(row)return {group,selector:`[data-mix-row="${row.row}"] [data-mix-field="${row.field}"]`};
 }
}
