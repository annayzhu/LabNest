"use client";
import {CalculatorLinkProgress} from "./CalculatorLinkProgress";
import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
export function CalculatorBack({href,zh,catalog=false}:{href:string;zh:boolean;catalog?:boolean}){
 return <Link href={href} prefetch={false} onClick={event=>{if(!navigator.onLine){event.preventDefault();location.assign(href);}}} className="calculator-back focus-ring" aria-label={href.startsWith('/experiments/')?(zh?'返回实验':'Return to experiment'):catalog?(zh?'返回工具目录':'Back to tools'):(zh?'返回计算器':'Back to calculators')}><ArrowLeft size={20}/><CalculatorLinkProgress/></Link>;
}
