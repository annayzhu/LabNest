"use client";
import {Calculator} from 'lucide-react';
import {useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {getCalculatorCatalog} from '@/lib/calculators/calculator-engine';
import {legacyTaskMap} from '@/lib/calculators/task-definitions';
export function StepCalculator({experimentId,stepId}:{experimentId:string;stepId:string}) {
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const [tool,setTool]=useState('dilution'),[open,setOpen]=useState(false);
  const href=`/tools/calculator/${tool}?experimentId=${encodeURIComponent(experimentId)}&experimentStepId=${encodeURIComponent(stepId)}`;
  const close=()=>{dialog.current?.close();setOpen(false);trigger.current?.focus();};
  return <><button ref={trigger} type="button" className="flex min-h-11 items-center justify-center gap-1 rounded-lg border border-hairline px-3 text-sm text-moss" onClick={()=>{if(window.matchMedia('(max-width: 767px)').matches){window.dispatchEvent(new Event('labnest:preserve-run-draft'));window.location.assign(`/tools/calculator?experimentId=${encodeURIComponent(experimentId)}&experimentStepId=${encodeURIComponent(stepId)}`);return;}setOpen(true);requestAnimationFrame(()=>dialog.current?.showModal());}}><Calculator className="h-4 w-4" aria-hidden/>计算器</button>{open?createPortal(<dialog aria-label="Step calculations" ref={dialog} onCancel={close} className="ml-auto h-screen max-h-screen w-[min(760px,100vw)] max-w-full border-l border-hairline bg-surface p-4 backdrop:bg-black/30"><div className="flex gap-2"><select aria-label="Calculation task" className="min-h-11 min-w-0 flex-1" value={tool} onChange={e=>setTool(e.target.value)}>{getCalculatorCatalog().filter(t=>!legacyTaskMap[t.id]).map(t=><option key={t.id} value={t.id}>{t.nameZh} / {t.name}</option>)}</select><button type="button" className="min-h-11 px-3" onClick={close}>关闭 / Close</button></div><iframe title="Step calculation" className="mt-2 h-[calc(100%-60px)] min-h-[80vh] w-full border-0" src={`${href}&embed=step`}/></dialog>,document.body):null}</>;
}
