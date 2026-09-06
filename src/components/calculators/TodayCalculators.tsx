"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {loadCalculatorState,calculatorStorageKey} from '@/lib/calculators/calculator-storage';
import {defaultTasks} from '@/lib/calculators/task-definitions';
import {taskPresentation} from '@/lib/calculators/task-presentation';
import {TaskIcon} from './TaskIcon';
import {useI18n} from '@/components/I18nProvider';
export function TodayCalculators(){const [ids,setIds]=useState<string[]>([]),zh=useI18n().locale==='zh';useEffect(()=>{const read=()=>{const state=loadCalculatorState();setIds((state.favoritesConfigured?state.favorites:defaultTasks).slice(0,3));};const frame=requestAnimationFrame(read);const change=(e:StorageEvent)=>{if(e.key===calculatorStorageKey)read();};window.addEventListener('storage',change);return()=>{cancelAnimationFrame(frame);window.removeEventListener('storage',change);};},[]);return ids.length?<div className="flex flex-wrap gap-2" aria-label="Pinned calculations">{ids.map(id=><Link key={id} href={`/tools/calculator/${id}`} className="focus-ring flex min-h-11 items-center gap-2 rounded px-2 text-xs"><TaskIcon taskId={id} size={28}/>{taskPresentation(id,zh).name}</Link>)}</div>:null;}
