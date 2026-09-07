import type {CalculatorResult} from './calculator-engine';
import {tableColumnLabel} from './presentation';
import {convert,parseScalar,normalizeUnit,units} from './quantities';
export type LiquidOperation={id:string;component:string;componentId?:string;sample?:string;group?:string;groupName?:string;role:'add'|'transfer'|'dispense'|'make-up-to';source:string;destination:string;repetitions:number;inputRow?:string;planVersion:string;quantity:{value:number;unit:string;dimension:'volume'};basis:'theoretical'|'actual'};
export const operationVersion='liquid-operations-v2';
/** Identity and execution granularity are independent of label, display unit and numeric rounding. */
export function operation(id:string,component:string,value:number,unit:string,role:LiquidOperation['role']='add',details:Partial<LiquidOperation>={}):LiquidOperation{
 const quantity={value:convert(value,unit,'µL'),unit:'µL',dimension:'volume' as const};
 const repetitions=details.repetitions??1;
 if(!Number.isFinite(quantity.value)||quantity.value<0||!Number.isInteger(repetitions)||repetitions<0)throw new Error('无效液体操作 / Invalid liquid operation');
 return {id,component,source:'specified-stock',destination:'preparation',repetitions,planVersion:operationVersion,basis:'theoretical',...details,role,quantity};
}
/** Every registered task must be classified. Tests reject newly unclassified tools. */
export const operationCoverage:Record<string,string>={
 'hemocytometer':'not-applicable: counting only',seeding:'adapter: batch and per-well',hydrogel:'adapter: batch and per-well',split:'not-applicable: confluency estimate',freezing:'adapter: batch and per-vial',transfection:'adapter: one/two-tube batch and dispensing','kill-curve':'adapter: parallel additions and diluent',viability:'adapter: final resuspension target',od600:'not-applicable: density estimate',cfu:'not-applicable: colony count reference','colony-counter':'not-applicable: image count',dilution:'adapter: final/add/fold/ratio','reagent-dosing':'adapter: dilution','fold-dilution':'adapter: dilution','serial-dilution':'adapter: transfers and diluent',molarity:'adapter: final-volume target only','percent-solution':'adapter: v/v liquid and make-up; w/v make-up; w/w masses','media-recipe':'adapter: typed liquid rows and make-up','buffer-recipe':'adapter: typed liquid rows and make-up','ic50-ec50':'not-applicable: analysis','master-mix':'planner: per-group bulk, separate samples, dispensing',ligation:'not-applicable: DNA mass only',tm:'not-applicable: temperature estimate','dna-rna-conversion':'not-applicable: quantity conversion','bradford-bca':'not-applicable: analysis','elisa-4pl':'not-applicable: analysis','wb-loading':'adapter: each valid sample all components',moi:'adapter: virus stock','virus-titer':'not-applicable: titer estimate','unit-converter':'not-applicable: pure conversion',centrifuge:'not-applicable: speed conversion',resuspension:'adapter: make-up target',normalization:'adapter: sample and diluent'};
export function withLiquidOperations(result:CalculatorResult, inputs:Record<string,unknown>):CalculatorResult {
 if(result.operations)return {...result,operationVersion};
 const operations:LiquidOperation[]=[];
 function add(id:string,component:string,value:unknown,unit:string,role:LiquidOperation['role']='add',details:Partial<LiquidOperation>={}){
  if(value==='')return;
  if(typeof value!=='number')throw new Error('Invalid liquid operation: '+component);
  operations.push(operation(`${result.calculatorId}:${id}`,component,value,unit,role,details));
 }
 function output(key:string,role:LiquidOperation['role']='add'){const o=result.outputs.find(o=>o.key===key);if(o?.unit)add(key,o.labelZh+' / '+o.label,o.value,o.unit,role,{componentId:key});}
 const outputKeys:Record<string,string[]>={seeding:['stockVolumeMl','mediumVolumeMl'],hydrogel:['hydrogelUl','cellStockUl','mediumUl'],freezing:['dmsoMl','serumMl','baseMediumMl'],transfection:['reagentUl','dnaVolumeUl','diluentUl'],dilution:['stockVolume','diluentVolume'],'reagent-dosing':['stockVolume','diluentVolume'],'fold-dilution':['stockVolume','diluentVolume'],moi:['virusVolumeUl']};
 if(!(result.calculatorId==='transfection'&&result.table))for(const key of outputKeys[result.calculatorId]??[])output(key);
 const schemas:Record<string,string[]>={'serial-dilution':['takeUl','diluentUl'],normalization:['sampleUl','diluentUl'],'wb-loading':['sampleUl','bufferUl','reducingAgentUl','diluentUl'],'kill-curve':['stockToAddUl'],transfection:['volumeUl']};
 for(const [index,row] of (result.table??[]).entries()){
  for(const key of schemas[result.calculatorId]??[])if(key in row){
   if(result.calculatorId==='serial-dilution'&&index===0&&key==='takeUl'&&inputs.firstSource!=='stock'&&!['linear','custom'].includes(String(inputs.gradientMode)))continue;
   const label=key==='reducingAgentUl'?String(row.reducingAgent):tableColumnLabel(key,true)+' / '+tableColumnLabel(key,false);
   add(`row:${index}:${key}`,String(row.component??label),row[key],'µL',key==='takeUl'?'transfer':'add',{componentId:key,inputRow:String(index),sample:String(row.id??row.tube??row.level??index+1),source:key==='takeUl'?`tube:${index||'starting-stock'}`:`stock:${key}`,destination:`${result.calculatorId}:${row.tube??row.id??index+1}`});
  }
  if(['media-recipe','buffer-recipe'].includes(result.calculatorId)&&units[normalizeUnit(String(row.unit))]?.dimension==='volume')add(`recipe:${row.componentId}`,String(row.component),row.amount,String(row.unit),row.action==='make-up-to'?'make-up-to':'add',{componentId:String(row.componentId),inputRow:String(index)});
  if(result.calculatorId==='kill-curve')add(`diluent:${index}`,'稀释液 / Diluent',convert(parseScalar(inputs.volumePerWellMl),String(inputs.volumePerWellMlUnit??'mL'),'µL')-Number(row.stockToAddUl),'µL','add',{sample:String(row.level),destination:`well:${row.level}`});
 }
 const quantityInput=(key:string,unit:string)=>convert(parseScalar(inputs[key]),String(inputs[key+'Unit']??unit),'µL');
 if(['seeding','hydrogel'].includes(result.calculatorId))add('per-well','每孔分装 / Per well',quantityInput('volumePerWellUl','µL'),'µL','dispense',{source:'prepared-batch',destination:'wells',repetitions:parseScalar(inputs.wells)*Number(inputs.plates??1)});
 if(result.calculatorId==='freezing'&&Number(result.outputMap.vials)>0)add('per-vial','每管分装 / Per vial',quantityInput('volumePerVialMl','mL'),'µL','dispense',{source:'prepared-batch',destination:'vials',repetitions:Number(result.outputMap.vials)});
 if(result.calculatorId==='transfection'){
  if(inputs.complexMode==='two-tube')add('combine','合并A管与B管 / Combine tubes A and B',quantityInput('tubeAVolumeUl','µL')*parseScalar(inputs.wells)*parseScalar(inputs.replicates)*(1+parseScalar(inputs.overagePercent)/100),'µL','transfer',{source:'transfection:A',destination:'transfection:B'});
  add('per-well','每孔复合物 / Complex per well',quantityInput('complexVolumeUlPerWell','µL'),'µL','dispense',{source:'prepared-complex',destination:'wells',repetitions:parseScalar(inputs.wells)*parseScalar(inputs.replicates)});
 }
 if(result.calculatorId==='percent-solution'){
  if(inputs.type==='v/v')output('soluteAmount');
  if(inputs.type!=='w/w')output('targetVolumeMl','make-up-to');
 }
 if(result.calculatorId==='resuspension')output('finalVolumeUl','make-up-to');
 if(result.calculatorId==='viability')output('resuspensionVolumeMl','make-up-to');
 if(result.calculatorId==='molarity'){
  if(inputs.mode==='volume')output('volumeL','make-up-to');
  else if(inputs.mode==='mass')add('final','溶解后定容至 / Dissolve then bring to',quantityInput('volumeL','L'),'µL','make-up-to');
 }
 return {...result,operations,operationVersion};
}
