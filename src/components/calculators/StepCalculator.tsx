"use client";
import {useI18n} from "@/components/I18nProvider";
import {CalculatorIcon,calculatorToolIcon} from './CalculatorIcon';
import './workspace.css';
import {DialogHeader,dialogClass} from '@/components/ui/DialogShell';
import {useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {getCalculatorCatalog} from '@/lib/calculators/calculator-engine';
import {legacyTaskMap} from '@/lib/calculators/task-definitions';
export function StepCalculator({experimentId,stepId,stepTitle}:{experimentId:string;stepId:string;stepTitle?:string}) {
  const {locale}=useI18n();const zh=locale==="zh";
  const context=`experimentId=${encodeURIComponent(experimentId)}&experimentStepId=${encodeURIComponent(stepId)}${stepTitle?`&contextLabel=${encodeURIComponent(stepTitle.slice(0,120))}`:''}`;
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const [tool,setTool]=useState('dilution'),[open,setOpen]=useState(false);
  const href=`/tools/calculator/${tool}?${context}`;
  const close=()=>{dialog.current?.close();setOpen(false);trigger.current?.focus();};
  return <><button ref={trigger} type="button" className="flex min-w-0 min-h-11 items-center justify-center gap-1 rounded-lg border border-hairline px-2 text-sm text-moss" onClick={()=>{if(window.matchMedia('(max-width: 767px)').matches){window.dispatchEvent(new Event('labnest:preserve-run-draft'));let last='';try{const recent=JSON.parse(localStorage.getItem('labnest.calculators.v1')??'null')?.recent?.[0]?.calculatorId;if(typeof recent==='string'&&getCalculatorCatalog().some(t=>t.id===recent&&!legacyTaskMap[t.id]))last=recent;}catch{}window.location.assign(`/tools/calculator${last?`/${last}`:''}?${context}`);return;}setOpen(true);requestAnimationFrame(()=>dialog.current?.showModal());}}><CalculatorIcon name={calculatorToolIcon} size={18}/><span className="min-w-0 [overflow-wrap:anywhere]">{locale==="zh"?"计算器":"Calculator"}</span></button>{open?createPortal(<dialog aria-label="Step calculations" ref={dialog} data-form="drawer" onCancel={close} onClick={event=>{if(event.target===event.currentTarget)close();}} className={dialogClass("calculator-step-drawer")}><DialogHeader title={zh?'步骤计算':'Step calculation'} subtitle={stepTitle} closeLabel={zh?'关闭':'Close'} onClose={close}/><div className="calculator-step-picker"><select aria-label="Calculation task" value={tool} onChange={e=>setTool(e.target.value)}>{getCalculatorCatalog().filter(t=>!legacyTaskMap[t.id]).map(t=><option key={t.id} value={t.id}>{zh?t.nameZh:t.name}</option>)}</select></div><iframe title="Step calculation" src={`${href}&embed=step&locale=${zh?'zh':'en'}`}/></dialog>,document.body):null}</>;
}
