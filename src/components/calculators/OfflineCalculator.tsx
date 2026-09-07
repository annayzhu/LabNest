"use client";
import {useState} from 'react';
export function OfflineCalculator({zh}:{zh:boolean}) {
 const [status,setStatus]=useState('');
 async function cachePage(){
  try {
   if(!('serviceWorker' in navigator))throw new Error('Unavailable');
   setStatus(zh?'正在缓存此页…':'Caching this page…');
   const registration=await navigator.serviceWorker.register('/tools/calculator/worker.js',{scope:'/'});
   const worker=registration.active??registration.installing??registration.waiting;
   if(!worker)throw new Error('Unavailable');
   if(worker.state!=='activated')await new Promise<void>(resolve=>worker.addEventListener('statechange',()=>{if(worker.state==='activated')resolve();}));
   const urls=[window.location.href,...performance.getEntriesByType('resource').map(item=>item.name)];
   const result=await new Promise<boolean>((resolve)=>{const channel=new MessageChannel();const timer=setTimeout(()=>resolve(false),20000);channel.port1.onmessage=event=>{clearTimeout(timer);resolve(Boolean(event.data.ok));};worker.postMessage({type:'CACHE_CALCULATOR',urls},[channel.port2]);});
   setStatus(result?(zh?'此页已缓存；离线可恢复草稿。':'This page is cached; drafts can be restored offline.'):(zh?'缓存未完成，请保持联网重试。':'Caching incomplete; retry while online.'));
  }catch{setStatus(zh?'无法缓存。需要HTTPS或本机地址。':'Cannot cache. HTTPS or localhost is required.');}
 }
 return <details className="text-xs text-muted"><summary className="min-h-11 cursor-pointer">{zh?'离线使用':'Offline use'}</summary><button type="button" className="min-h-11 text-moss" onClick={cachePage}>{zh?'缓存当前页':'Cache this calculation page'}</button><p role="status">{status}</p></details>;
}
