import { calculate, getCalculatorDefinition, type CalculatorResult } from './calculator-engine';
import {compatibleUnits,convert,parseScalar} from './quantities';
import {isFieldVisible} from './task-definitions';
import { reactionMixGroups, reactionMixSteps } from './reaction-mix-presentation';

export type PlateContext = {workspaceId:string;plateId:string;plateName:string;plateSize:number;wellIds:string[];requestId?:string};
export type PlateContribution = {
 groupKey:string;groupLabel:string;groupName:string;tubeRole:string;component:string;componentKey:string;
 plateId:string;plateName:string;scopeWellIds:string[];perWellVolume:number;baseVolume:number;preparedVolume:number;
 unit:'µL';applyOverage:boolean;source:string;protocolSteps:string[];planName:string;warnings:string[];savedPreparedVolume?:number;planOveragePercent?:number;
};

function checkScope(context:PlateContext) {
 const shape:Record<number,[number,number]>={6:[2,3],12:[3,4],24:[4,6],96:[8,12],384:[16,24]};
 const bounds=shape[context.plateSize];
 if(!bounds||!context.workspaceId||!context.plateId||!context.wellIds.length||new Set(context.wellIds).size!==context.wellIds.length||context.wellIds.some(id=>{
  const m=/^([A-P])(\d+)$/.exec(id);return !m||m[1].charCodeAt(0)-65>=bounds[0]||Number(m[2])<1||Number(m[2])>bounds[1];
 }))throw new Error('所选孔位无效或重复，请重新选择 / Invalid or duplicate selected wells');
}

/** Uses the engine's execution granularity; never infers reaction counts from a formatted label. */
export function plateReactionScopes(result:CalculatorResult,context:PlateContext) {
 checkScope(context);
 const groups=reactionMixGroups(result,true);
 if(!groups.length||groups.some(g=>!Number.isInteger(g.reactions)||Number(g.reactions)<1)||groups.reduce((sum,g)=>sum+Number(g.reactions),0)!==context.wellIds.length)
  throw new Error('反应总数必须等于所选孔数；请调整各组反应数 / Reaction count must match selected wells');
 let start=0;
 return groups.map(g=>{const wellIds=context.wellIds.slice(start,start+Number(g.reactions));start+=Number(g.reactions);return {...g,wellIds};});
}

export function canonicalPlateInputs(calculatorId:string, input:Record<string,unknown>) {
 const normalized={...input};
 for(const field of getCalculatorDefinition(calculatorId).fields) {
  if(!field.unit||!isFieldVisible(calculatorId,field.key,input)||!String(input[field.key]??'').trim())continue;
  const from=String(input[`${field.key}Unit`]??field.unit);
  if(compatibleUnits(field.unit).includes(from)){normalized[field.key]=convert(parseScalar(input[field.key]),from,field.unit);normalized[`${field.key}Unit`]=field.unit;}
 }
 return normalized;
}

/** Recalculates through the existing engine at the trust boundary. Old/partial snapshots cannot be published. */
export function buildPlateLiquidPlan(result:CalculatorResult,context:PlateContext) {
 checkScope(context);
 const definition=getCalculatorDefinition(result.calculatorId);
 if(!result.rawInputs||result.status==='partial'||result.methodVersion!==definition.methodVersion)
  throw new Error('请用当前计算方法重新计算后保存 / Recalculate with the current method before saving');
 const input=structuredClone(result.rawInputs);
 const verified=calculate({calculatorId:result.calculatorId,inputs:input});
 if(verified.status==='partial')throw new Error('无效结果不能保存为配液方案 / Invalid results cannot be saved');
 if(input.wells!==undefined&&(Number(input.wells)!==context.wellIds.length||Number(input.plates??1)!==1))
  throw new Error('孔数必须等于当前板所选孔数 / Well count must match this plate selection');
 const name=definition.nameZh, contributions:PlateContribution[]=[];
 const steps=result.calculatorId==='master-mix'?reactionMixSteps(verified,true):verified.instructions??[];
 const add=(data:Omit<PlateContribution,'plateId'|'plateName'|'unit'|'protocolSteps'|'planName'|'warnings'>)=>contributions.push({...data,plateId:context.plateId,plateName:context.plateName,unit:'µL',protocolSteps:steps,planName:name,warnings:verified.warnings,savedPreparedVolume:data.preparedVolume,planOveragePercent:data.applyOverage?Number(input.overagePercent??0):0});
 if(result.calculatorId==='master-mix') {
  const groups=plateReactionScopes(verified,context);
  const factor=1+Number(input.overagePercent??0)/100;
  for(const group of groups) {
   const additions=group.operations.filter(op=>op.role==='add');
   // Full scientific recipe signature, independent of generated row IDs, counts, reserve and display units.
   const rawRows=Array.isArray(input.groups)?(input.groups[Number(group.id)] as {rows?:Record<string,unknown>[]})?.rows:input.rows as Record<string,unknown>[]|undefined;
   const signature=JSON.stringify({name:group.name,rows:group.rows.map(row=>({name:row.component,volume:row.perReactionUl,premix:row.premix})),concentrations:rawRows?.map(row=>row.inputMode==='concentration'?{inputMode:'concentration',stock:row.stock,target:row.target,stockUnit:row.stockUnit,targetUnit:row.targetUnit}:{inputMode:'volume'})});
   for(const [index,op] of additions.entries()) {
    const premix=op.destination.startsWith('premix:');
    const prepared=op.quantity.value*(premix?1:op.repetitions);
    const base=premix?prepared/factor:prepared;
    add({groupKey:premix?`calculator-premix:${signature}`:`calculator-separate:${context.plateId}:${group.id}:${op.source}`,groupLabel:premix?`${group.name} · 预混液`:`${group.name} · ${op.component}（独立加样）`,groupName:group.name,tubeRole:premix?'premix':'separate',component:op.component,componentKey:`${index}:${op.source}:${op.component}`,scopeWellIds:group.wellIds,perWellVolume:base/Number(group.reactions),baseVolume:base,preparedVolume:prepared,applyOverage:premix,source:op.source});
   }
  }
 } else {
  const factor=result.calculatorId==='seeding'?1+Number(input.overagePercent??0)/100:1;
  const operations=(verified.operations??[]).filter(op=>op.role==='add');
  for(const [index,op] of operations.entries()) {
   const levels=[...new Set(operations.map(o=>o.sample).filter(Boolean))];
   const scope=result.calculatorId==='kill-curve'?context.wellIds.filter((_,i)=>levels[Math.min(levels.length-1,Math.floor(i*levels.length/context.wellIds.length))]===op.sample):context.wellIds;
   if(!scope.length)continue;
   const prepared=op.quantity.value*op.repetitions*(result.calculatorId==='kill-curve'?scope.length:1);
   const base=prepared/factor;
   // Unknown stock identities must stay separate across boards; explicit Master Mix recipes can pool.
   add({groupKey:`calculator:${context.plateId}:${result.calculatorId}:${op.sample??op.destination}`,groupLabel:`${name}${op.sample?` · ${op.sample}`:''}`,groupName:op.sample??name,tubeRole:'standard',component:op.component,componentKey:`${index}:${op.source}`,scopeWellIds:scope,perWellVolume:base/scope.length,baseVolume:base,preparedVolume:prepared,applyOverage:result.calculatorId==='seeding',source:op.source});
  }
 }
 if(!contributions.length)throw new Error('此结果没有可保存的液体操作 / No liquid operations to save');
 return {module:'calculator',calculatorId:result.calculatorId,name,recipeName:name,plateId:context.plateId,plateName:context.plateName,plateSize:context.plateSize,scopeWellIds:[...context.wellIds],input,resultSnapshot:verified,protocolSnapshot:{steps},contributions,stale:false,status:'saved',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
}
