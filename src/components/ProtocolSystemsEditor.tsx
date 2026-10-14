'use client';

import { newClientMutationId } from '@/lib/client-mutation-id';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { type ProtocolDocument } from '@/lib/protocol-document';
import { executionBlockText, projectProtocolExecution } from '@/lib/protocol-execution';
import { validateProtocolSystems, type ProtocolCondition, type ProtocolSystems } from '@/lib/structured-protocol';
import { units } from '@/lib/calculators/quantities';
import { formInputClass } from './forms';
import { Button } from './ui/Button';
import './ProtocolSystems.css';

const uid = (prefix: string) => `${prefix}-${newClientMutationId()}`;
const blankSystems = (): ProtocolSystems => ({ schemaVersion: 1, dimensions: [], parameters: [], presets: [], rules: [], restrictions: [] });
type Parameter = ProtocolSystems['parameters'][number];

export function ProtocolConditionEditor({ value, systems, onChange }: { value: ProtocolCondition; systems: ProtocolSystems; onChange: (value: ProtocolCondition) => void }) {
  const mode = value.any !== undefined ? 'any' : value.not !== undefined ? 'not' : 'all';
  const predicates = value[mode] ?? [];
  const set = (next: typeof predicates) => onChange({ [mode]: next });
  return <div className="protocol-condition-editor">
    <select aria-label="条件关系" className={formInputClass} value={mode} onChange={event => onChange({ [event.target.value]: predicates })}><option value="all">同时满足</option><option value="any">满足任一</option><option value="not">均不满足</option></select>
    {predicates.map((predicate, index) => <div key={index} className="protocol-system-fields">
      <select aria-label={`条件 ${index + 1} 的维度`} className={formInputClass} value={predicate.dimensionId} onChange={event => set(predicates.map((p, i) => i === index ? { dimensionId: event.target.value, optionId: systems.dimensions.find(d => d.id === event.target.value)?.options[0]?.id ?? '' } : p))}>{systems.dimensions.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select>
      <select aria-label={`条件 ${index + 1} 的选项`} className={formInputClass} value={predicate.optionId} onChange={event => set(predicates.map((p, i) => i === index ? { ...p, optionId: event.target.value } : p))}>{systems.dimensions.find(d => d.id === predicate.dimensionId)?.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
      <button type="button" aria-label={`删除条件 ${index + 1}`} onClick={() => set(predicates.filter((_, i) => i !== index))}><Trash2 size={16}/></button>
    </div>)}
    <Button type="button" size="sm" disabled={!systems.dimensions[0]?.options.length} onClick={() => set([...predicates, { dimensionId: systems.dimensions[0].id, optionId: systems.dimensions[0].options[0].id }])}>添加条件</Button>
    {!predicates.length ? <small>所有体系通用</small> : null}
  </div>;
}

export function ProtocolSystemsEditor({ document, onChange, open, onOpenChange }: { document: ProtocolDocument; onChange: (document: ProtocolDocument) => void; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [tab, setTab] = useState('dimensions');
  const systems = document.systems;
  const update = (next: ProtocolSystems) => onChange({ ...document, systems: next });
  const steps = projectProtocolExecution(document).steps;
  const blocks = document.sections.flatMap(s => s.blocks);
  const targets = [
    ...steps.map(s => ({ target: 'step' as const, id: s.source_ref!, label: `步骤 · ${s.title}` })),
    ...blocks.map(b => ({ target: 'block' as const, id: b.id, label: `内容 · ${executionBlockText(b).slice(0, 60) || b.type}` })),
    ...blocks.flatMap(b => b.type === 'table' ? b.rows.slice(1).flatMap((r, i) => b.rowIds?.[i + 1] ? [{ target: 'row' as const, id: b.rowIds[i + 1], label: `表格行 · ${r.join(' · ').slice(0, 60)}` }] : []) : []),
  ];
  const changeParameter = (next: Parameter) => systems && update({ ...systems, parameters: systems.parameters.map(p => p.id === next.id ? next : p) });
  return <details id="protocol-systems" open={open} onToggle={event => onOpenChange?.(event.currentTarget.open)} className="protocol-systems-editor" data-protocol-systems-editor>
    <summary>实验体系与参数 {systems ? `· ${systems.dimensions.length} 个选择维度` : '· 尚未设置'}</summary>
    {!systems ? <div className="protocol-system-section"><p>在同一份规程中定义体系差异。共同操作只保留一次；实验开始时再确认实际选择。</p><Button type="button" onClick={() => update(blankSystems())}>设置实验体系</Button></div> : <>
      <div role="tablist" aria-label="体系设置" className="protocol-system-tabs">{[['dimensions', '体系与预设'], ['parameters', '参数'], ['rules', '适用条件']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
      {tab === 'dimensions' ? <div className="protocol-system-section">
        <p>体积、样本性质等分别建立维度。推荐预设不会替代实验中的人工确认。</p>
        {systems.dimensions.map(d => <fieldset key={d.id} className="protocol-system-item"><legend>{d.label}</legend>
          <label>维度名称<input className={formInputClass} value={d.label} onChange={e => update({ ...systems, dimensions: systems.dimensions.map(x => x.id === d.id ? { ...d, label: e.target.value } : x) })}/></label>
          {d.options.map(o => <div key={o.id} className="protocol-system-fields"><label>选项名称<input className={formInputClass} value={o.label} onChange={e => update({ ...systems, dimensions: systems.dimensions.map(x => x.id === d.id ? { ...d, options: d.options.map(v => v.id === o.id ? { ...o, label: e.target.value } : v) } : x) })}/></label><Button type="button" size="sm" disabled={d.options.length === 1} onClick={() => update({ ...systems, dimensions: systems.dimensions.map(x => x.id === d.id ? { ...d, options: d.options.filter(v => v.id !== o.id) } : x) })}>删除选项</Button></div>)}
          <Button type="button" size="sm" onClick={() => update({ ...systems, dimensions: systems.dimensions.map(x => x.id === d.id ? { ...d, options: [...d.options, { id: uid('option'), label: '新选项' }] } : x) })}>添加选项</Button>
          <Button type="button" size="sm" onClick={() => update({ ...systems, dimensions: systems.dimensions.filter(x => x.id !== d.id) })}>删除维度</Button>
        </fieldset>)}
        <Button type="button" size="sm" onClick={() => update({ ...systems, dimensions: [...systems.dimensions, { id: uid('dimension'), label: '体积体系', options: [{ id: uid('option'), label: '350 µL' }, { id: uid('option'), label: '600 µL' }] }] })}><Plus size={16}/>添加选择维度</Button>
        <h3>常用组合</h3>
        {systems.presets.map(p => <div className="protocol-system-item" key={p.id}><label>组合名称<input className={formInputClass} value={p.label} onChange={e => update({ ...systems, presets: systems.presets.map(v => v.id === p.id ? { ...p, label: e.target.value } : v) })}/></label>{systems.dimensions.map(d => <label key={d.id}>{d.label}<select className={formInputClass} value={p.selections[d.id] ?? ''} onChange={e => update({ ...systems, presets: systems.presets.map(v => v.id === p.id ? { ...p, selections: Object.fromEntries(Object.entries({ ...p.selections, [d.id]: e.target.value }).filter(([, value]) => value)) } : v) })}><option value="">未指定</option>{d.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>)}<Button type="button" size="sm" onClick={() => update({ ...systems, presets: systems.presets.filter(v => v.id !== p.id) })}>删除组合</Button></div>)}
        <Button type="button" size="sm" onClick={() => update({ ...systems, presets: [...systems.presets, { id: uid('preset'), label: '常用体系', selections: {} }] })}>添加组合预设</Button>
      </div> : null}
      {tab === 'parameters' ? <div className="protocol-system-section">
        <p>每个参数只有一个来源。使用正文上方的“插入参数”将它放到当前光标处。</p>
        <datalist id="protocol-known-units">{Object.keys(units).map(unit => <option key={unit} value={unit}/>)}</datalist>
        {systems.parameters.map(p => <fieldset key={p.id} className="protocol-system-item"><legend>{p.label}</legend><div className="protocol-system-fields">
          <label>参数名称<input className={formInputClass} value={p.label} onChange={e => changeParameter({ ...p, label: e.target.value })}/></label>
          <label>显示单位<input className={formInputClass} list="protocol-known-units" value={p.unit} onChange={e => changeParameter({ ...p, unit: e.target.value })}/></label>
          <label>参数来源<select className={formInputClass} value={p.source.kind} onChange={e => changeParameter({ ...p, source: e.target.value === 'fixed' ? { kind: 'fixed', value: null, unit: p.unit } : e.target.value === 'actual' ? { kind: 'actual' } : e.target.value === 'calculator' ? { kind: 'calculator', calculatorId: 'dilution', output: 'stockVolumeUl', inputs: { stockConcentration: '', targetConcentration: '', finalVolume: '' } } : { kind: 'lookup', values: [] } })}><option value="fixed">固定值</option><option value="lookup">按条件查表</option><option value="actual">实验时实际填写</option><option value="calculator">已有计算器</option></select></label>
        </div>
          {p.source.kind === 'calculator' ? <div className="protocol-system-section"><p>稀释计算器 · 配至最终体积。输入引用已有参数；执行时计算后人工确认采用。</p>
            {(['stockConcentration', 'targetConcentration', 'finalVolume'] as const).map(key => <label key={key}>{{ stockConcentration: '母液浓度', targetConcentration: '目标浓度', finalVolume: '最终体积' }[key]}<select className={formInputClass} value={p.source.kind === 'calculator' ? p.source.inputs[key] : ''} onChange={e => p.source.kind === 'calculator' && changeParameter({ ...p, source: { ...p.source, inputs: { ...p.source.inputs, [key]: e.target.value } } })}><option value="">选择输入参数</option>{systems.parameters.filter(input => input.id !== p.id).map(input => <option key={input.id} value={input.id}>{input.label} · {input.unit}</option>)}</select></label>)}
            <label>采用的输出<select className={formInputClass} value={p.source.output} onChange={e => p.source.kind === 'calculator' && changeParameter({ ...p, source: { ...p.source, output: e.target.value as 'stockVolumeUl' | 'diluentVolume' } })}><option value="stockVolumeUl">母液取液体积</option><option value="diluentVolume">稀释液加入量</option></select></label>
          </div> : null}
          {p.source.kind === 'fixed' ? <div className="protocol-system-fields"><label>固定来源数值<input type="number" step="any" className={formInputClass} value={p.source.value ?? ''} onChange={e => changeParameter({ ...p, source: { kind: 'fixed', value: e.target.value === '' ? null : Number(e.target.value), unit: p.source.kind === 'fixed' ? p.source.unit : p.unit } })}/></label><label>数值单位<input className={formInputClass} list="protocol-known-units" value={p.source.unit} onChange={e => p.source.kind === 'fixed' && changeParameter({ ...p, source: { ...p.source, unit: e.target.value } })}/></label></div> : null}
          {p.source.kind === 'lookup' ? <>{p.source.values.map(v => <div className="protocol-system-item" key={v.id}><ProtocolConditionEditor systems={systems} value={v.when} onChange={when => p.source.kind === 'lookup' && changeParameter({ ...p, source: { ...p.source, values: p.source.values.map(x => x.id === v.id ? { ...v, when } : x) } })}/><div className="protocol-system-fields"><label>取值<input type="number" step="any" className={formInputClass} value={v.value ?? ''} onChange={e => p.source.kind === 'lookup' && changeParameter({ ...p, source: { ...p.source, values: p.source.values.map(x => x.id === v.id ? { ...v, value: e.target.value === '' ? null : Number(e.target.value) } : x) } })}/></label><label>数值单位<input className={formInputClass} list="protocol-known-units" value={v.unit} onChange={e => p.source.kind === 'lookup' && changeParameter({ ...p, source: { ...p.source, values: p.source.values.map(x => x.id === v.id ? { ...v, unit: e.target.value } : x) } })}/></label><Button type="button" size="sm" onClick={() => p.source.kind === 'lookup' && changeParameter({ ...p, source: { ...p.source, values: p.source.values.filter(x => x.id !== v.id) } })}>删除取值</Button></div></div>)}<Button type="button" size="sm" onClick={() => p.source.kind === 'lookup' && changeParameter({ ...p, source: { ...p.source, values: [...p.source.values, { id: uid('value'), when: {}, value: null, unit: p.unit }] } })}>添加条件取值</Button></> : null}
          <Button type="button" size="sm" onClick={() => update({ ...systems, parameters: systems.parameters.filter(x => x.id !== p.id) })}>删除参数</Button>
        </fieldset>)}
        <Button type="button" size="sm" onClick={() => update({ ...systems, parameters: [...systems.parameters, { id: uid('parameter'), label: '新参数', unit: 'µL', source: { kind: 'fixed', value: null, unit: 'µL' } }] })}>添加参数</Button>
      </div> : null}
      {tab === 'rules' ? <div className="protocol-system-section">
        <p>按步骤、段落或表格行分别设置。没有条件的内容通用；只有标为同一“互斥组”的分支才不能同时适用。</p>
        {systems.rules.map(rule => <fieldset key={rule.id} className="protocol-system-item"><legend>适用规则</legend>
          <label>作用内容<select className={formInputClass} value={`${rule.target}:${rule.targetId}`} onChange={e => { const target = targets.find(t => `${t.target}:${t.id}` === e.target.value); if (target) update({ ...systems, rules: systems.rules.map(r => r.id === rule.id ? { ...r, target: target.target, targetId: target.id } : r) }); }}>{targets.map(t => <option key={`${t.target}:${t.id}`} value={`${t.target}:${t.id}`}>{t.label}</option>)}</select></label>
          <ProtocolConditionEditor systems={systems} value={rule.when} onChange={when => update({ ...systems, rules: systems.rules.map(r => r.id === rule.id ? { ...r, when } : r) })}/>
          <label>互斥组（可留空）<input className={formInputClass} value={rule.exclusiveGroup ?? ''} onChange={e => update({ ...systems, rules: systems.rules.map(r => r.id === rule.id ? { ...r, exclusiveGroup: e.target.value || undefined } : r) })}/></label>
          {rule.target === 'step' ? <>
            <label>执行范围<select className={formInputClass} value={rule.scope ?? 'group'} onChange={e => update({ ...systems, rules: systems.rules.map(r => r.id === rule.id ? { ...r, scope: e.target.value as 'group' | 'experiment' } : r) })}><option value="group">每个实验组分别执行</option><option value="experiment">整次实验共同执行一次</option></select></label>
            <label><input type="checkbox" checked={rule.optional} onChange={e => update({ ...systems, rules: systems.rules.map(r => r.id === rule.id ? { ...r, optional: e.target.checked } : r) })}/>可选操作</label>
            <label>使用的计时参数<select className={formInputClass} value={rule.timerParameterId ?? ''} onChange={e => update({ ...systems, rules: systems.rules.map(r => r.id === rule.id ? { ...r, timerParameterId: e.target.value || undefined } : r) })}><option value="">不绑定</option>{systems.parameters.filter(p => units[p.unit]?.dimension === 'time').map(p => <option key={p.id} value={p.id}>{p.label} · {p.unit}</option>)}</select></label>
            <div>依赖参数{systems.parameters.map(p => <label key={p.id}><input type="checkbox" checked={rule.parameterIds.includes(p.id)} onChange={e => update({ ...systems, rules: systems.rules.map(r => r.id === rule.id ? { ...r, parameterIds: e.target.checked ? [...r.parameterIds, p.id] : r.parameterIds.filter(id => id !== p.id) } : r) })}/>{p.label}</label>)}</div>
            {rule.actualFields.map(field => <div key={field.id} className="protocol-system-fields"><label>实际值名称<input className={formInputClass} value={field.label} onChange={e => update({ ...systems, rules: systems.rules.map(r => r.id === rule.id ? { ...r, actualFields: r.actualFields.map(f => f.id === field.id ? { ...f, label: e.target.value } : f) } : r) })}/></label><label>单位<input className={formInputClass} value={field.unit} onChange={e => update({ ...systems, rules: systems.rules.map(r => r.id === rule.id ? { ...r, actualFields: r.actualFields.map(f => f.id === field.id ? { ...f, unit: e.target.value } : f) } : r) })}/></label><label><input type="checkbox" checked={field.required} onChange={e => update({ ...systems, rules: systems.rules.map(r => r.id === rule.id ? { ...r, actualFields: r.actualFields.map(f => f.id === field.id ? { ...f, required: e.target.checked } : f) } : r) })}/>必填</label></div>)}
            <Button type="button" size="sm" onClick={() => update({ ...systems, rules: systems.rules.map(r => r.id === rule.id ? { ...r, actualFields: [...r.actualFields, { id: uid('actual'), label: '实际用量', unit: 'µL', required: true }] } : r) })}>添加实际值记录项</Button>
          </> : null}
          <Button type="button" size="sm" onClick={() => update({ ...systems, rules: systems.rules.filter(r => r.id !== rule.id) })}>删除规则</Button>
        </fieldset>)}
        <Button type="button" size="sm" disabled={!targets.length} onClick={() => update({ ...systems, rules: [...systems.rules, { id: uid('rule'), target: targets[0].target, targetId: targets[0].id, when: {}, parameterIds: [], actualFields: [], optional: false }] })}>添加适用规则</Button>
        <h3>禁止的组合</h3>
        {systems.restrictions.map(r => <div key={r.id} className="protocol-system-item"><label>原因<input className={formInputClass} value={r.message} onChange={e => update({ ...systems, restrictions: systems.restrictions.map(x => x.id === r.id ? { ...r, message: e.target.value } : x) })}/></label><ProtocolConditionEditor value={r.when} systems={systems} onChange={when => update({ ...systems, restrictions: systems.restrictions.map(x => x.id === r.id ? { ...r, when } : x) })}/><Button type="button" size="sm" onClick={() => update({ ...systems, restrictions: systems.restrictions.filter(x => x.id !== r.id) })}>删除限制</Button></div>)}
        <Button type="button" size="sm" onClick={() => update({ ...systems, restrictions: [...systems.restrictions, { id: uid('restriction'), when: {}, message: '此组合不适用，请调整体系' }] })}>添加组合限制</Button>
      </div> : null}
      {validateProtocolSystems(systems).length ? <ul role="alert" className="text-error">{validateProtocolSystems(systems).map((issue, index) => <li key={index}>{issue.message}</li>)}</ul> : null}
    </>}
  </details>;
}
