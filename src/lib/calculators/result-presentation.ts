import type {CalculatorResult} from './calculator-engine';
import {compatibleUnits,convert,parseScalar} from './quantities';
import {tableColumnLabel} from './presentation';
export const tableQuantityUnits:Record<string,string>={takeUl:'µL',diluentUl:'µL',mixedUl:'µL',transferUl:'µL',remainingUl:'µL',requiredUl:'µL',perReactionUl:'µL',batchUl:'µL',availableUl:'µL',sampleUl:'µL',bufferUl:'µL',reducingAgentUl:'µL',totalUl:'µL',theoreticalUl:'µL',actualUl:'µL',volumeUl:'µL',stockToAddUl:'µL',targetProteinUg:'µg'};
export function tableUnitsFor(result:CalculatorResult):Record<string,string>{return {...tableQuantityUnits,...(result.calculatorId==='wb-loading'?{originalConcentration:'µg/µL'}:result.calculatorId==='normalization'?{originalConcentration:'ng/µL'}:result.calculatorId==='serial-dilution'?{concentration:'µM'}:{}),doseUgMl:'µg/mL'};}
export function displayQuantity(value:number,unit:string,target?:string){return {value:target?convert(value,unit,target):value,unit:target??unit};}
export function formatQuantity(value:number){return value!==0&&(Math.abs(value)<0.001||Math.abs(value)>=1e7)?value.toExponential(5):value.toLocaleString('en',{maximumSignificantDigits:9,useGrouping:false});}
export function validateDisplayUnits(result:CalculatorResult,candidate:unknown):Record<string,string>{
 if(!candidate||typeof candidate!=='object')return {};
 const valid:Record<string,string>={};for(const [key,value] of Object.entries(candidate)){const unit=key.startsWith('table:')?tableUnitsFor(result)[key.slice(6)]:result.outputs.find(o=>o.key===key)?.unit;if(unit&&typeof value==='string'&&compatibleUnits(unit).includes(value))valid[key]=value;else throw new Error('Invalid display unit');}return valid;
}
export function presentedOutputs(result:CalculatorResult){return result.outputs.map(o=>typeof o.value==='number'&&o.unit?{...o,...displayQuantity(o.value,o.unit,result.displayUnits?.[o.key])}:o);}
export function presentedTable(result:CalculatorResult,zh:boolean){
 const rows=result.table??[];return rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>{
  const unit=tableUnitsFor(result)[key],target=result.displayUnits?.['table:'+key]??unit;
  const label=tableColumnLabel(key,zh);return [unit?(label.includes('(')?label.replace(/\([^)]*\)/,`(${target})`):`${label} (${target})`):label,unit&&value!==''&&(typeof value==='number'||(typeof value==='string'&&value.trim()!==''&&Number.isFinite(Number(value))))?convert(parseScalar(value),unit,target):value];
 })));
}
export function resultExportRows(result:CalculatorResult,zh:boolean){
 const data=result.table?.length?presentedTable(result,zh):presentedOutputs(result).map(o=>({name:zh?o.labelZh:o.label,value:o.value,unit:o.unit??''}));
 const metadata={operations:JSON.stringify(result.operations??[]),operationVersion:result.operationVersion??'legacy-unrecorded',pipettingCheck:JSON.stringify(result.pipettingCheck??{}),context:JSON.stringify(result.rawInputs?.__context??{}),task:result.calculatorId,mode:result.mode??'',method:result.methodVersion,resultStatus:result.status??'legacy',warnings:result.warnings.join('\n'),assumptions:result.notes.join('\n'),inputs:JSON.stringify(result.rawInputs??{}),outputs:JSON.stringify(presentedOutputs(result)),displayUnits:JSON.stringify(result.displayUnits??{}),structuredWarnings:JSON.stringify(result.structuredWarnings??[])};
 return data.map(row=>({...row,...metadata}));
}
export function resultAuditText(result:CalculatorResult,zh:boolean){
 const table=presentedTable(result,zh);return [result.calculatorId+' · '+(result.mode??''),...presentedOutputs(result).map(o=>`${zh?o.labelZh:o.label}: ${typeof o.value==='number'?formatQuantity(o.value):o.value} ${o.unit??''}`),...(table.length?[Object.keys(table[0]).join('\t'),...table.map(row=>Object.values(row).map(value=>typeof value==='number'?formatQuantity(value):value).join('\t'))]:[]),`Operations (${result.operationVersion??'legacy-unrecorded'}): ${JSON.stringify(result.operations??[])}`,`Pipetting check: ${JSON.stringify(result.pipettingCheck??{})}`,zh?'警告':'Warnings',...result.warnings,zh?'关键假设':'Assumptions',...result.notes,`Status: ${result.status??'legacy'}; Method: ${result.methodVersion}`,`Inputs: ${JSON.stringify(result.rawInputs??{})}`,`Context: ${JSON.stringify(result.rawInputs?.__context??{})}`].join('\n');
}
export function resultCsv(result:CalculatorResult,zh:boolean){const rows=resultExportRows(result,zh);const keys=[...new Set(rows.flatMap(row=>Object.keys(row)))];const cell=(v:unknown)=>'"'+(typeof v==='number'?String(v):String(v??'').replace(/^[=+@\-]/,"'$&")).replaceAll('"','""')+'"';return '\uFEFF'+[keys.map(cell).join(','),...rows.map(row=>keys.map(key=>cell((row as Record<string,unknown>)[key])).join(','))].join('\r\n');}

/** Copy is a concise user result; structured provenance stays in exports and snapshots. */
export function canCopyResult(result:CalculatorResult){
 return result.status!=='partial' && (result.outputs.length>0 || Boolean(result.table?.length)) &&
  result.outputs.every(o=>typeof o.value!=='number'||Number.isFinite(o.value)) &&
  (result.table??[]).every(row=>Object.values(row).every(v=>typeof v!=='number'||Number.isFinite(v)));
}
export function resultClipboard(result:CalculatorResult,zh:boolean){
 if(!canCopyResult(result))return '';
 const lines=presentedOutputs(result).filter(o=>(zh?o.labelZh:o.label).trim()).map(o=>`${zh?o.labelZh:o.label}: ${typeof o.value==='number'?formatQuantity(o.value):o.value}${o.unit?' '+o.unit:''}`);
 // Keep user-facing component amounts, tube sources and instructions, never internal IDs/status.
 const hidden=new Set(['status','componentId','groupId','inputRow','planVersion','methodVersion','reducingMode','reducingDefinition','originalConcentration','availableUl','sufficient','concentrationUnit','volumeUnit','action']);
 const table=presentedTable({...result,table:result.table?.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>!hidden.has(key))))},zh);
 for(const row of table)lines.push(Object.entries(row).filter(([key,value])=>key.trim()&&value!=='').map(([key,value])=>`${key}: ${typeof value==='number'?formatQuantity(value):value}`).join('; '));
 for(const op of result.operations??[]){
  if(!['make-up-to','dispense'].includes(op.role)&&!(result.calculatorId==='transfection'&&op.role==='transfer'))continue;
  if(op.role==='make-up-to'&&(result.table?.some(row=>row.action==='make-up-to')||result.outputs.some(o=>o.unit&&typeof o.value==='number'&&tableQuantityUnits[o.key]===undefined&&/volume/i.test(o.key))))continue;
  const component=op.component.split(' / ')[zh?0:1]??op.component;
  const instruction=op.role==='make-up-to'?(zh?'定容至':'Bring to final volume'):component;
  lines.push(`${instruction}: ${formatQuantity(op.quantity.value)} ${op.quantity.unit}${op.repetitions>1?' × '+op.repetitions:''}`);
 }
 return lines.filter(Boolean).join('\n');
}
