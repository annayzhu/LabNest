"use client";
import "./workspace.css";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {OfflineCalculator} from './OfflineCalculator';
import {TaskHelp} from './TaskHelp';
import {DialogHeader,dialogClass} from '@/components/ui/DialogShell';

export function CalculatorMore({zh,history,help}:{zh:boolean;history?:ReactNode;help?:{ids:string[];sections?:{title:string;ids:string[]}[]}}){
  const [panel,setPanel]=useState<'offline'|'history'|null>(null);
  const menu=useRef<HTMLDetailsElement>(null),modal=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLElement|null>(null);
  function open(next:'offline'|'history'){
    setPanel(next);trigger.current=menu.current?.querySelector('summary')??null;
    if(menu.current)menu.current.open=false;
    if(modal.current&&!modal.current.open)modal.current.showModal();
  }
  useEffect(()=>{if(panel&&modal.current&&!modal.current.open)modal.current.showModal();},[panel]);
  useEffect(()=>{const outside=(event:PointerEvent)=>{if(menu.current?.open&&!menu.current.contains(event.target as Node))menu.current.open=false;};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&menu.current?.open&&menu.current.contains(document.activeElement)){menu.current.open=false;menu.current.querySelector('summary')?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[]);
  return <><details ref={menu} className="calculator-more"><summary className="focus-ring">{zh?'更多':'More'}</summary><div>{help?<TaskHelp ids={help.ids} sections={help.sections} zh={zh} trigger="focus-ring" onOpen={()=>{if(menu.current)menu.current.open=false;}} returnFocus={()=>menu.current?.querySelector('summary')}/>:null}<button className="focus-ring" type="button" onClick={()=>open('offline')}>{zh?'离线使用':'Offline use'}</button>{history!==undefined?<button className="focus-ring" type="button" onClick={()=>open('history')}>{zh?'历史记录':'History'}</button>:null}</div></details>{panel?createPortal(<dialog ref={modal} data-form="sheet" className={dialogClass("calculator-management")} aria-label={panel==='offline'?(zh?'离线使用':'Offline use'):(zh?'历史记录':'History')} onClick={event=>{if(event.target===event.currentTarget)modal.current?.close();}} onClose={()=>trigger.current?.focus()}><DialogHeader title={panel==='offline'?(zh?'离线使用':'Offline use'):(zh?'历史记录':'History')} closeLabel={zh?'关闭':'Close'} onClose={()=>modal.current?.close()}/><div className="ln-dialog-body"><div hidden={panel!=='offline'}><OfflineCalculator zh={zh} panel/></div>{panel==='history'?history:null}</div></dialog>,document.body):null}</>;
}
