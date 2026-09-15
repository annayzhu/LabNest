"use client";
import "./workspace.css";
import {useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {OfflineCalculator} from './OfflineCalculator';

export function CalculatorMore({zh,history}:{zh:boolean;history?:ReactNode}){
  const [panel,setPanel]=useState<'offline'|'history'>('offline');
  const menu=useRef<HTMLDetailsElement>(null),modal=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLElement|null>(null);
  function open(next:'offline'|'history'){
    setPanel(next);trigger.current=menu.current?.querySelector('summary')??null;
    if(menu.current)menu.current.open=false;
    modal.current?.showModal();
  }
  return <><details ref={menu} className="calculator-more"><summary>{zh?'更多':'More'}</summary><div><button type="button" onClick={()=>open('offline')}>{zh?'离线使用':'Offline use'}</button>{history!==undefined?<button type="button" onClick={()=>open('history')}>{zh?'历史记录':'History'}</button>:null}</div></details>{typeof document!=='undefined'?createPortal(<dialog ref={modal} className="calculator-management" aria-label={panel==='offline'?(zh?'离线使用':'Offline use'):(zh?'历史记录':'History')} onClose={()=>trigger.current?.focus()}><header><h2>{panel==='offline'?(zh?'离线使用':'Offline use'):(zh?'历史记录':'History')}</h2><button type="button" onClick={()=>modal.current?.close()}>{zh?'关闭':'Close'}</button></header>{panel==='offline'?<OfflineCalculator zh={zh} panel/>:history}</dialog>,document.body):null}</>;
}
