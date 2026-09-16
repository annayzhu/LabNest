"use client";
import {useState} from 'react';
import type {CalculatorResult} from '@/lib/calculators/calculator-engine';
import {reactionMixGroups,reactionMixUnit,reactionMixQuantity,reactionMixSteps,reactionComponent} from '@/lib/calculators/reaction-mix-presentation';
import {calculatorText} from '@/lib/calculators/workspace-presentation';

export function ReactionMixResult({result,zh,onUnit,onSave,disabled,onApplyToPlate,onCopyGroup}:{
 result:CalculatorResult;zh:boolean;onUnit?:(key:string,unit:string)=>void;onSave:()=>void;disabled:boolean;onApplyToPlate?:()=>void;onCopyGroup?:(id:string)=>void;
}) {
 const [selected,setSelected]=useState('');
 const groups=reactionMixGroups(result,zh),group=groups.find(g=>g.id===selected)??groups[0];
 if(!group)return <p>{zh?'此旧记录未保存分组操作，请按原始记录核对。':'This legacy record has no grouped operation plan. Review its original record.'}</p>;
 const quantity=(value:number)=>reactionMixQuantity(value,result);
 return <div className="reaction-mix-result calculator-row-stack" data-calculator-result>
  <div className="reaction-mix-summary"><span>{zh?'独立配液组':'Separate mix groups'}: {groups.length}</span>{groups.map(g=><span key={g.id}>{groups.length>1?`${g.name}: `:''}{zh?'预混配制量':'Premix to prepare'}: {quantity(g.total)}</span>)}</div>
  {result.warnings.map(w=><p key={w} role="status" className="rounded bg-warning-surface p-2 text-xs text-warning">{calculatorText(w,zh)}</p>)}
  <div className="reaction-mix-toolbar">
   <label>{zh?'单位':'Unit'}: <select className="focus-ring" aria-label={zh?'表格单位':'Table display unit'} value={reactionMixUnit(result)} onChange={e=>onUnit?.('table:perReactionUl',e.target.value)} disabled={!onUnit}>{['µL','mL','L','nL'].map(u=><option key={u}>{u}</option>)}</select></label>
   {groups.length>1?<label>{zh?'选择配液组':'Select mix group'}<select className="focus-ring" value={group.id} onChange={e=>setSelected(e.target.value)}>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>:null}
   {groups.length>1&&onCopyGroup?<button type="button" className="focus-ring" onClick={()=>onCopyGroup(group.id)}>{zh?'复制当前组':'Copy current group'}</button>:null}
  </div>
  <section aria-label={group.name}>
   <h3 className="font-semibold">{group.name}</h3>
   {group.dispense?<p>{zh?'分装':'Dispense'}: {quantity(group.dispense.quantity.value)} × {group.dispense.repetitions} {zh?'个反应':'reactions'}</p>:null}
   <div className="calculator-data-scroll"><table><thead><tr><th>{zh?'组分':'Component'}</th><th>{zh?'每反应':'Per reaction'} ({reactionMixUnit(result)})</th><th>{zh?'加入方式':'Addition'}</th><th>{zh?'整批配制':'Batch'} ({reactionMixUnit(result)})</th></tr></thead><tbody>{group.rows.map((row,index)=><tr key={index}><td>{reactionComponent(row.component,zh)}</td><td>{quantity(Number(row.perReactionUl))}</td><td>{row.premix==='是 / Yes'?(zh?'预混':'Premix'):(zh?'单独加入':'Add separately')}</td><td>{typeof row.batchUl==='number'?quantity(row.batchUl):(zh?'按反应分别加入':'Add per reaction')}</td></tr>)}</tbody></table></div>
   <p className="text-xs text-muted">{zh?'配制量含设置的预混余量；分装量按实际反应数，不含余量。':'Preparation includes the configured premix reserve; dispensing uses the actual reaction count.'}</p>
  </section>
  <details><summary className="focus-ring">{zh?'操作步骤':'Operation steps'}</summary><ol className="reaction-mix-steps" data-liquid-operations>{reactionMixSteps(result,zh,group.id).map((step,i)=><li key={i}>{step}</li>)}</ol></details>
  {result.rawInputs?.overagePercent!==undefined?<details><summary className="focus-ring">{zh?'计算依据':'Calculation basis'}</summary><p>{group.dispense?`${quantity(group.dispense.quantity.value)} × ${group.dispense.repetitions} ${zh?'个反应':'reactions'}; `:''}{zh?'预混余量':'Premix overage'}: {String(result.rawInputs.overagePercent)}%; {zh?'预混配制量':'Premix to prepare'}: {quantity(group.total)}.</p></details>:null}
  <div className="calculator-result-actions"><button className="focus-ring" type="button" disabled={disabled} onClick={onSave}>{zh?'保存到本机历史':'Save to local history'}</button>{onApplyToPlate?<button className="focus-ring" type="button" onClick={onApplyToPlate}>{zh?'写回所选孔位':'Send to selected wells'}</button>:null}</div>
 </div>;
}
