"use client";
import type {ReactNode} from 'react';
import {CalculatorBack} from './CalculatorNavigation';
import {TaskIcon} from './TaskIcon';
import {TaskHelp} from './TaskHelp';
export function CalculatorHeading({id,title,zh,contextQuery='',embedded=false,actions}:{id:string;title:string;zh:boolean;contextQuery?:string;embedded?:boolean;actions?:ReactNode}){return <header className="calculator-heading">{!embedded?<CalculatorBack zh={zh} href={`/tools/calculator${contextQuery?'?'+contextQuery:''}`}/>:null}<TaskIcon taskId={id}/><h1>{title}</h1><div className="calculator-heading-actions"><TaskHelp ids={[id]} zh={zh}/>{actions}</div></header>;}
