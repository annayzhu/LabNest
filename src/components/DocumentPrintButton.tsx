"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

export function DocumentPrintButton({ label = "Print", showLabel = false }: { label?: string; showLabel?: boolean }) {
  useEffect(()=>{
    const query=new URLSearchParams(location.search);
    const saved=query.get('qpcrSaved');
    if(saved){for(const key of Object.keys(localStorage))if(key.startsWith('labnest:qpcr-record:'))try{if(JSON.parse(localStorage.getItem(key)??'{}').id===saved)localStorage.removeItem(key);}catch{} query.delete('qpcrSaved');history.replaceState(null,'',location.pathname+(query.size?'?'+query:''));}
    if(query.get('print')!=='1')return;
    let active=true;
    Promise.all([document.fonts.ready,...Array.from(document.images).map(image=>image.complete?Promise.resolve():new Promise<void>(resolve=>{image.addEventListener('load',()=>resolve(),{once:true});image.addEventListener('error',()=>resolve(),{once:true});}))]).then(()=>{if(active){history.replaceState(null,'',location.pathname);window.print();}});
    return()=>{active=false;};
  },[]);
  return (
    <button
      type="button"
      onClick={async(event) => {
        const form=event.currentTarget.closest('form');
        if(form && form.querySelector('input[name="qpcrDraftId"]') && location.pathname.startsWith('/results/')){
          if(!form.reportValidity())return;
          let field=form.querySelector<HTMLInputElement>('input[name="printAfterSave"]');
          if(!field){field=document.createElement('input');field.type='hidden';field.name='printAfterSave';form.append(field);}field.value='1';form.requestSubmit();return;
        }
        await document.fonts.ready;
        await Promise.all(Array.from(document.images).map(image=>image.decode().catch(()=>{})));
        window.print();
      }}
      aria-label={label}
      title={label}
      className={`focus-ring inline-flex h-7 items-center justify-center gap-1.5 rounded-[var(--ln-radius-control-sm)] border border-hairline bg-surface text-graphite hover:border-border-strong hover:text-ink ${showLabel ? "w-auto px-2" : "w-7 p-0"}`}
    >
      <Printer className="h-3.5 w-3.5" aria-hidden />
      <span className={showLabel ? "text-xs font-medium" : "sr-only"}>{label}</span>
    </button>
  );
}
