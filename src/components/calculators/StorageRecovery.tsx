"use client";
import {getCalculatorRawBackup} from '@/lib/calculators/calculator-storage';
export function StorageRecovery({message,onRetry,zh}:{message:string;onRetry:()=>void;zh:boolean}) {
 if(!message)return null;
 const raw=getCalculatorRawBackup();
 function download(){if(raw===null)return;const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='labnest-calculator-original.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <aside role="status" className="rounded border border-warning p-3 text-sm"><p>{message}</p><p>{zh?'当前输入仅临时保留；恢复将重新读取旧历史，不自动保存临时草稿。':'Current inputs are temporary; recovery reloads history without automatically saving temporary drafts.'}</p><button type="button" className="min-h-11 mr-3 underline" onClick={onRetry}>{zh?'重试读取与恢复':'Retry reading and recovery'}</button>{raw!==null?<button type="button" className="min-h-11 underline" onClick={download}>{zh?'下载原始数据':'Download original data'}</button>:null}</aside>;
}
