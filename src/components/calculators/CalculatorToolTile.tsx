"use client";
import {TaskLink} from './TaskHelp';
import {TaskIcon} from './TaskIcon';
import {taskPresentation} from '@/lib/calculators/task-presentation';
export function CalculatorToolTile({id,zh,contextQuery=''}:{id:string;zh:boolean;contextQuery?:string}){return <TaskLink id={id} zh={zh} contextQuery={contextQuery} className="calculator-tool-tile focus-ring"><TaskIcon taskId={id}/><span>{taskPresentation(id,zh).name}</span></TaskLink>;}
