"use client";
import { EmbeddedSampleImport } from "./EmbeddedSampleImport";
import { useEffect, useRef, useState } from "react";
export function EmbeddedLabTool({ id, title, fullPage = false, samples }: { id: string; title: string; fullPage?: boolean; samples?: { label: string; names: string[] } }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(()=>{
    if(id!=='qpcr-plate-layout' || !samples?.names.length)return;
    const receive=(event:MessageEvent)=>{if(event.source!==frame.current?.contentWindow || event.origin!==location.origin || event.data?.type!=='TOOL_READY')return;frame.current.contentWindow?.postMessage({protocol:'labnest-qpcr-v1',type:'CONTEXT_INIT',sessionId:`samples-${samples.label}`,samples:samples.names.map((name,index)=>({id:`sample-${index}`,name,kind:'sample'}))},location.origin);};
    window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
  },[id,samples]);
  return <section aria-label={title} className="min-w-0 flex-1">
    {id.endsWith("plate-layout") && id !== "qpcr-plate-layout" ? <EmbeddedSampleImport frame={frame} toolId={id} preset={samples} /> : null}
    {!loaded ? <p role="status" className="py-2 text-sm text-muted">正在打开工具…</p> : null}
    <iframe ref={frame} title={title} src={`/tools/${id}/index.html`} onLoad={() => setLoaded(true)} className={fullPage?"block h-[calc(100dvh-5rem)] min-h-[32rem] w-full border-0 bg-white":"block h-[calc(100dvh-12rem)] min-h-[32rem] w-full border-0 bg-white"} allow="clipboard-write" />
  </section>;
}
