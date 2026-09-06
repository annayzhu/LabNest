"use client";
import {tableColumnLabel} from "@/lib/calculators/presentation";
import type {CalculatorResult} from '@/lib/calculators/calculator-engine';
export function ResultExport({result,zh}:{result:CalculatorResult;zh:boolean}){
 function download(){
  const table=result.table??result.outputs.map(o=>({name:zh?o.labelZh:o.label,value:o.value,unit:o.unit??''}));
  const cell=(value:unknown)=>`"${String(value??'').replace(/^[=+@\-]/,"'$&").replaceAll('"','""')}"`;
  const keys=Object.keys(table[0]??{});const csv='\uFEFF'+[keys.map(key=>cell(tableColumnLabel(key,zh))).join(','),...table.map(row=>keys.map(key=>cell((row as Record<string,unknown>)[key])).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`${result.calculatorId}-${result.methodVersion}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <button type="button" className="min-h-11 text-sm text-moss" onClick={download}>{zh?'导出当前结果CSV（含状态）':'Export current result CSV (with status)'}</button>;
}
