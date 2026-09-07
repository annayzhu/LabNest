"use client";
import Image from 'next/image';
import {useState} from 'react';
export function ProtocolMediaImage({href,label}:{href:string;label:string}){
 const [failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 return <>{failed?<div role="alert" className="rounded border border-hairline p-3 text-sm">图片加载失败 / Image unavailable <button type="button" className="min-h-11 px-2 text-moss" onClick={()=>{setFailed(false);setAttempt(n=>n+1);}}>重试 / Retry</button></div>:<Image key={attempt} src={href} alt={label} width={1200} height={800} sizes="(max-width: 760px) 100vw, 760px" unoptimized onError={()=>setFailed(true)}/>}<a className="inline-flex min-h-11 items-center text-sm text-moss" href={href} target="_blank" rel="noreferrer">查看原图 / Open original</a></>;
}
