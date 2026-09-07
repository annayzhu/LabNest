"use client";
import {useState} from 'react';
import {resultCsv,resultExportRows,resultAuditText} from '@/lib/calculators/result-presentation';
import type {CalculatorResult} from '@/lib/calculators/calculator-engine';
export function ResultExport({result,zh}:{result:CalculatorResult;zh:boolean}){
 const [error,setError]=useState('');
 async function download(xlsx=false){try {
  let blob:Blob;
  if(xlsx){const {default:writeExcelFile}=await import('write-excel-file/browser');const rows=resultExportRows(result,zh);const keys=[...new Set(rows.flatMap(row=>Object.keys(row)))];const data=[keys.map(value=>({value})),...rows.map(row=>keys.map(key=>({value:String((row as Record<string,unknown>)[key]??'')})))];blob=await writeExcelFile([{data,sheet:'Components'},{data:resultAuditText(result,zh).split('\n').map(value=>[{value}]),sheet:'Notes'}]).toBlob();}
  else blob=new Blob([resultCsv(result,zh)],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${result.calculatorId}-${result.methodVersion}.${xlsx?'xlsx':'csv'}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setError('');
 }catch{setError(zh?'导出失败，请重试或复制操作步骤。':'Export failed. Retry or copy the steps.');}}
 return <div className="flex flex-wrap gap-3 text-sm"><button type="button" className="min-h-11 text-moss" onClick={()=>download()}>{zh?'导出CSV':'Export CSV'}</button><button type="button" className="min-h-11 text-moss" onClick={()=>download(true)}>{zh?'导出XLSX':'Export XLSX'}</button>{error?<p role="alert">{error}</p>:null}</div>;
}
