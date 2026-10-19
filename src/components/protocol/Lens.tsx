'use client';
import type { ReactNode } from 'react';
import type { OptionMark } from '@/lib/protocol-chips';
import { systemLabelText } from '@/lib/protocol-conditions';
import type { ProtocolSystems } from '@/lib/protocol-systems-schema';
import type { ProtocolSelection } from '@/lib/structured-protocol';
import { SystemMark } from './SystemMark';

type Dimension = ProtocolSystems['dimensions'][number];

/** Choosing an option again clears that dimension; other dimensions keep their choice. */
export function toggleLens(lens: ProtocolSelection, dimensionId: string, optionId: string): ProtocolSelection {
  const next = { ...lens };
  if (next[dimensionId] === optionId) delete next[dimensionId]; else next[dimensionId] = optionId;
  return next;
}

/** One legend row: the dimension's name, then its options as lens buttons with symbol, colour and text. */
export function LensRow({ dimension, marks, lens, onChange, label, optionTitle, children }: { dimension: Dimension; marks: Map<string, OptionMark>; lens: ProtocolSelection; onChange: (lens: ProtocolSelection) => void; label: string; optionTitle: (option: Dimension['options'][number]) => string; children?: ReactNode }) {
  return <div className="ln-systems-row">
    <span className="ln-systems-dimension">{systemLabelText(dimension.label)}</span>
    <span className="ln-systems-options" role="group" aria-label={label}>{dimension.options.map(option => { const mark = marks.get(`${dimension.id}:${option.id}`); return <button key={option.id} type="button" className="focus-ring" aria-pressed={lens[dimension.id] === option.id} data-tone={mark?.tone} title={optionTitle(option)}
      onClick={() => onChange(toggleLens(lens, dimension.id, option.id))}>{mark?.symbol ? <SystemMark mark={mark} /> : null}<span>{systemLabelText(option.label)}</span></button>; })}</span>
    {children}
  </div>;
}

/** "All systems" and the saved combinations. */
export function LensPresets({ systems, lens, onChange }: { systems: Pick<ProtocolSystems, 'presets'>; lens: ProtocolSelection; onChange: (lens: ProtocolSelection) => void }) {
  const active = Object.keys(lens).length > 0;
  return <>
    <button type="button" className="focus-ring" aria-pressed={!active} onClick={() => onChange({})}>All systems</button>
    {systems.presets.map(preset => <button key={preset.id} type="button" className="focus-ring" aria-pressed={active && JSON.stringify(preset.selections) === JSON.stringify(lens)} onClick={() => onChange({ ...preset.selections })}>{preset.label}</button>)}
  </>;
}
