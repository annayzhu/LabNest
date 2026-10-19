"use client";
import {ChevronLeft,ChevronRight,X} from 'lucide-react';
import type {CalculatorState} from '@/lib/calculators/calculator-storage';
import {CalculatorIcon} from './CalculatorIcon';
import {TaskIcon} from './TaskIcon';
import {TaskLink,TaskHelp} from './TaskHelp';
import {taskPresentation} from '@/lib/calculators/task-presentation';
const shown=6;
/** The first `shown` pins show here; the rest fold into 全部收藏. Editing reorders and removes pins on the tiles themselves; tools below gain a pin toggle. */
export function CommonTasks({pins,state,update,zh,contextQuery="",editing,onEditing}:{contextQuery?:string;pins:string[];state:CalculatorState|null;update:(state:CalculatorState)=>void;zh:boolean;editing:boolean;onEditing:(editing:boolean)=>void}){
 const name=(id:string)=>taskPresentation(id,zh).name;
 const save=(favorites:string[])=>{if(state)update({...state,favoritesConfigured:true,favorites});};
 const move=(index:number,step:number)=>{const next=[...pins];[next[index],next[index+step]]=[next[index+step],next[index]];save(next);};
 const tile=(id:string)=><TaskLink contextQuery={contextQuery} id={id} zh={zh} key={id} className="common-task-tile focus-ring"><TaskIcon taskId={id}/><span className="common-task-name">{name(id)}</span></TaskLink>;
 return <section className="common-tasks" data-testid="common-tasks" data-editing={editing||undefined}>
  <header><h2>{zh?'常用任务':'Pinned tasks'}</h2>{editing?null:<TaskHelp ids={pins.slice(0,shown)} zh={zh}/>}<button type="button" className="common-tasks-edit focus-ring" disabled={!state} onClick={()=>onEditing(!editing)}>{editing?(zh?'完成':'Done'):(zh?'编辑':'Edit')}</button></header>
  {editing?<div className="common-task-grid">{pins.map((id,index)=><div key={id} className="common-task-tile is-editing" data-folded={index>=shown||undefined}>
   <TaskIcon taskId={id}/><span className="common-task-name">{name(id)}</span>
   <button type="button" className="common-task-remove focus-ring" aria-label={`${zh?'移除':'Remove'} ${name(id)}`} onClick={()=>save(pins.filter(key=>key!==id))}><X aria-hidden/></button>
   <span className="common-task-move"><button type="button" className="focus-ring" aria-label={`${name(id)} ${zh?'前移':'earlier'}`} disabled={index===0} onClick={()=>move(index,-1)}><ChevronLeft aria-hidden/></button><button type="button" className="focus-ring" aria-label={`${name(id)} ${zh?'后移':'later'}`} disabled={index===pins.length-1} onClick={()=>move(index,1)}><ChevronRight aria-hidden/></button></span>
  </div>)}</div>:<div className="common-task-grid">{pins.slice(0,shown).map(tile)}</div>}
  {!pins.length?<p className="common-tasks-empty">{zh?'点“编辑”，再在下方工具上固定。':'Choose Edit, then pin tools below.'}</p>:null}
  {!editing&&pins.length>shown?<details><summary>{zh?'全部收藏':'All favorites'} ({pins.length})</summary><div className="common-task-grid">{pins.slice(shown).map(tile)}</div></details>:null}
 </section>;
}
/** While pinned tasks are being edited, each tool below can be pinned or unpinned in place. */
export function PinToggle({pinned,name,zh,onToggle}:{pinned:boolean;name:string;zh:boolean;onToggle:()=>void}){
 return <button type="button" className="calculator-pin-toggle focus-ring" aria-pressed={pinned} aria-label={`${pinned?(zh?'取消固定':'Unpin'):(zh?'固定':'Pin')} ${name}`} onClick={onToggle}><CalculatorIcon name="pin" size={14}/></button>;
}
