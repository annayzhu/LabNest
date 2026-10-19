"use client";
import {useState,useRef,useEffect} from 'react';
import {useAppearance} from '@/components/AppearanceProvider';
import {taskIconResource} from '@/lib/calculators/task-presentation';
import {CalculatorIcon,calculatorToolIcons} from './CalculatorIcon';
/** A calculation's icon in the user's icon pack (Settings → 外观): the lab-soft picture where one exists, else the solid icon. */
export function TaskIcon({taskId,size=28,pack}:{taskId:string;size?:number;pack?:string}){
 const {preferences}=useAppearance();
 const src=taskIconResource(taskId,pack??preferences.iconPackId);
 const [failed,setFailed]=useState<string|null>(null);
 const imageRef=useRef<HTMLImageElement>(null);
 useEffect(()=>{
  // A failed image may have finished before React hydrated and attached onError.
  const node=imageRef.current;
  if(src&&node?.complete&&!node.naturalWidth){
   const frame=requestAnimationFrame(()=>setFailed(src));
   return()=>cancelAnimationFrame(frame);
  }
 },[src]);
 return <span aria-hidden="true" className="task-icon shrink-0" style={{width:size,height:size,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{src&&failed!==src?
 // Already optimized 128px local alpha asset; direct img also works in the standalone/offline pack.
 // eslint-disable-next-line @next/next/no-img-element
 <img ref={imageRef} src={src} width={size} height={size} alt="" onError={()=>setFailed(src)} style={{width:size,height:size,objectFit:'contain'}}/>:<CalculatorIcon name={calculatorToolIcons[taskId as keyof typeof calculatorToolIcons]??'calculator'} size={size}/>}</span>;
}
