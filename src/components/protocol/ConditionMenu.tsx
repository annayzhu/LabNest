'use client';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2 } from 'lucide-react';
import { optionMarks } from '@/lib/protocol-chips';
import { conditionTagLabel } from '@/lib/protocol-conditions';
import { blankProtocolSystems, type ProtocolSystems } from '@/lib/protocol-systems-schema';
import { prefixedClientId as uid } from '@/lib/client-mutation-id';
import { toggleScope } from '@/lib/protocol-scope';
import { SystemMark } from './SystemMark';
import { useAnchoredPosition, useDismiss } from './popover';
import { useProtocolEditor, type ConditionTarget } from './ProtocolEditorContext';

type Rule = ProtocolSystems['rules'][number];
const predicates = (rule: Rule) => [...(rule.when.all ?? []), ...(rule.when.any ?? [])];

export function ConditionMenu({ target, onDeleteStep, onColumn, onClose }: { target: ConditionTarget; onDeleteStep: () => void; onColumn: (value: string | null) => void; onClose: () => void }) {
  const api = useProtocolEditor();
  const panel = useRef<HTMLDivElement>(null);
  const style = useAnchoredPosition(target.anchor, panel, [api.systems]);
  useDismiss(panel, target.anchor, onClose);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const systems = api.systems ?? blankProtocolSystems();
  const marks = optionMarks(systems);
  if (target.kind === 'column') return createPortal(<div ref={panel} className="ln-condition-menu" style={style} role="dialog" aria-label="这一列的适用体系">
    <p className="ln-condition-menu-title">这一列仅适用于</p>
    {systems.dimensions.filter(d => d.kind !== 'condition').map(dimension => <div key={dimension.id} className="ln-condition-menu-row">
      <span className="ln-condition-menu-dimension">{dimension.label}</span>
      <span className="ln-condition-menu-options">{dimension.options.map(option => { const key = `${dimension.id}:${option.id}`, mark = marks.get(key); return <button className="focus-ring" key={option.id} type="button" aria-pressed={target.id === key} data-tone={mark?.tone} onClick={() => onColumn(target.id === key ? null : key)}>{mark?.symbol ? <SystemMark mark={mark} /> : null}{option.label}</button>; })}</span>
    </div>)}
    {!systems.dimensions.some(d => d.kind !== 'condition') ? <p className="ln-condition-menu-note">先在上方添加体系，再把配方表的列标给对应选项。</p> : <p className="ln-condition-menu-note">执行时只保留所选体系的列；阅读全部体系时表头带符号。</p>}
  </div>, document.body);
  const own = systems.rules.filter(rule => rule.target === target.kind && rule.targetId === target.id);
  const selected = (dimensionId: string, optionId: string) => own.some(rule => predicates(rule).some(p => p.dimensionId === dimensionId && p.optionId === optionId));
  const optional = own.some(rule => rule.optional);
  const createCondition = () => {
    const label = name.trim();
    if (!label) return;
    const dimension = { id: uid('dimension'), label, kind: 'condition' as const, options: [{ id: uid('option'), label: '是' }, { id: uid('option'), label: '否' }] };
    api.updateSystems(current => toggleScope({ ...current, dimensions: [...current.dimensions, dimension] }, target as { kind: 'step' | 'block'; id: string }, dimension.id, dimension.options[0].id));
    setNaming(false); setName('');
  };
  return createPortal(<div ref={panel} className="ln-condition-menu" style={style} role="dialog" aria-label={target.kind === 'step' ? '这一步的适用范围' : '这段内容的适用范围'}>
    <p className="ln-condition-menu-title">仅适用于</p>
    {systems.dimensions.length ? systems.dimensions.map(dimension => <div key={dimension.id} className="ln-condition-menu-row">
      <span className="ln-condition-menu-dimension">{dimension.label}</span>
      <span className="ln-condition-menu-options">{dimension.options.map(option => { const mark = marks.get(`${dimension.id}:${option.id}`); return <button className="focus-ring" key={option.id} type="button" aria-pressed={selected(dimension.id, option.id)} data-tone={mark?.tone}
        onClick={() => api.updateSystems(current => toggleScope(current, target as { kind: 'step' | 'block'; id: string }, dimension.id, option.id))}>{mark?.symbol ? <SystemMark mark={mark} /> : null}{dimension.kind === 'condition' ? conditionTagLabel(dimension.label, option.label) : option.label}</button>; })}</span>
    </div>) : <p className="ln-condition-menu-note">还没有体系或条件。新建一个条件，例如“富脂组织”。</p>}
    {naming ? <form className="ln-condition-menu-new" onSubmit={event => { event.preventDefault(); createCondition(); }}>
      <input autoFocus aria-label="条件名称" placeholder="条件名称，如 富脂组织" value={name} onChange={event => setName(event.target.value)} />
      <button className="focus-ring" type="submit" disabled={!name.trim()}>创建</button>
    </form> : <button type="button" className="focus-ring ln-condition-menu-link" onClick={() => setNaming(true)}><Plus aria-hidden />新条件</button>}
    {target.kind === 'step' ? <>
      <label className="ln-condition-menu-check"><input type="checkbox" checked={optional} onChange={() => api.updateSystems(current => optional
        ? { ...current, rules: current.rules.flatMap(rule => rule.target === 'step' && rule.targetId === target.id && rule.optional ? predicates(rule).length ? [{ ...rule, optional: false }] : [] : [rule]) }
        : { ...current, rules: [...current.rules, { id: uid('rule'), target: 'step' as const, targetId: target.id, when: {}, parameterIds: [], actualFields: [], optional: true }] })} />可选步骤：执行时可跳过，不计入必需进度</label>
      <button type="button" className="focus-ring ln-condition-menu-link is-danger" onClick={onDeleteStep}><Trash2 aria-hidden />删除这一步</button>
    </> : null}
  </div>, document.body);
}
