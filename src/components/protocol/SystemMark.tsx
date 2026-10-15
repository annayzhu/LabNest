import type { OptionMark } from '@/lib/protocol-chips';

const shapes: Record<string, string> = {
  triangle: 'M6 1.2 11 10.4H1z',
  square: 'M1.6 1.6h8.8v8.8H1.6z',
  circle: 'M6 1.3a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4z',
  diamond: 'M6 .9 11.1 6 6 11.1.9 6z',
  star: 'm6 .8 1.6 3.4 3.7.4-2.8 2.5.8 3.7L6 9 2.7 10.8l.8-3.7L.7 4.6l3.7-.4z',
};

/** A system option's symbol: shape plus tone, always accompanied by text where it carries meaning. */
export function SystemMark({ mark, className }: { mark: Pick<OptionMark, 'symbol' | 'tone'>; className?: string }) {
  if (!mark.symbol) return null;
  const open = mark.symbol.endsWith('-open');
  return <svg viewBox="0 0 12 12" aria-hidden className={`ln-system-mark${className ? ` ${className}` : ''}`} data-tone={mark.tone}>
    <path d={shapes[mark.symbol.replace('-open', '')]} fill={open ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={open ? 1.4 : 0.6} strokeLinejoin="round" />
  </svg>;
}

/** Marks of one value: system symbols, then named conditions as text. */
export function MarkGroup({ marks }: { marks: OptionMark[] }) {
  return <>{marks.map((mark, index) => <span key={index} className="ln-mark-group" data-tone={mark.tone}>
    {mark.any && marks[index - 1]?.any ? '/' : null}{mark.negated ? '非' : null}
    {mark.symbol ? <SystemMark mark={mark} /> : <span className="ln-mark-label">{mark.label}</span>}
  </span>)}</>;
}
