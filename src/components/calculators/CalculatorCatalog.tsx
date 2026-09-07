"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Search} from 'lucide-react';
import {useI18n} from '@/components/I18nProvider';
import {getCalculatorCatalog} from '@/lib/calculators/catalog';
import {defaultTasks,legacyTaskMap} from '@/lib/calculators/task-definitions';
import {taskPresentation} from '@/lib/calculators/task-presentation';
import {toggleFavorite} from '@/lib/calculators/calculator-storage';
import {useCalculatorState} from './useCalculatorState';
import {CommonTasks} from './CommonTasks';
import {CalculatorToolTile} from './CalculatorToolTile';
import {CalculatorBack} from './CalculatorNavigation';
import {TaskHelp} from './TaskHelp';
import {StorageRecovery} from './StorageRecovery';
import {OfflineCalculator} from './OfflineCalculator';
const groups=[['solutions','Solutions','配液'],['cell-culture','Cells','细胞'],['virology-microbiology','Microbiology','微生物'],['molecular-biology','Nucleic acids','核酸'],['protein','Protein','蛋白'],['general','Units & equipment','单位与设备']];
const catalog=getCalculatorCatalog().filter(t=>!legacyTaskMap[t.id]);
const key='labnest.calculator.catalog-view';
export function CalculatorCatalog({contextQuery=''}:{contextQuery?:string}){
 const zh=useI18n().locale==='zh',{state,update,persistenceWarning,retry}=useCalculatorState();
 const [query,setQuery]=useState(''),[manage,setManage]=useState(false);
 const unfilteredScroll=useRef(0);
 function search(value:string){if(!query&&value)unfilteredScroll.current=scrollY;setQuery(value);const position=value?0:unfilteredScroll.current;try{sessionStorage.setItem(key,JSON.stringify({query:value,scroll:position,unfilteredScroll:unfilteredScroll.current}));}catch{}if(!value)requestAnimationFrame(()=>scrollTo(0,position));}
 useEffect(()=>{try{const saved=JSON.parse(sessionStorage.getItem(key)||'null');if(saved){unfilteredScroll.current=saved.unfilteredScroll??0;const frame=requestAnimationFrame(()=>{setQuery(saved.query||'');requestAnimationFrame(()=>scrollTo(0,saved.scroll||0));});return()=>cancelAnimationFrame(frame);}}catch{}},[]);
 useEffect(()=>{const save=()=>{try{sessionStorage.setItem(key,JSON.stringify({query,scroll:scrollY,unfilteredScroll:unfilteredScroll.current}));}catch{}};window.addEventListener('scroll',save,{passive:true});window.addEventListener('pagehide',save);return()=>{window.removeEventListener('scroll',save);window.removeEventListener('pagehide',save);};},[query]);
 const pins=state?.favoritesConfigured?state.favorites:defaultTasks;
 const filtered=catalog.filter(t=>[t.name,t.nameZh,...t.aliases,taskPresentation(t.id,zh).name].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
 const context=new URLSearchParams(contextQuery),back=context.get('experimentId')&&context.get('experimentStepId')?`/experiments/${encodeURIComponent(context.get('experimentId')!)}/run#step-${encodeURIComponent(context.get('experimentStepId')!)}`:'/tools';
 const seen=new Set<string>();
 const recent=(state?.recent??[]).filter(item=>{const id=legacyTaskMap[item.calculatorId]?.task??item.calculatorId;if(seen.has(id))return false;seen.add(id);return true;}).slice(0,3);
 return <div className="calculator-catalog"><div className="calculator-catalog-heading"><CalculatorBack href={back} zh={zh} catalog/><h1>{zh?'实验计算':'Lab Calculations'}</h1><label><Search size={18}/><input aria-label={zh?'搜索计算':'Search calculations'} value={query} onChange={e=>search(e.target.value)} placeholder={zh?'搜索工具…':'Search…'}/></label></div>
 {contextQuery?<a className="text-sm text-moss min-h-11 flex items-center" href={back}>{zh?'返回实验':'Return to experiment'}</a>:null}
 <StorageRecovery message={persistenceWarning} onRetry={retry} zh={zh}/>
 {!query?<><CommonTasks pins={pins} state={state} update={update} zh={zh} contextQuery={contextQuery}/>{recent.length?<section className="calculator-recent"><h2>{zh?'最近使用':'Recently used'}</h2>{recent.map(item=>{const id=legacyTaskMap[item.calculatorId]?.task??item.calculatorId,t=catalog.find(t=>t.id===id);if(!t)return null;const summary=[t.shortDescription,t.shortDescriptionZh].includes(item.summary)?'':item.summary;return <div key={id}><Link prefetch={false} href={`/tools/calculator/${id}${contextQuery?'?'+contextQuery:''}`}>{taskPresentation(id,zh).name}</Link>{summary?<p>{t.fields.reduce((text,f)=>text.replaceAll(zh?f.label:f.labelZh,zh?f.labelZh:f.label),summary)}</p>:null}</div>;})}</section>:null}</>:null}
 <div className="calculator-categories" data-testid="calculator-categories">{groups.map(([category,en,cn])=>{const tools=filtered.filter(t=>t.category===category);return tools.length?<section className={`calculator-category category-${category}`} key={category}><header><h2>{zh?cn:en} <small>{tools.length}</small></h2><TaskHelp ids={tools.map(t=>t.id)} zh={zh}/></header><div className="calculator-category-tools">{tools.map(t=><div key={t.id}><CalculatorToolTile id={t.id} zh={zh} contextQuery={contextQuery}/>{manage?<button type="button" className="focus-ring min-h-11 w-full text-xs" onClick={()=>state&&update(toggleFavorite({...state,favorites:[...pins]},t.id))}>{pins.includes(t.id)?(zh?'取消固定':'Unpin'):(zh?'固定':'Pin')}</button>:null}</div>)}</div></section>:null;})}</div>
 {!filtered.length?<p>{zh?'没有匹配工具':'No matching tools'}</p>:null}
 <div className="calculator-catalog-footer"><button type="button" className="min-h-11 text-xs" onClick={()=>setManage(!manage)}>{manage?(zh?'完成管理':'Done managing'):(zh?'管理全部常用':'Manage pinned tools')}</button><details><summary>{zh?'我的配方':'My recipes'} ({state?.presets.length??0})</summary>{state?.presets.map(p=><Link key={p.id} href={`/tools/calculator/${p.calculatorId}${contextQuery?'?'+contextQuery:''}`}>{p.name}</Link>)}</details><details><summary>{zh?'计算记录':'Calculation records'} ({state?.history.length??0})</summary>{state?.history.map(r=><Link key={r.id} href={`/tools/calculator/${r.calculatorId}?record=${encodeURIComponent(r.id)}${contextQuery?'&'+contextQuery:''}`}>{zh?r.calculatorNameZh:r.calculatorName}</Link>)}</details></div><OfflineCalculator zh={zh}/></div>;
}
