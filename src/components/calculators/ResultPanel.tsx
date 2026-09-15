"use client";
import {useState} from 'react';
import {primaryOutputKeys,calculatorText} from '@/lib/calculators/workspace-presentation';
import {TransfectionResult} from './TransfectionResult';
import {LiquidOperations} from './LiquidOperations';
import type {CalculatorResult} from '@/lib/calculators/calculator-engine';
import {compatibleUnits} from '@/lib/calculators/quantities';
import {presentedOutputs,presentedTable,formatQuantity,tableUnitsFor} from '@/lib/calculators/result-presentation';
import {tableColumnLabel} from '@/lib/calculators/presentation';
import {ResultExport} from './ResultExport';
import {FitPlot} from './FitPlot';
export function ResultPanel({result,zh,onSave,disabled,onApplyToPlate,onUnit}:{result:CalculatorResult;zh:boolean;onSave:()=>void;disabled:boolean;onApplyToPlate?:()=>void;onUnit?:(key:string,unit:string)=>void}) {
 const picker=(key:string,unit:string,label:string)=>compatibleUnits(unit).length>1&&onUnit?<select aria-label={`${label} ${zh?'显示单位':'display unit'}`} className="max-w-28 rounded border border-hairline bg-transparent px-1 text-xs" value={result.displayUnits?.[key]??unit} onChange={e=>onUnit(key,e.target.value)}>{compatibleUnits(unit).map(value=><option key={value}>{value}</option>)}</select>:<span className="text-xs">{unit}</span>;
 const [selectedGroup,setSelectedGroup]=useState('');
 const groups=[...new Set((result.table??[]).map(row=>String(row.group??'')).filter(Boolean))];
 const group=groups.includes(selectedGroup)?selectedGroup:groups[0];
 const visibleRows=groups.length>1?result.table?.filter(row=>String(row.group)===group):result.table;
 const hiddenColumns=new Set(['componentId','groupId','inputRow','planVersion','reducingMode','reducingDefinition','concentrationUnit','volumeUnit','originalConcentration','availableUl']);
 const mainRows=visibleRows?.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>!hiddenColumns.has(key)&&!(key==='group'&&groups.length<=1))));
 const table=presentedTable({...result,table:mainRows},zh);
 const local=(value:unknown)=>{const known:Record<string,[string,string]>={'是 / Yes':['是','Yes'],'独立加样 / Separate':['单独加入','Separate'],'水 / Water':['水','Water'],'有效 / Valid':['有效','Valid'],'已备起始液 / Prepared starting solution':['已备起始液','Prepared starting solution']};return typeof value==='string'&&known[value]?known[value][zh?0:1]:typeof value==='string'?calculatorText(value,zh):value;};
 const curve=['bradford-bca','elisa-4pl','ic50-ec50'].includes(result.calculatorId);
 const tableView=table.length?<div className="calculator-data-scroll"><table><thead><tr>{Object.keys(table[0]).map(key=><th key={key}>{key}</th>)}</tr></thead><tbody>{table.map((row,index)=><tr key={index}>{Object.values(row).map((value,column)=><td key={column}>{typeof value==='number'?formatQuantity(value):String(local(value))}</td>)}</tr>)}</tbody></table></div>:null;
 const priority=primaryOutputKeys[result.calculatorId]??[];
 const outputs=presentedOutputs(result).filter(o=>!(result.calculatorId==='cfu'&&o.key==='transformantsPerUg'&&o.value==='Not calculated')).sort((a,b)=>{const rank=(key:string)=>priority.includes(key)?priority.indexOf(key):priority.length;return rank(a.key)-rank(b.key);});
 const values=(items:typeof outputs)=><dl className="calculator-result-values">{items.map(output=><div key={output.key}><dt>{zh?output.labelZh:output.label}</dt><dd><span>{typeof output.value==='number'?formatQuantity(output.value):String(local(output.value))}</span>{output.unit?picker(output.key,result.outputs.find(o=>o.key===output.key)!.unit!,zh?output.labelZh:output.label):null}</dd></div>)}</dl>;
 return <div className="min-w-0 space-y-3" data-calculator-result>
  {values(curve?outputs.slice(0,2):result.methodVersion==='transfection-v3'?outputs.filter(o=>o.key.startsWith(`group${groups.indexOf(group)}_`)&&/_(mixed|final|batch)$/.test(o.key)):table.length?outputs.slice(0,3):outputs)}
  {groups.length>1?<nav className="calculator-group-tabs" aria-label={zh?'结果组':'Result group'}>{groups.map(value=><button key={value} type="button" aria-pressed={value===group} onClick={()=>setSelectedGroup(value)}>{value}</button>)}</nav>:null}
  {result.methodVersion==='transfection-v3'?<TransfectionResult result={{...result,table:visibleRows}} zh={zh}/>:!curve?tableView:null}
  <FitPlot result={result} zh={zh}/>
  {result.status==='estimate'?<p className="text-xs">{zh?'估算结果':'Estimated result'}</p>:null}
  {result.status==='partial'?<p role="status" className="text-warning">{zh?'部分样本无效，请查看对应行。':'Some samples are invalid. Review their rows.'}</p>:null}
  {result.pipettingCheck?.status==='below-minimum'?<p role="status" className="text-warning">{zh?'存在低于所设移液下限的步骤':'Some steps are below the configured pipetting minimum'}</p>:null}
  {result.warnings.map(w=><p key={w} className="rounded bg-warning-surface p-2 text-xs text-warning">{calculatorText(w,zh)}</p>)}
  <div className="calculator-result-actions"><button type="button" className="rounded border border-moss text-moss disabled:opacity-40" disabled={disabled} onClick={onSave}>{zh?'保存到本机历史':'Save to local history'}</button><ResultExport result={result} zh={zh}/>{onApplyToPlate?<button type="button" className="rounded bg-moss text-warm" onClick={onApplyToPlate}>{zh?'写回所选孔位':'Send to selected wells'}</button>:null}</div>
  {table.length?<details><summary>{zh?'表格单位':'Table units'}</summary><div className="flex flex-wrap gap-2">{Object.keys(result.table![0]).filter(key=>tableUnitsFor(result)[key]).map(key=><label key={key} className="text-xs">{tableColumnLabel(key,zh)} {picker('table:'+key,tableUnitsFor(result)[key],tableColumnLabel(key,zh))}</label>)}</div></details>:null}
  {curve||table.length>0?<details><summary>{zh?'完整结果与拟合参数':'Full results and fit parameters'}</summary>{values(outputs)}{curve?tableView:<div className="calculator-data-scroll"><table><thead><tr>{Object.keys(presentedTable(result,zh)[0]??{}).map(key=><th key={key}>{key}</th>)}</tr></thead><tbody>{presentedTable(result,zh).map((row,i)=><tr key={i}>{Object.values(row).map((v,j)=><td key={j}>{String(v)}</td>)}</tr>)}</tbody></table></div>}</details>:null}
  {result.operations?.length?<details><summary>{zh?'操作详情':'Operation details'}</summary><LiquidOperations operations={result.operations} zh={zh}/></details>:null}
  {result.notes.length?<details><summary>{zh?'结果说明':'Result notes'}</summary>{result.notes.map(note=><p key={note} className="text-xs text-muted">{calculatorText(note,zh)}</p>)}</details>:null}
 </div>;
}
