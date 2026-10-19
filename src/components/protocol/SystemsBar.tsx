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
import { systemLabelText } from '@/lib/protocol-conditions';

type Dimension = ProtocolSystems['dimensions'][number];
type Option = Dimension['options'][number];

/** A name may be cleared while retyping; an empty name reverts on blur because names are required. */
function NameInput({ value, label, onCommit }: { value: string; label: string; onCommit: (value: string) => void }) {
  const [text, setText] = useState(value);
  return <input aria-label={label} value={text} onChange={event => { setText(event.target.value); if (event.target.value.trim()) onCommit(event.target.value.trim()); }} onBlur={() => { if (!text.trim()) setText(value); }} />;
}

/** What deleting changes, in the author's words; nothing to confirm when nothing uses it. */
function deletionNotice(name: string, references: { values: number; conditions: number }, keepsFirst: boolean) {
  const parts = [references.values ? `${references.values} ${references.values === 1 ? 'parameter takes its' : 'parameters take their'} value from it, and ${keepsFirst ? 'the first option’s values are kept' : 'those values are deleted with it'}` : '', references.conditions ? `${references.conditions} applicability ${references.conditions === 1 ? 'rule uses' : 'rules use'} it, and that content becomes general` : ''].filter(Boolean);
  return parts.length ? `“${name}”: ${parts.join('; ')}.` : '';
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
  const confirmDeletion = async (notice: string, label: string) => !notice || dialog.confirm({ title: `Delete ${label}?`, description: notice, confirmLabel: 'Delete', cancelLabel: 'Cancel', tone: 'destructive' });
  const deleteOption = async (option: Option) => {
    if (await confirmDeletion(deletionNotice(option.label, systemReferences(systems, p => p.dimensionId === dimension.id && p.optionId === option.id), false), `option “${option.label}”`)) updateSystems(current => withoutOption(current, dimension.id, option.id));
  };
  const deleteDimension = async () => {
    if (!await confirmDeletion(deletionNotice(dimension.label, systemReferences(systems, p => p.dimensionId === dimension.id), true), `“${dimension.label}”`)) return;
    updateSystems(current => withoutDimension(current, dimension.id));
    onDone();
  };
  const nameLabel = dimension.kind === 'condition' ? 'Condition name' : 'System name';
  return <div className="ln-systems-editor" role="group" aria-label={`Editing ${dimension.label}`}>
    <label className="ln-systems-field"><span>{nameLabel}</span><NameInput label={nameLabel} value={dimension.label} onCommit={label => setDimension({ ...dimension, label })} /></label>
    {dimension.options.map(option => { const mark = marks.get(`${dimension.id}:${option.id}`); return <div key={option.id} className={dimension.kind === 'condition' ? 'ln-systems-option-edit is-condition' : 'ln-systems-option-edit'}>
      {dimension.kind !== 'condition' ? <>
        <button type="button" className="focus-ring ln-systems-symbol" data-tone={mark?.tone} aria-label={`Change the symbol of ${option.label}`} title="Change symbol" onClick={() => setOption(option, { symbol: nextSymbol(option) })}>{mark?.symbol ? <SystemMark mark={mark} /> : null}</button>
        <button type="button" className="focus-ring ln-systems-tone" data-tone={mark?.tone} aria-label={`Change the color of ${option.label}`} title="Change color" onClick={() => setOption(option, { tone: nextTone(option) })}><span aria-hidden /></button>
      </> : null}
      <NameInput label={`Option name: ${option.label}`} value={option.label} onCommit={label => setOption(option, { label })} />
      <button type="button" className="focus-ring ln-systems-icon" aria-label={`Delete option ${option.label}`} disabled={dimension.options.length < 2} onClick={() => void deleteOption(option)}><X aria-hidden /></button>
    </div>; })}
    <div className="ln-systems-editor-actions">
      <button type="button" className="focus-ring" onClick={() => setDimension({ ...dimension, options: [...dimension.options, { id: uid('option'), label: dimension.kind === 'condition' ? '新选项' : String.fromCharCode(65 + dimension.options.length) }] })}><Plus aria-hidden />Option</button>
      <button type="button" className="focus-ring is-danger" onClick={() => void deleteDimension()}><Trash2 aria-hidden />Delete</button>
      <button type="button" className="focus-ring is-primary" onClick={onDone}><Check aria-hidden />Done</button>
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
    <span>When systems use different amounts, write <code>50/80 µL</code>; set sample conditions that need their own label in “Applies to…” from ⋮⋮ beside a step or paragraph.</span>
    <button className="focus-ring" type="button" onClick={() => { if (!systems) api.updateSystems(() => blankProtocolSystems()); addDimension('system'); }}><Plus aria-hidden />System</button>
  </div>;
  return <section className="ln-systems-bar" aria-label="System legend and lens">
    {dimensions.map(dimension => editing === dimension.id && systems ? <DimensionEditor key={dimension.id} dimension={dimension} systems={systems} onDone={() => setEditing(null)} />
      : <LensRow key={dimension.id} dimension={dimension} marks={marks} lens={api.lens} onChange={api.setLens} label={`Lens by ${systemLabelText(dimension.label)}`} optionTitle={option => `Only ${systemLabelText(option.label)}: fade the rest`}>
        <button type="button" className="focus-ring ln-systems-icon" aria-label={`Open ${dimension.label} for editing`} title="Edit the name, options, symbols and colors" data-print-hidden onClick={() => setEditing(dimension.id)}><Pencil aria-hidden /></button>
      </LensRow>)}
    <div className="ln-systems-footer" data-print-hidden>
      {systems ? <LensPresets systems={systems} lens={api.lens} onChange={api.setLens} /> : null}
      {lensActive && !activePreset ? <button type="button" className="focus-ring is-quiet" onClick={savePreset}><Plus aria-hidden />Save as a preset</button> : null}
      {activePreset ? <button type="button" className="focus-ring is-quiet" onClick={() => api.updateSystems(current => ({ ...current, presets: current.presets.filter(preset => preset.id !== activePreset.id) }))}><X aria-hidden />Delete this preset</button> : null}
      <span className="ln-systems-spacer" />
      <button type="button" className="focus-ring is-quiet" onClick={() => addDimension('system')}><Plus aria-hidden />System</button>
      <button type="button" className="focus-ring is-quiet" onClick={() => addDimension('condition')}><Plus aria-hidden />Condition</button>
    </div>
    {issues.length ? <ul role="alert" className="ln-systems-issues">{issues.map(message => <li key={message}>{message}</li>)}</ul> : null}
  </section>;
}
