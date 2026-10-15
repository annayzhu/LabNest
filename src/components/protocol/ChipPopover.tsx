'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X } from 'lucide-react';
import { compatibleUnits, normalizeUnit, parseScalar, units } from '@/lib/calculators/quantities';
import { chipAmount, chipKindForUnit, chipKindLabels, optionMarks, parameterDisplayName, splitLookupSource, toolSpecs, type OptionMark } from '@/lib/protocol-chips';
import { computedTogether, protocolCalculations, siblingResult, type CalculationInput } from '@/lib/protocol-calculations';
import { previewProtocolCalculation, resolveProtocolSystem } from '@/lib/structured-protocol';
import type { ProtocolSystems } from '@/lib/protocol-systems-schema';
import { prefixedClientId as uid } from '@/lib/client-mutation-id';
import { SystemMark } from './SystemMark';
import { useAnchoredPosition, useDismiss } from './popover';
import { useProtocolEditor, type ChipTarget } from './ProtocolEditorContext';

type Parameter = ProtocolSystems['parameters'][number];
type Dimension = ProtocolSystems['dimensions'][number];
type LookupValue = Extract<Parameter['source'], { kind: 'lookup' }>['values'][number];
/** A number field that keeps the author's partial typing ("1.", "-") until it is a complete value. */
function NumberField({ value, onChange, label, autoFocus }: { value: number | null; onChange: (value: number | null) => void; label: string; autoFocus?: boolean }) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const [invalid, setInvalid] = useState(false);
  // Follow a value changed elsewhere (another field, undo) unless the typed text already means it.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    let same = false;
    try { same = parseScalar(text.replace(/,/g, '')) === value; } catch { same = false; }
    if (!same) setText(value === null ? '' : String(value));
  }
  return <span className="ln-chip-number-field">
    <input aria-label={label} className="ln-chip-input is-number" inputMode="decimal" autoFocus={autoFocus} value={text} aria-invalid={invalid || undefined} placeholder="—"
      onChange={event => { const next = event.target.value; setText(next); if (!next.trim()) { setInvalid(false); onChange(null); return; } try { onChange(parseScalar(next.replace(/,/g, ''))); setInvalid(false); } catch { setInvalid(true); } }} />
    {invalid ? <small role="alert" className="ln-chip-error">不是数字，未采用</small> : null}
  </span>;
}

/** Unit with suggestions from the same dimension; any registered unit can be typed. */
function UnitField({ unit, onChange, choices }: { unit: string; onChange: (unit: string) => void; choices?: string[] }) {
  const [text, setText] = useState(unit);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(unit);
  if (seen !== unit) { setSeen(unit); setText(unit); }
  const suggestions = useMemo(() => {
    const query = text.trim().toLowerCase();
    const same = choices ?? compatibleUnits(unit);
    const pool = query && !same.some(u => u.toLowerCase() === query) ? Object.keys(units).filter(u => u.toLowerCase().startsWith(query)) : same;
    return [...new Set(pool)].slice(0, 8);
  }, [text, unit, choices]);
  const known = Boolean(units[normalizeUnit(text.trim())]);
  return <span className="ln-chip-unit-field">
    <input aria-label="单位" className="ln-chip-input is-unit" value={text} aria-invalid={!known || undefined} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
      onChange={event => { setText(event.target.value); const normalized = normalizeUnit(event.target.value.trim()); if (units[normalized]) onChange(normalized); }} />
    {open && suggestions.length ? <span className="ln-chip-suggestions" role="listbox" aria-label="单位建议">{suggestions.map(choice => <button key={choice} type="button" role="option" className="focus-ring" aria-selected={choice === unit} onMouseDown={event => event.preventDefault()} onClick={() => { setText(choice); onChange(choice); setOpen(false); }}>{choice}</button>)}</span> : null}
    {!known ? <small role="alert" className="ln-chip-error">未识别的单位，仍按 {unit}</small> : null}
  </span>;
}

function OptionLabel({ mark, dimension, option }: { mark?: OptionMark; dimension: Dimension; option: Dimension['options'][number] }) {
  return <span className="ln-chip-option" data-tone={mark?.tone}>{mark?.symbol ? <SystemMark mark={mark} /> : null}<span>{dimension.kind === 'condition' ? `${dimension.label}：${option.label}` : option.label}</span></span>;
}

/** How a lookup is laid out for editing: one dimension (rows) or two (grid). */
function lookupShape(values: LookupValue[]): string[] | undefined {
  const dims = values.map(v => (v.when.all ?? []).map(p => p.dimensionId));
  if (!values.length || values.some(v => v.when.any?.length || v.when.not?.length)) return values.length ? undefined : [];
  const first = dims[0];
  return dims.every(d => d.length === first.length && d.every((id, i) => id === first[i])) && first.length <= 2 ? first : undefined;
}

/** A calculation chip: the result it shows, where each input comes from (written here, measured in the Run, or another chip), and its other results. */
function CalculationEditor({ parameter, systems, onChange, onInsert }: { parameter: Parameter; systems: ProtocolSystems; onChange: (next: Parameter) => void; onInsert: (parameterId: string) => void }) {
  const { updateSystems } = useProtocolEditor();
  if (parameter.source.kind !== 'calculator') return null;
  const source = parameter.source;
  const spec = protocolCalculations[source.calculatorId];
  const dimension = (unit: string) => units[normalizeUnit(unit)]?.dimension;
  const setInputs = (inputs: Record<string, string>, added?: Parameter) => updateSystems(current => ({ ...current, parameters: [...current.parameters.map(p => computedTogether(p, parameter) ? { ...p, source: { ...p.source, inputs } } : p), ...(added ? [added] : [])] }));
  const setInput = (next: Parameter) => updateSystems(current => ({ ...current, parameters: current.parameters.map(p => p.id === next.id ? next : p) }));
  const ownInput = (input: CalculationInput, p?: Parameter) => Boolean(p && p.origin === 'chip' && p.label === input.label && p.source.kind !== 'calculator');
  const chooseSource = (input: CalculationInput, value: string) => {
    const current = systems.parameters.find(p => p.id === source.inputs[input.key]);
    if (value !== 'here' && value !== 'actual') { setInputs({ ...source.inputs, [input.key]: value }); return; }
    const kind: Parameter['source'] = value === 'actual' ? { kind: 'actual' } : { kind: 'fixed', value: null, unit: current && ownInput(input, current) ? current.unit : input.unit };
    if (current && ownInput(input, current)) setInput({ ...current, source: kind });
    else { const added: Parameter = { id: uid('p'), label: input.label, unit: input.unit, origin: 'chip', source: kind }; setInputs({ ...source.inputs, [input.key]: added.id }, added); }
  };
  const output = spec.outputs.find(item => item.key === source.output);
  const showOutput = (key: string) => {
    const next = spec.outputs.find(item => item.key === key)!;
    onChange({ ...parameter, label: parameter.label === output?.label ? next.label : parameter.label, unit: dimension(parameter.unit) === dimension(next.unit) ? parameter.unit : next.unit, source: { ...source, output: key } });
  };
  // What the author sees while writing: what is still to fill here, what waits for the Run, or the result for these inputs.
  const required = spec.inputs.filter(input => !input.optional).map(input => ({ input, chip: systems.parameters.find(p => p.id === source.inputs[input.key]) }));
  const unfilled = required.filter(({ chip }) => !chip || (chip.source.kind === 'fixed' && chip.source.value === null)).map(({ input }) => input.label);
  const later = required.some(({ chip }) => chip && chip.source.kind !== 'fixed');
  let estimate: string;
  if (unfilled.length) estimate = `填写${unfilled.join('、')}后显示预计结果。`;
  else if (later) estimate = '有输入在执行时填写或确认：届时计算，确认后采用。';
  else try {
    const preview = previewProtocolCalculation(parameter, resolveProtocolSystem(systems, {}).parameters);
    estimate = `按当前输入约 ${chipAmount(preview.value, preview.unit, true)}，执行时确认后采用。`;
  } catch (error) { estimate = error instanceof Error ? error.message : '计算失败'; }
  return <div className="ln-chip-lookup">
    {spec.outputs.length > 1 ? <div className="ln-chip-modes" role="radiogroup" aria-label="这个参数块显示">{spec.outputs.map(item => <button key={item.key} type="button" role="radio" className="focus-ring" aria-checked={source.output === item.key} onClick={() => showOutput(item.key)}>{item.label}</button>)}</div> : null}
    {spec.inputs.map(input => {
      const current = systems.parameters.find(p => p.id === source.inputs[input.key]);
      const own = ownInput(input, current);
      const mode = !current ? 'here' : own ? current.source.kind === 'actual' ? 'actual' : 'here' : current.id;
      // Another chip of the same kind can supply this input; the calculation's own inputs and results cannot.
      const others = systems.parameters.filter(p => p.id !== parameter.id && !p.ownerToolId && !computedTogether(p, parameter) && (p.id === current?.id ? !own : !Object.values(source.inputs).includes(p.id)) && dimension(p.unit) === dimension(input.unit));
      return <div key={input.key} className="ln-chip-row is-calc">
        <span className="ln-chip-field-label">{input.label}{input.optional ? '（可选）' : ''}</span>
        {mode === 'here' && current?.source.kind === 'fixed' ? <NumberField label={input.label} value={current.source.value} onChange={value => setInput({ ...current, source: { ...current.source as Extract<Parameter['source'], { kind: 'fixed' }>, value } })} />
          : <span className="ln-chip-note">{mode === 'actual' ? '执行时填写' : current ? parameterDisplayName(current) : '—'}</span>}
        {own && current ? <UnitField unit={current.unit} choices={compatibleUnits(input.unit)} onChange={unit => setInput({ ...current, unit, source: current.source.kind === 'fixed' ? { ...current.source, unit } : current.source })} /> : <span />}
        <select aria-label={`${input.label}来源`} className="ln-chip-input" value={mode} onChange={event => chooseSource(input, event.target.value)}>
          <option value="here">在此填写</option><option value="actual">执行时填写</option>
          {others.map(p => <option key={p.id} value={p.id}>{parameterDisplayName(p)}</option>)}
        </select>
      </div>;
    })}
    {spec.outputs.length > 1 ? <span className="ln-chip-more">也写入正文：{spec.outputs.filter(item => item.key !== source.output).map(item => <button key={item.key} type="button" className="focus-ring ln-chip-link" onClick={() => {
      const sibling = siblingResult(parameter, item.key, systems.parameters, uid);
      if (sibling.created) updateSystems(current => ({ ...current, parameters: [...current.parameters, sibling.parameter] }));
      onInsert(sibling.parameter.id);
    }}><Plus aria-hidden />{item.label}</button>)}</span> : null}
    <p className="ln-chip-note">{estimate}</p>
    <p className="ln-chip-note">{spec.note}</p>
  </div>;
}

function ValueEditor({ parameter, systems, onChange, autoFocus }: { parameter: Parameter; systems: ProtocolSystems; onChange: (next: Parameter) => void; autoFocus?: boolean }) {
  const marks = optionMarks(systems);
  const { source } = parameter;
  const setUnit = (unit: string) => onChange({ ...parameter, unit, source: source.kind === 'fixed' ? { ...source, unit } : source.kind === 'lookup' ? { ...source, values: source.values.map(v => ({ ...v, unit })) } : source });
  if (source.kind === 'fixed') return <div className="ln-chip-row"><NumberField label="数值" value={source.value} autoFocus={autoFocus} onChange={value => onChange({ ...parameter, source: { ...source, value } })} /><UnitField unit={parameter.unit} onChange={setUnit} /></div>;
  if (source.kind === 'actual') return <div className="ln-chip-row"><span className="ln-chip-note">执行时在实验中记录实际值</span><UnitField unit={parameter.unit} onChange={setUnit} /></div>;
  if (source.kind === 'calculator') return null; // Calculation chips have their own editor.
  const shape = lookupShape(source.values);
  if (!shape) return <p className="ln-chip-note">此参数按组合条件取值，这里不能逐项修改；可在上方改为固定值或按单个体系取值。</p>;
  const cell = (when: Array<{ dimensionId: string; optionId: string }>) => source.values.find(v => when.every(p => v.when.all?.some(q => q.dimensionId === p.dimensionId && q.optionId === p.optionId)));
  const setCell = (when: Array<{ dimensionId: string; optionId: string }>, value: number | null) => {
    const existing = cell(when);
    onChange({ ...parameter, source: { ...source, values: existing ? source.values.map(v => v === existing ? { ...v, value } : v) : [...source.values, { id: uid('value'), when: { all: when }, value, unit: parameter.unit }] } });
  };
  const [rowsDimension, columnsDimension] = shape.map(id => systems.dimensions.find(d => d.id === id));
  if (!rowsDimension) return null;
  const otherDimensions = systems.dimensions.filter(d => !shape.includes(d.id));
  const addColumns = (dimension: Dimension) => onChange({ ...parameter, source: { kind: 'lookup', values: rowsDimension.options.flatMap(row => dimension.options.map((column, index) => ({ id: uid('value'), when: { all: [{ dimensionId: rowsDimension.id, optionId: row.id }, { dimensionId: dimension.id, optionId: column.id }] }, value: index === 0 ? cell([{ dimensionId: rowsDimension.id, optionId: row.id }])?.value ?? null : null, unit: parameter.unit }))) } });
  return <div className="ln-chip-lookup">
    {columnsDimension ? <table className="ln-chip-grid"><thead><tr><th scope="col"><span className="sr-only">{rowsDimension.label}</span></th>{columnsDimension.options.map(column => <th key={column.id} scope="col"><OptionLabel mark={marks.get(`${columnsDimension.id}:${column.id}`)} dimension={columnsDimension} option={column} /></th>)}</tr></thead>
      <tbody>{rowsDimension.options.map((row, rowIndex) => <tr key={row.id}><th scope="row"><OptionLabel mark={marks.get(`${rowsDimension.id}:${row.id}`)} dimension={rowsDimension} option={row} /></th>{columnsDimension.options.map((column, columnIndex) => { const when = [{ dimensionId: rowsDimension.id, optionId: row.id }, { dimensionId: columnsDimension.id, optionId: column.id }]; return <td key={column.id}><NumberField label={`${row.label} · ${column.label}`} value={cell(when)?.value ?? null} autoFocus={autoFocus && rowIndex === 0 && columnIndex === 0} onChange={value => setCell(when, value)} /></td>; })}</tr>)}</tbody></table>
      : rowsDimension.options.map((row, index) => { const when = [{ dimensionId: rowsDimension.id, optionId: row.id }]; return <label key={row.id} className="ln-chip-row is-option"><OptionLabel mark={marks.get(`${rowsDimension.id}:${row.id}`)} dimension={rowsDimension} option={row} /><NumberField label={row.label} value={cell(when)?.value ?? null} autoFocus={autoFocus && index === 0} onChange={value => setCell(when, value)} /></label>; })}
    <div className="ln-chip-row"><span className="ln-chip-note">单位</span><UnitField unit={parameter.unit} onChange={setUnit} />
      {!columnsDimension && otherDimensions.length ? <span className="ln-chip-more">再按{otherDimensions.map(d => <button key={d.id} type="button" className="focus-ring ln-chip-link" onClick={() => addColumns(d)}>{d.label}</button>)}区分</span> : null}
      {columnsDimension ? <button type="button" className="focus-ring ln-chip-link" onClick={() => onChange({ ...parameter, source: { kind: 'lookup', values: rowsDimension.options.map(row => ({ id: uid('value'), when: { all: [{ dimensionId: rowsDimension.id, optionId: row.id }] }, value: cell([{ dimensionId: rowsDimension.id, optionId: row.id }, { dimensionId: columnsDimension.id, optionId: columnsDimension.options[0].id }])?.value ?? null, unit: parameter.unit })) } })}>只按{rowsDimension.label}区分</button> : null}
    </div>
  </div>;
}

function SourceChoice({ parameter, systems, onChange }: { parameter: Parameter; systems: ProtocolSystems; onChange: (next: Parameter) => void }) {
  const kind = parameter.source.kind;
  const first = (dimension: Dimension) => splitLookupSource(parameter.source.kind === 'fixed' && parameter.source.value !== null ? [parameter.source.value] : [], parameter.unit, dimension, () => uid('value'));
  return <div className="ln-chip-modes" role="radiogroup" aria-label="取值方式">
    <button className="focus-ring" type="button" role="radio" aria-checked={kind === 'fixed'} onClick={() => onChange({ ...parameter, source: { kind: 'fixed', value: parameter.source.kind === 'lookup' ? parameter.source.values[0]?.value ?? null : null, unit: parameter.unit } })}>固定值</button>
    {systems.dimensions.map(dimension => <button className="focus-ring" key={dimension.id} type="button" role="radio" aria-checked={kind === 'lookup' && parameter.source.kind === 'lookup' && lookupShape(parameter.source.values)?.[0] === dimension.id} onClick={() => onChange({ ...parameter, source: first(dimension) })}>按{dimension.label}</button>)}
    <button className="focus-ring" type="button" role="radio" aria-checked={kind === 'actual'} onClick={() => onChange({ ...parameter, source: { kind: 'actual' } })}>执行时填写</button>
  </div>;
}

function NameField({ parameter, onChange }: { parameter: Parameter; onChange: (next: Parameter) => void }) {
  const { materials } = useProtocolEditor();
  const [open, setOpen] = useState(false);
  const query = parameter.label.trim().toLowerCase();
  const matches = materials.filter(m => !query || m.name.toLowerCase().includes(query)).slice(0, 6);
  return <span className="ln-chip-name">
    <input aria-label="名称（可选）" placeholder={parameter.materialRef?.name ?? '名称（可选），如 Proteinase K'} className="ln-chip-input is-name" value={parameter.label}
      onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
      onChange={event => { const label = event.target.value; const material = materials.find(m => m.name === label.trim()); onChange({ ...parameter, label, ...(material ? { materialRef: { name: material.name, ...(material.rowId ? { rowId: material.rowId } : {}) } } : { materialRef: undefined }) }); }} />
    {parameter.materialRef ? <small className="ln-chip-hint">已关联材料表</small> : null}
    {open && matches.length ? <span className="ln-chip-suggestions is-names" role="listbox" aria-label="材料表">{matches.map(material => <button className="focus-ring" key={`${material.name}:${material.rowId}`} type="button" role="option" aria-selected={parameter.materialRef?.name === material.name} onMouseDown={event => event.preventDefault()} onClick={() => { onChange({ ...parameter, label: material.name, materialRef: { name: material.name, ...(material.rowId ? { rowId: material.rowId } : {}) } }); setOpen(false); }}>{material.name}</button>)}</span> : null}
  </span>;
}

const mixMethods = ['涡旋混匀', '颠倒混匀', '吹打混匀', '轻弹混匀'];

function ToolEditor({ toolId, systems, update }: { toolId: string; systems: ProtocolSystems; update: (fn: (s: ProtocolSystems) => ProtocolSystems) => void }) {
  const tool = systems.tools?.find(t => t.id === toolId);
  if (!tool) return null;
  const spec = toolSpecs[tool.kind];
  const parameterFor = (key: string) => systems.parameters.find(p => p.id === tool.fields.find(f => f.key === key)?.parameterId);
  const setParameter = (next: Parameter) => update(s => ({ ...s, parameters: s.parameters.map(p => p.id === next.id ? next : p) }));
  const addField = (key: string, unit: string) => { const id = uid('p'); update(s => ({ ...s, parameters: [...s.parameters, { id, label: '', unit, ownerToolId: tool.id, source: { kind: 'fixed', value: null, unit } }], tools: (s.tools ?? []).map(t => t.id === tool.id ? { ...t, fields: [...t.fields, { key, parameterId: id }] } : t) })); };
  const removeField = (key: string) => update(s => ({ ...s, tools: (s.tools ?? []).map(t => t.id === tool.id ? { ...t, fields: t.fields.filter(f => f.key !== key) } : t) }));
  return <div className="ln-chip-tool">
    {tool.kind === 'mix' ? <div className="ln-chip-modes" role="radiogroup" aria-label="混匀方式">{mixMethods.map(method => <button className="focus-ring" key={method} type="button" role="radio" aria-checked={(tool.method ?? '') === method} onClick={() => update(s => ({ ...s, tools: (s.tools ?? []).map(t => t.id === tool.id ? { ...t, method } : t) }))}>{method.replace('混匀', '')}</button>)}</div> : null}
    {spec.fields.map((field, index) => { const parameter = parameterFor(field.key); return parameter ? <div key={field.key} className="ln-chip-row is-field"><span className="ln-chip-field-label">{field.label}</span>
      {parameter.source.kind === 'fixed' ? <NumberField label={field.label} value={parameter.source.value} autoFocus={index === 0} onChange={value => setParameter({ ...parameter, source: { ...parameter.source as Extract<Parameter['source'], { kind: 'fixed' }>, value } })} /> : <span className="ln-chip-note">按体系取值</span>}
      <UnitField unit={parameter.unit} choices={field.units} onChange={unit => setParameter({ ...parameter, unit, source: parameter.source.kind === 'fixed' ? { ...parameter.source, unit } : parameter.source })} />
      {field.optional ? <button type="button" className="focus-ring ln-chip-icon-button" aria-label={`移除${field.label}`} onClick={() => removeField(field.key)}><X aria-hidden /></button> : null}
    </div> : field.optional ? <button key={field.key} type="button" className="focus-ring ln-chip-link is-add" onClick={() => addField(field.key, field.units[0])}>＋ {field.label}</button> : null; })}
    {tool.kind === 'dark' ? <p className="ln-chip-note">提醒操作时避光，没有数值。</p> : null}
  </div>;
}

export type ChipPopoverProps = { target: ChipTarget; onDelete: () => void; onClose: () => void };

/** Edit a chip in place: value, unit, name, by-system values or tool settings. Changes apply as you type. */
export function ChipPopover({ target, onDelete, onClose }: ChipPopoverProps) {
  const api = useProtocolEditor();
  const panel = useRef<HTMLDivElement>(null);
  const insertAfter = useRef<number | null>(null);
  const style = useAnchoredPosition(target.anchor, panel, [api.systems]);
  useDismiss(panel, target.anchor, onClose);
  // Inserting a chip settles the editor's selection, which can pull focus back into the text for a moment.
  // Keep the value field focused while that settles, unless the author has moved within the panel.
  useEffect(() => {
    if (target.focus !== 'value') return;
    let checks = 0;
    const timer = window.setInterval(() => {
      const field = panel.current?.querySelector<HTMLInputElement>('input.is-number'), active = document.activeElement;
      if (field && (!active || active === document.body || active.closest('.ProseMirror'))) field.focus({ preventScroll: true });
      if (++checks >= 6) window.clearInterval(timer);
    }, 50);
    return () => window.clearInterval(timer);
  }, [target.focus]);
  const systems = api.systems;
  if (!systems) return null;
  const tool = systems.tools?.find(t => t.id === target.id);
  const parameter = systems.parameters.find(p => p.id === target.id);
  const setParameter = (next: Parameter) => api.updateSystems(s => ({ ...s, parameters: s.parameters.map(p => p.id === next.id ? next : p) }));
  const kindLabel = tool ? toolSpecs[tool.kind].label : parameter?.source.kind === 'calculator' ? protocolCalculations[parameter.source.calculatorId].label : parameter ? chipKindLabels[parameter.kind ?? chipKindForUnit(parameter.unit)] : '参数';
  let body: ReactNode;
  if (tool) body = <ToolEditor toolId={tool.id} systems={systems} update={api.updateSystems} />;
  // Results added one after another keep the order they were chosen in.
  else if (parameter?.source.kind === 'calculator') body = <CalculationEditor parameter={parameter} systems={systems} onChange={setParameter} onInsert={id => { insertAfter.current = api.insertChipAfter(insertAfter.current ?? target.pos, id) ?? insertAfter.current; }} />;
  else if (parameter) body = <>
    <SourceChoice parameter={parameter} systems={systems} onChange={setParameter} />
    <ValueEditor parameter={parameter} systems={systems} onChange={setParameter} autoFocus={target.focus === 'value'} />
  </>;
  else body = <p className="ln-chip-note">这个参数已被删除。</p>;
  // At the bench: whether the actual value must be recorded, and how a material amount counts toward consumption.
  const fieldParameters = tool ? systems.parameters.filter(p => tool.fields.some(f => f.parameterId === p.id)) : parameter && parameter.source.kind !== 'actual' ? [parameter] : [];
  const required = fieldParameters.length > 0 && fieldParameters.every(p => p.actual === 'required');
  const setRequired = (on: boolean) => api.updateSystems(s => ({ ...s, parameters: s.parameters.map(p => fieldParameters.some(f => f.id === p.id) ? { ...p, actual: on ? 'required' as const : undefined } : p) }));
  const amount = parameter?.materialRef && ['volume', 'mass', 'amount'].includes(parameter.kind ?? chipKindForUnit(parameter.unit));
  const execution = fieldParameters.length || amount ? <div className="ln-chip-execution">
    {amount ? <div className="ln-chip-modes" role="radiogroup" aria-label="消耗按"><span className="ln-chip-note">消耗按</span>
      <button className="focus-ring" type="button" role="radio" aria-checked={!parameter!.perRun} onClick={() => setParameter({ ...parameter!, perRun: undefined })}>每反应</button>
      <button className="focus-ring" type="button" role="radio" aria-checked={Boolean(parameter!.perRun)} onClick={() => setParameter({ ...parameter!, perRun: true })}>本次总量</button></div> : null}
    {fieldParameters.length ? <label className="ln-chip-check"><input type="checkbox" checked={required} onChange={event => setRequired(event.target.checked)} />执行时必填实际值</label> : null}
  </div> : null;
  return createPortal(<div ref={panel} className={parameter?.source.kind === 'calculator' ? 'ln-chip-popover is-wide' : 'ln-chip-popover'} style={style} role="dialog" aria-label={`编辑${kindLabel}`} onMouseDown={event => event.stopPropagation()}>
    <header className="ln-chip-popover-header"><strong>{kindLabel}</strong>{parameter && !tool ? <NameField parameter={parameter} onChange={setParameter} /> : null}<button type="button" className="focus-ring ln-chip-icon-button" aria-label="完成" onClick={onClose}><X aria-hidden /></button></header>
    <div className="ln-chip-popover-body">{body}{execution}</div>
    <footer className="ln-chip-popover-footer"><button type="button" className="focus-ring ln-chip-link is-danger" onClick={onDelete}><Trash2 aria-hidden />删除参数块</button><button type="button" className="focus-ring ln-chip-done" onClick={onClose}>完成</button></footer>
  </div>, document.body);
}
