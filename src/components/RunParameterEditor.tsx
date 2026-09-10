"use client";
import {useI18n} from "@/components/I18nProvider";
import {useActionState,useEffect,useState} from 'react';
import {saveRunParameters} from '@/app/experiments/[id]/run/actions';
export function RunParameterEditor({experimentId,keys,values,editable}:{experimentId:string;keys:string[];values:Record<string,unknown>;editable:boolean}){
 const {locale}=useI18n();const zh=locale==="zh";
 const [state,action,pending]=useActionState(saveRunParameters,{});
 const storageKey=`labnest.run-parameters-draft:${experimentId}`;
 const [draft,setDraft]=useState<Record<string,string>>({}),[notice,setNotice]=useState('');
 useEffect(()=>{const frame=requestAnimationFrame(()=>{try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(saved?.fields){setDraft(saved.fields);setNotice('Unsaved parameters restored');}}catch{setNotice('Parameter draft storage unavailable');}});return()=>cancelAnimationFrame(frame);},[storageKey]);
 useEffect(()=>{if(!state.message)return;try{sessionStorage.removeItem(storageKey);}catch{}const frame=requestAnimationFrame(()=>{setDraft({});setNotice('');});return()=>cancelAnimationFrame(frame);},[state,storageKey]);
 function edit(key:string,value:string){const next={...draft,[key]:value};setDraft(next);try{sessionStorage.setItem(storageKey,JSON.stringify({fields:next}));}catch{setNotice('Cannot save parameter draft; keep this page');}}

 if(!keys.length)return null;
 return <details className="rounded border border-hairline p-3"><summary className="min-h-11 cursor-pointer">{zh?"实验参数":"Run parameters"}</summary><form action={action} className="space-y-3"><input type="hidden" name="experimentId" value={experimentId}/><input type="hidden" name="expected" value={JSON.stringify(values)}/><p className="text-xs">{zh?"仅更新本实验参数；空值保留未解析占位。":"Changes this run only; blank values retain unresolved placeholders."}</p><div className="grid gap-3 sm:grid-cols-2">{keys.map(key=><label key={key} className="text-sm">{key}<input className="block min-h-11 w-full rounded border border-hairline px-3" name={`parameter:${key}`} value={draft[key]??String(values[key]??'')} onChange={e=>edit(key,e.target.value)} disabled={!editable||pending}/></label>)}</div><button type="submit" className="focus-ring min-h-11 rounded bg-moss px-3 text-warm" disabled={!editable||pending}>{pending?(zh?'保存中':'Saving'):(zh?'保存参数':'Save parameters')}</button>{notice?<p role="status" className="text-xs text-warning">{notice}</p>:null}<p role={state.error?'alert':'status'}>{state.error??state.message}</p></form></details>;
}
