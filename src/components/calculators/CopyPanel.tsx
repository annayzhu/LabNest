"use client";
import {useRef} from 'react';
export function CopyPanel({text,zh,onRetry}:{text:string;zh:boolean;onRetry:()=>void}) {
 const ref=useRef<HTMLTextAreaElement>(null);
 return <section className="calculator-copy-panel" aria-label={zh?'手动复制结果':'Manual result copy'}>
  <p>{zh?'未能自动复制。请选择完整文本复制，或重试。':'Automatic copy failed. Select the complete text to copy, or retry.'}</p>
  <textarea ref={ref} aria-label={zh?'完整结果':'Complete result'} readOnly rows={8} value={text}/>
  <div className="flex flex-wrap gap-3"><button type="button" className="focus-ring min-h-11" onClick={()=>{ref.current?.focus({preventScroll:true});ref.current?.select();}}>{zh?'全选':'Select all'}</button><button type="button" className="focus-ring min-h-11" onClick={onRetry}>{zh?'重试复制':'Retry copy'}</button></div>
  <p>{zh?'电脑：Ctrl/Cmd+C。手机：长按选区并选择“复制”。':'Desktop: Ctrl/Cmd+C. Phone: press and hold the selection, then choose Copy.'}</p>
 </section>;
}
