"use client";
import "./workspace.css";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {OfflineCalculator} from './OfflineCalculator';

export function CalculatorMore({zh,history}:{zh:boolean;history?:ReactNode}){
  const [panel,setPanel]=useState<'offline'|'history'|null>(null);
  const menu=useRef<HTMLDetailsElement>(null),modal=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLElement|null>(null);
  function open(next:'offline'|'history'){
    setPanel(next);trigger.current=menu.current?.querySelector('summary')??null;
    if(menu.current)menu.current.open=false;

  }
  useEffect(()=>{if(panel)modal.current?.showModal();},[panel]);
  return <><details ref={menu} className="calculator-more"><summary className="focus-ring">{zh?'更多':'More'}</summary><div><button className="focus-ring" type="button" onClick={()=>open('offline')}>{zh?'离线使用':'Offline use'}</button>{history!==undefined?<button className="focus-ring" type="button" onClick={()=>open('history')}>{zh?'历史记录':'History'}</button>:null}</div></details>{panel?createPortal(<dialog ref={modal} className="calculator-management" aria-label={panel==='offline'?(zh?'离线使用':'Offline use'):(zh?'历史记录':'History')} onClose={()=>{setPanel(null);trigger.current?.focus();}}><header><h2>{panel==='offline'?(zh?'离线使用':'Offline use'):(zh?'历史记录':'History')}</h2><button className="focus-ring" type="button" onClick={()=>modal.current?.close()}>{zh?'关闭':'Close'}</button></header>{panel==='offline'?<OfflineCalculator zh={zh} panel/>:history}</dialog>,document.body):null}</>;
}
