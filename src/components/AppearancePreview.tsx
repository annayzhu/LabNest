"use client";
import {useState} from 'react';
import {Timer,Calculator,CheckCircle2,AlertTriangle} from 'lucide-react';
import {Card,CardHeader,CardBody} from './ui/Card';
import {TaskIcon} from './calculators/TaskIcon';
import {ProtocolContentBlockView} from './ProtocolDocumentView';
import {useI18n} from './I18nProvider';
/** Uses the same semantic tokens and content renderer as the actual workbench. */
export function AppearancePreview(){
 const zh=useI18n().locale==='zh';const [timer,setTimer]=useState(false);
 return <details open className="appearance-preview" data-testid="appearance-preview"><summary>{zh?'实时预览 · 示例实验':'Live preview · Example experiment'}</summary><div className="appearance-preview-body">
 <nav aria-label="Preview navigation" className="flex gap-2"><span className="appearance-selected">{zh?'实验执行':'Run'}</span><span className="p-2">{zh?'实验记录':'Records'}</span></nav>
 <Card><CardHeader title={zh?'蛋白上样 · 示例':'Protein loading · Example'}/><CardBody><p className="text-muted">EXP-001 · LabNest</p><div className="appearance-success"><CheckCircle2 size={16}/>{zh?'准备完成':'Preparation complete'}</div><h3 className="mt-3 font-semibold">{zh?'步骤 2 · 准备反应液':'Step 2 · Prepare reaction'}</h3><p className="my-3">{zh?'核对样本编号，按表加入组分。混匀后继续下一步。':'Check sample IDs and add the components below. Mix before continuing.'}</p>
 <div className="grid grid-cols-2 gap-2"><button type="button" className="appearance-tool focus-ring" onClick={()=>document.getElementById('appearance-example-volume')?.focus()}><Calculator size={16}/>{zh?'计算器':'Calculator'}</button><button type="button" className="appearance-tool focus-ring" aria-pressed={timer} onClick={()=>setTimer(!timer)}><Timer size={16}/>{timer?'04:59':zh?'计时器':'Timer'}</button></div>
 <div className="run-step-content my-3"><ProtocolContentBlockView block={{id:'appearance-table',type:'table',rows:[[zh?'组分':'Component',zh?'体积':'Volume'],[zh?'样品':'Sample','10 µL'],['4× Buffer','5 µL'],[zh?'还原剂':'Reducing agent','1 µL'],[zh?'水':'Water','4 µL']]}}/></div>
 <div className="flex items-center gap-2"><TaskIcon taskId="dilution"/><input id="appearance-example-volume" aria-label="Preview volume" defaultValue="2" className="min-h-11 min-w-0 w-20 rounded border bg-surface p-2 font-mono"/><select aria-label="Preview unit" className="min-h-11 rounded border bg-surface"><option>µL</option><option>mL</option></select></div>
 <p className="appearance-warning mt-3"><AlertTriangle size={16}/>{zh?'警告示例：0.1 µL 低于所设 1 µL 下限。':'Example warning: 0.1 µL is below the configured 1 µL minimum.'}</p><p className="appearance-error mt-2">{zh?'错误示例：目标体积不足。':'Example error: target volume is insufficient.'}</p>
 </CardBody></Card><p className="text-xs text-muted">实验计算 LabNest 0123456789 · 1e-6 μL µL ×g ng/μL · I/l/1 · O/0</p></div></details>;
}
