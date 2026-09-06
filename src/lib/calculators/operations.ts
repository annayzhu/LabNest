import type {CalculatorResult} from './calculator-engine';
import {tableColumnLabel} from './presentation';
import {convert,parseScalar} from './quantities';
export type LiquidOperation={id:string;component:string;sample?:string;role:'add'|'transfer'|'dispense';quantity:{value:number;unit:string;dimension:'volume'};basis:'theoretical'|'actual'};
/** Explicit task/schema adapter. Summary volumes are deliberately absent; display labels/units never decide roles. */
export function withLiquidOperations(result:CalculatorResult, inputs:Record<string,unknown>):CalculatorResult {
 const operations:LiquidOperation[]=[];
 function add(id:string,component:string,value:unknown,unit:string,role:LiquidOperation['role']='add',sample?:string){
  if(value==='')return;
  if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new Error('Invalid liquid operation: '+component);
  operations.push({id,component,sample,role,quantity:{value,unit,dimension:'volume'},basis:'theoretical'});
 }
 const outputKeys:Record<string,string[]>={seeding:['stockVolumeMl','mediumVolumeMl'],hydrogel:['hydrogelUl','cellStockUl','mediumUl'],freezing:['dmsoMl','serumMl','baseMediumMl'],transfection:['reagentUl','dnaVolumeUl','diluentUl'],dilution:['stockVolume','diluentVolume'],'reagent-dosing':['stockVolume','diluentVolume'],'fold-dilution':['stockVolume','diluentVolume'],moi:['virusVolumeUl']};
 if(!(result.calculatorId==='transfection'&&result.table))for(const key of outputKeys[result.calculatorId]??[]){const output=result.outputs.find(o=>o.key===key);if(output?.unit)add(key,output.labelZh+' / '+output.label,output.value,output.unit);}
 const schemas:Record<string,string[]>={'serial-dilution':['takeUl','diluentUl'],'master-mix':['perReactionUl','batchUl'],normalization:['sampleUl','diluentUl'],'wb-loading':['sampleUl','bufferUl','reducingAgentUl','diluentUl'],'kill-curve':['stockToAddUl'],transfection:['volumeUl']};
 for(const [index,row] of (result.table??[]).entries()){
  for(const key of schemas[result.calculatorId]??[])if(key in row){
   const label=key==='reducingAgentUl'?String(row.reducingAgent):tableColumnLabel(key,true)+' / '+tableColumnLabel(key,false);
   add(`row:${index}:${key}`,String(row.component??label),row[key],'µL',key==='takeUl'?'transfer':key==='perReactionUl'?'dispense':'add',String(row.id??row.tube??row.group??index+1));
  }
  if(['media-recipe','buffer-recipe'].includes(result.calculatorId)&&!String(row.component).startsWith('溶解后定容至')){
   if(['L','mL','µL','μL','uL','nL'].includes(String(row.unit)))add(`recipe:${index}`,String(row.component),row.amount,String(row.unit));
  }
 }
 const quantityInput=(key:string,defaultUnit:string)=>convert(parseScalar(inputs[key]),String(inputs[key+'Unit']??defaultUnit),'µL');
 if(['seeding','hydrogel'].includes(result.calculatorId))add('per-well','每孔分装 / Per well',quantityInput('volumePerWellUl','µL'),'µL','dispense');
 if(result.calculatorId==='freezing'&&Number(result.outputMap.vials)>0)add('per-vial','每管分装 / Per vial',quantityInput('volumePerVialMl','mL'),'µL','dispense');
 if(result.calculatorId==='transfection')add('per-well','每孔复合物 / Complex per well',quantityInput('complexVolumeUlPerWell','µL'),'µL','dispense');
 if(result.calculatorId==='master-mix'&&typeof result.outputMap.dispenseUl==='number')add('premix-dispense','每反应预混液 / Premix per reaction',result.outputMap.dispenseUl,'µL','dispense');
 return {...result,operations};
}
