'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { optionMarks } from '@/lib/protocol-chips';
import type { ProtocolSystems } from '@/lib/protocol-systems-schema';
import { SystemMark } from './SystemMark';
import { useAnchoredPosition, useDismiss } from './popover';

/** Slash-separated values waiting for the author to say which system they follow; `from` is where the text starts. */
export type SplitPromptState = { from: number; source: string; values: number[]; unit: string; anchor: { top: number; left: number; bottom: number } };
export type SplitChoice = { dimensionId: string; remember: boolean } | { create: true };

/**
 * "50/80 µL" when several systems have that many options, or none does: asked beside the text, never guessed.
 * Choosing makes the chip; Esc or a press elsewhere keeps what was typed. Tab moves here from the text.
 */
export function SplitPrompt({ prompt, systems, keyRef, onChoose, onClose }: { prompt: SplitPromptState; systems: ProtocolSystems | undefined; keyRef: React.MutableRefObject<((event: KeyboardEvent) => boolean) | null>; onChoose: (choice: SplitChoice) => void; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const style = useAnchoredPosition(prompt.anchor, panel);
  useDismiss(panel, null, onClose);
  const [remember, setRemember] = useState(true);
  useEffect(() => {
    keyRef.current = event => { if (event.key !== 'Tab') return false; event.preventDefault(); panel.current?.querySelector<HTMLButtonElement>('button')?.focus(); return true; };
    return () => { keyRef.current = null; };
  }, [keyRef]);
  const marks = systems ? optionMarks(systems) : undefined;
  const candidates = systems?.dimensions.filter(d => d.options.length === prompt.values.length) ?? [];
  return createPortal(<div ref={panel} className="ln-split-prompt" style={style} role="dialog" aria-label="这组数值对应的体系">
    <p className="ln-split-prompt-title">“{prompt.source}”的 {prompt.values.length} 个数值按哪个体系区分？</p>
    <div className="ln-split-prompt-options">
      {candidates.map(dimension => <button key={dimension.id} type="button" className="focus-ring" onClick={() => onChoose({ dimensionId: dimension.id, remember })}>
        <strong>{dimension.label}</strong>
        <span>{dimension.options.map((option, index) => { const mark = marks?.get(`${dimension.id}:${option.id}`); return <span key={option.id} className="ln-chip-option" data-tone={mark?.tone}>{mark?.symbol ? <SystemMark mark={mark} /> : null}{option.label} · {prompt.values[index]}</span>; })}</span>
      </button>)}
      <button type="button" className="focus-ring" onClick={() => onChoose({ create: true })}>
        <strong>新建体系</strong>
        <span>{prompt.values.map((value, index) => <span key={index} className="ln-chip-option">{String.fromCharCode(65 + index)} · {value}</span>)}</span>
      </button>
    </div>
    {candidates.length > 1 ? <label className="ln-chip-check"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />以后 {prompt.values.length} 个数值都按所选体系</label> : null}
    <footer className="ln-split-prompt-footer"><button type="button" className="focus-ring ln-chip-link" onClick={onClose}>保持为文字</button><small className="ln-split-prompt-keys">Tab 选择 · Esc 保持为文字</small></footer>
  </div>, document.body);
}
