"use client";

import {useId,useRef,useState,type ButtonHTMLAttributes,type ReactNode} from 'react';
import {CalculatorIcon,type CalculatorIconName} from './CalculatorIcon';

/** Roles share presentation; the caller keeps the action's object and behavior. */
export function CalculatorButton({icon,variant='secondary',className='',children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{icon?:CalculatorIconName;variant?:'primary'|'secondary'|'manage'|'add'|'row';children?:ReactNode}){
 return <button type="button" {...props} className={`calculator-action calculator-action-${variant} focus-ring ${className}`}>{icon?<CalculatorIcon name={icon} size={18}/>:null}{children}</button>;
}

/** Native radio semantics supply Tab and arrow-key operation without custom focus code. */
export function CalculatorMode({label,value,options,onChange}:{label:string;value:string;options:{value:string;label:string;icon?:CalculatorIconName}[];onChange:(value:string)=>void}){
 const name=useId();
 return <fieldset className="calculator-mode"><legend>{label}</legend><div className="calculator-mode-options">{options.map(option=><label key={option.value} data-selected={value===option.value}><input type="radio" name={name} value={option.value} checked={value===option.value} onChange={()=>onChange(option.value)}/>{option.icon?<CalculatorIcon name={option.icon} size={18}/>:null}<span>{option.label}</span></label>)}</div></fieldset>;
}

/** Keep children mounted: collapsing a setting must not erase its draft. */
export function CalculatorDisclosure({title,children,icon,summary,className=''}:{title:ReactNode;children:ReactNode;icon?:CalculatorIconName;summary?:string;className?:string}){
 const [open,setOpen]=useState(false),id=useId(),trigger=useRef<HTMLButtonElement>(null);
 function close(){trigger.current?.focus({preventScroll:true});setOpen(false);}
 return <section className={`calculator-disclosure ${className}`} onKeyDown={event=>{if(event.key==='Escape'&&open){event.stopPropagation();event.preventDefault();close();}}}>
  <button type="button" ref={trigger} className="calculator-disclosure-trigger focus-ring" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}>{icon?<CalculatorIcon name={icon} size={18}/>:null}<span>{title}</span><svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 16 16"><path d={open?'M4 10 8 6l4 4':'M4 6l4 4 4-4'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
  {!open&&summary?<p className="calculator-setting-summary">{summary}</p>:null}
  <div id={id} hidden={!open} className="calculator-disclosure-content">{children}</div>
 </section>;
}
