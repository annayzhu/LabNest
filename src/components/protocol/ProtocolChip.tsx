import { Calculator, Clock, FlaskConical, Gauge, Hash, MoonStar, Percent, Pipette, Repeat, RotateCw, Shuffle, TestTube, Thermometer, TrendingUp, Vibrate, Weight, Wind, Zap, type LucideIcon } from 'lucide-react';
import { chipViewText, unitPlacement, type ChipKind, type ChipView, type OptionMark, type ToolKind } from '@/lib/protocol-chips';
import type { ProtocolSelection } from '@/lib/structured-protocol';
import { MarkGroup } from './SystemMark';

const kindIcons: Record<ChipKind, LucideIcon> = {
  volume: Pipette, mass: Weight, amount: FlaskConical, concentration: FlaskConical, time: Clock, temperature: Thermometer, rcf: RotateCw, speed: RotateCw,
  ph: TestTube, voltage: Zap, current: Zap, pressure: Gauge, electrical: Zap, count: Repeat, percent: Percent, other: Hash,
};
const toolIcons: Record<ToolKind, LucideIcon> = { centrifuge: RotateCw, mix: Shuffle, incubate: Thermometer, shake: Vibrate, vacuum: Gauge, electrophoresis: Zap, electroporation: Zap, gas: Wind, dark: MoonStar, gradient: TrendingUp };

/** Under a lens, values for other options are quieted rather than hidden while writing. */
function lensMatches(marks: OptionMark[], lens: ProtocolSelection | undefined) {
  return !lens || marks.every(mark => { const [dimension, option] = mark.key.split(':'); const chosen = lens[dimension]; return !chosen || (mark.negated ? chosen !== option : chosen === option); });
}

function Values({ view, lens }: { view: Extract<ChipView, { type: 'value' }>; lens?: ProtocolSelection }) {
  const values = view.values.map((value, index) => <span key={index} className="ln-chip-value" data-dimmed={lensMatches(value.marks, lens) ? undefined : ''}>
    {index ? <span className="ln-chip-sep" aria-hidden>/</span> : null}<MarkGroup marks={value.marks} /><span className="ln-chip-number">{value.text}</span>
  </span>);
  const placement = unitPlacement(view.unit);
  return placement === 'before' ? <><span className="ln-chip-unit">{view.unit}</span>{values}</> : <>{values}<span className={placement === 'joined' ? 'ln-chip-unit is-tight' : 'ln-chip-unit'}>{view.unit}</span></>;
}

/** The reading form of a chip: compact value and unit with an icon for what it measures. */
export function ProtocolChip({ view, lens, calculated = false }: { view: ChipView; lens?: ProtocolSelection; calculated?: boolean }) {
  const label = chipViewText(view);
  if (view.type === 'missing') return <span className="ln-chip" data-state="missing" title="引用的参数已删除">参数已删除</span>;
  if (view.type === 'pending') {
    const Icon = calculated ? Calculator : kindIcons[view.kind];
    return <span className="ln-chip" data-state="pending" title={label}><Icon aria-hidden className="ln-chip-icon" /><span>{view.name}</span><span className="ln-chip-reason">{view.reason}</span></span>;
  }
  if (view.type === 'tool') {
    const Icon = toolIcons[view.tool];
    return <span className="ln-chip" data-state="tool" data-tool={view.tool} title={label}><Icon aria-hidden className="ln-chip-icon" /><span className="ln-chip-tool-label">{view.label}</span>
      {view.fields.map(field => <span key={field.key} className="ln-chip-field" title={field.label}>{field.view.type === 'value' ? <Values view={field.view} lens={lens} /> : field.view.type === 'pending' ? <><span className="ln-chip-blank" aria-label={`${field.label}${field.view.reason}`}>—</span><span className="ln-chip-unit">{field.view.displayUnit}</span></> : <span className="ln-chip-reason">{chipViewText(field.view)}</span>}{view.tool === 'gas' ? <span className="ln-chip-unit">{field.label}</span> : null}</span>)}
    </span>;
  }
  const Icon = calculated ? Calculator : kindIcons[view.kind];
  return <span className="ln-chip" data-state={view.values.length > 1 ? 'split' : 'value'} data-kind={view.kind} title={view.name ? `${view.name} · ${label}` : label}>
    <Icon aria-hidden className="ln-chip-icon" /><Values view={view} lens={lens} />
  </span>;
}

