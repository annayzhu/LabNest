'use client';
import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { chipToneCount, optionMarks, type OptionMark } from '@/lib/protocol-chips';
import { blankProtocolSystems, chipSymbols, type ProtocolSystems } from '@/lib/protocol-systems-schema';
import { systemReferences, withoutDimension, withoutOption } from '@/lib/protocol-systems-edit';
import { validateProtocolSystems } from '@/lib/structured-protocol';
import { prefixedClientId as uid } from '@/lib/client-mutation-id';
import { useModalDialog } from '@/components/ui/ModalDialogProvider';
import { SystemMark } from './SystemMark';
import { LensPresets, LensRow } from './Lens';
import { useProtocolEditor } from './ProtocolEditorContext';

type Dimension = ProtocolSystems['dimensions'][number];
type Option = Dimension['options'][number];

/** A name may be cleared while retyping; an empty name reverts on blur because names are required. */
function NameInput({ value, label, onCommit }: { value: string; label: string; onCommit: (value: string) => void }) {
  const [text, setText] = useState(value);
  return <input aria-label={label} value={text} onChange={event => { setText(event.target.value); if (event.target.value.trim()) onCommit(event.target.value.trim()); }} onBlur={() => { if (!text.trim()) setText(value); }} />;
}

/** What deleting changes, in the author's words; nothing to confirm when nothing uses it. */
function deletionNotice(name: string, references: { values: number; conditions: number }, keepsFirst: boolean) {
  const parts = [references.values ? `${references.values} 个参数按它取值，${keepsFirst ? '删除后保留第一个选项的数值' : '它的数值一并删除'}` : '', references.conditions ? `${references.conditions} 处“仅…”用到它，删除后这些内容变为通用` : ''].filter(Boolean);
  return parts.length ? `“${name}”：${parts.join('；')}。` : '';
}

function DimensionEditor({ dimension, systems, onDone }: { dimension: Dimension; systems: ProtocolSystems; onDone: () => void }) {
  const { updateSystems } = useProtocolEditor();
  const dialog = useModalDialog();
  const marks = optionMarks(systems);
  const others = (option: Option) => systems.dimensions.flatMap(d => d.options.filter(o => o !== option).map(o => marks.get(`${d.id}:${o.id}`))).filter(Boolean) as OptionMark[];
  const setOption = (option: Option, change: Partial<Option>) => updateSystems(current => ({ ...current, dimensions: current.dimensions.map(d => d.id === dimension.id ? { ...d, options: d.options.map(o => o.id === option.id ? { ...o, ...change } : o) } : d) }));
  const setDimension = (next: Dimension) => updateSystems(current => ({ ...current, dimensions: current.dimensions.map(d => d.id === next.id ? next : d) }));
  // The next symbol or colour no other option uses; past the palette, the next one in order.
  const nextSymbol = (option: Option) => { const used = new Set(others(option).map(m => m.symbol)); const start = chipSymbols.indexOf(marks.get(`${dimension.id}:${option.id}`)?.symbol ?? 'triangle'); return Array.from({ length: chipSymbols.length }, (_, step) => chipSymbols[(start + step + 1) % chipSymbols.length]).find(symbol => !used.has(symbol)) ?? chipSymbols[(start + 1) % chipSymbols.length]; };
  const nextTone = (option: Option) => { const used = new Set(others(option).map(m => m.tone)); const start = marks.get(`${dimension.id}:${option.id}`)?.tone ?? 0; return Array.from({ length: chipToneCount }, (_, step) => (start + step + 1) % chipToneCount).find(tone => !used.has(tone)) ?? (start + 1) % chipToneCount; };
  const confirmDeletion = async (notice: string, label: string) => !notice || dialog.confirm({ title: `删除${label}？`, description: notice, confirmLabel: '删除', cancelLabel: '取消', tone: 'destructive' });
  const deleteOption = async (option: Option) => {
    if (await confirmDeletion(deletionNotice(option.label, systemReferences(systems, p => p.dimensionId === dimension.id && p.optionId === option.id), false), `选项“${option.label}”`)) updateSystems(current => withoutOption(current, dimension.id, option.id));
  };
  const deleteDimension = async () => {
    if (!await confirmDeletion(deletionNotice(dimension.label, systemReferences(systems, p => p.dimensionId === dimension.id), true), `“${dimension.label}”`)) return;
    updateSystems(current => withoutDimension(current, dimension.id));
    onDone();
  };
  const noun = dimension.kind === 'condition' ? '条件' : '体系';
  return <div className="ln-systems-editor" role="group" aria-label={`编辑${dimension.label}`}>
    <label className="ln-systems-field"><span>{noun}名称</span><NameInput label={`${noun}名称`} value={dimension.label} onCommit={label => setDimension({ ...dimension, label })} /></label>
    {dimension.options.map(option => { const mark = marks.get(`${dimension.id}:${option.id}`); return <div key={option.id} className={dimension.kind === 'condition' ? 'ln-systems-option-edit is-condition' : 'ln-systems-option-edit'}>
      {dimension.kind !== 'condition' ? <>
        <button type="button" className="focus-ring ln-systems-symbol" data-tone={mark?.tone} aria-label={`更换${option.label}的符号`} title="更换符号" onClick={() => setOption(option, { symbol: nextSymbol(option) })}>{mark?.symbol ? <SystemMark mark={mark} /> : null}</button>
        <button type="button" className="focus-ring ln-systems-tone" data-tone={mark?.tone} aria-label={`更换${option.label}的颜色`} title="更换颜色" onClick={() => setOption(option, { tone: nextTone(option) })}><span aria-hidden /></button>
      </> : null}
      <NameInput label={`选项名称：${option.label}`} value={option.label} onCommit={label => setOption(option, { label })} />
      <button type="button" className="focus-ring ln-systems-icon" aria-label={`删除选项${option.label}`} disabled={dimension.options.length < 2} onClick={() => void deleteOption(option)}><X aria-hidden /></button>
    </div>; })}
    <div className="ln-systems-editor-actions">
      <button type="button" className="focus-ring" onClick={() => setDimension({ ...dimension, options: [...dimension.options, { id: uid('option'), label: dimension.kind === 'condition' ? '新选项' : String.fromCharCode(65 + dimension.options.length) }] })}><Plus aria-hidden />选项</button>
      <button type="button" className="focus-ring is-danger" onClick={() => void deleteDimension()}><Trash2 aria-hidden />删除</button>
      <button type="button" className="focus-ring is-primary" onClick={onDone}><Check aria-hidden />完成</button>
    </div>
  </div>;
}

/** Legend and lens: one row per system or condition; choosing an option quiets content for the other options while writing. */
export function SystemsBar() {
  const api = useProtocolEditor();
  const [editing, setEditing] = useState<string | null>(null);
  const systems = api.systems;
  const dimensions = systems?.dimensions ?? [];
  const marks = systems ? optionMarks(systems) : new Map<string, OptionMark>();
  const lensActive = Object.keys(api.lens).length > 0;
  const addDimension = (kind: 'system' | 'condition') => {
    const id = uid('dimension');
    api.updateSystems(current => ({ ...current, dimensions: [...current.dimensions, kind === 'condition'
      ? { id, label: '新条件', kind, options: [{ id: uid('option'), label: '是' }, { id: uid('option'), label: '否' }] }
      : { id, label: current.dimensions.some(d => d.label === '体系') ? `体系 ${current.dimensions.length + 1}` : '体系', kind, options: [{ id: uid('option'), label: 'A' }, { id: uid('option'), label: 'B' }] }] }));
    setEditing(id);
  };
  const activePreset = lensActive ? systems?.presets.find(preset => JSON.stringify(preset.selections) === JSON.stringify(api.lens)) : undefined;
  // Imported or older systems can still disagree with themselves; say so where they are edited.
  const issues = systems ? [...new Set(validateProtocolSystems(systems).map(issue => issue.message))] : [];
  const savePreset = () => systems && api.updateSystems(current => ({ ...current, presets: [...current.presets, { id: uid('preset'), label: Object.entries(api.lens).map(([d, o]) => current.dimensions.find(x => x.id === d)?.options.find(x => x.id === o)?.label).filter(Boolean).join(' · ') || '常用组合', selections: { ...api.lens } }] }));
  if (!dimensions.length) return <div className="ln-systems-bar is-empty" data-print-hidden>
    <span>不同体系用量不同时，直接写 <code>50/80 µL</code>；需要单独标注的样本条件，在步骤编号上设置“仅…”。</span>
    <button className="focus-ring" type="button" onClick={() => { if (!systems) api.updateSystems(() => blankProtocolSystems()); addDimension('system'); }}><Plus aria-hidden />体系</button>
  </div>;
  return <section className="ln-systems-bar" aria-label="体系图例与透镜">
    {dimensions.map(dimension => editing === dimension.id && systems ? <DimensionEditor key={dimension.id} dimension={dimension} systems={systems} onDone={() => setEditing(null)} />
      : <LensRow key={dimension.id} dimension={dimension} marks={marks} lens={api.lens} onChange={api.setLens} label={`透镜：${dimension.label}`} optionTitle={option => `只看${option.label}：其余淡化`}>
        <button type="button" className="focus-ring ln-systems-icon" aria-label={`编辑${dimension.label}`} title="编辑名称、选项、符号和颜色" data-print-hidden onClick={() => setEditing(dimension.id)}><Pencil aria-hidden /></button>
      </LensRow>)}
    <div className="ln-systems-footer" data-print-hidden>
      {systems ? <LensPresets systems={systems} lens={api.lens} onChange={api.setLens} /> : null}
      {lensActive && !activePreset ? <button type="button" className="focus-ring is-quiet" onClick={savePreset}><Plus aria-hidden />存为常用组合</button> : null}
      {activePreset ? <button type="button" className="focus-ring is-quiet" onClick={() => api.updateSystems(current => ({ ...current, presets: current.presets.filter(preset => preset.id !== activePreset.id) }))}><X aria-hidden />删除此组合</button> : null}
      <span className="ln-systems-spacer" />
      <button type="button" className="focus-ring is-quiet" onClick={() => addDimension('system')}><Plus aria-hidden />体系</button>
      <button type="button" className="focus-ring is-quiet" onClick={() => addDimension('condition')}><Plus aria-hidden />条件</button>
    </div>
    {issues.length ? <ul role="alert" className="ln-systems-issues">{issues.map(message => <li key={message}>{message}</li>)}</ul> : null}
  </section>;
}
