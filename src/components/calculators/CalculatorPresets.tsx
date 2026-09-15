"use client";
import {useState} from 'react';
import {useModalDialog} from '@/components/ui/ModalDialogProvider';
import type {CalculatorPreset} from '@/lib/calculators/calculator-storage';

/** Reuses stored input presets; opening a preset never restores an old output. */
export function CalculatorPresets({zh,presets,disabled,onSave,onLoad,onRename,onDelete}:{
  zh:boolean;presets:CalculatorPreset[];disabled:boolean;
  onSave:(name:string)=>void;onLoad:(preset:CalculatorPreset)=>void;
  onRename:(id:string,name:string)=>void;onDelete:(id:string)=>void;
}) {
  const dialog=useModalDialog();
  const [query,setQuery]=useState('');
  const cancelLabel=zh?'取消':'Cancel';
  async function namePreset(preset?:CalculatorPreset){
    const name=await dialog.prompt({title:preset?(zh?'重命名预设':'Rename preset'):(zh?'存为预设':'Save as preset'),inputLabel:zh?'预设名称':'Preset name',defaultValue:preset?.name??'',confirmLabel:zh?'保存':'Save',cancelLabel});
    if(name?.trim()){if(preset)onRename(preset.id,name);else onSave(name);}
  }
  async function load(preset:CalculatorPreset){
    if(await dialog.confirm({title:zh?'载入预设？':'Load preset?',description:zh?'将替换当前输入。取消可保留当前修改。':'This replaces the current inputs. Cancel to keep your changes.',confirmLabel:zh?'载入':'Load',cancelLabel}))onLoad(preset);
  }
  const visible=presets.filter(p=>String(p.name).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div className="calculator-presets" aria-label={zh?'常用预设':'Presets'}>
    {presets.length>0&&presets.length<=6?<select className="focus-ring" aria-label={zh?'常用预设':'Presets'} value="" onChange={e=>{const preset=presets.find(p=>p.id===e.target.value);if(preset)void load(preset);}}><option value="">{zh?'常用预设':'Presets'}</option>{presets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>:null}
    <button className="focus-ring" type="button" disabled={disabled} onClick={()=>void namePreset()}>{zh?'存为预设':'Save as preset'}</button>
    {presets.length>0?<details className="calculator-preset-menu"><summary className="focus-ring">{presets.length>6?(zh?'选择 / 管理预设':'Choose / manage presets'):(zh?'管理预设':'Manage presets')}</summary><label>{zh?'搜索预设':'Search presets'}<input className="focus-ring" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="calculator-preset-list">{visible.map(p=><div key={p.id}><button type="button" className="focus-ring calculator-preset-name" onClick={()=>void load(p)}>{p.name}</button><button className="focus-ring" type="button" disabled={disabled} aria-label={`${zh?'重命名':'Rename'} ${p.name}`} onClick={()=>void namePreset(p)}>{zh?'重命名':'Rename'}</button><button className="focus-ring" type="button" disabled={disabled} aria-label={`${zh?'删除':'Delete'} ${p.name}`} onClick={async()=>{if(await dialog.confirm({title:zh?'删除此预设？':'Delete this preset?',description:p.name,confirmLabel:zh?'删除':'Delete',cancelLabel}))onDelete(p.id);}}>{zh?'删除':'Delete'}</button></div>)}{!visible.length?<p>{zh?'没有匹配的预设':'No matching presets'}</p>:null}</div></details>:null}
  </div>;
}
