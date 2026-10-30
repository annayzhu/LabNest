'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ProtocolContentBlockView } from './ProtocolDocumentView';
import { ChipRenderContext, type ChipRender } from './protocol/ChipText';
import type { runStepContent } from '@/lib/run-step-content';
import './run-bench.css';

type Reference = ReturnType<typeof runStepContent>['reference'];

/**
 * 规程原文: the Protocol as this experiment captured it (description, materials, every step), opened beside the step being
 * worked and scrolled to it. Closing returns to the same place on the page.
 */
export function ProtocolReferenceSheet({ groups, references, chipContexts, stepRef, onClose }: {
  groups: Array<{ key: string; title: string }>; references: Record<string, Reference>; chipContexts: Record<string, ChipRender>; stepRef?: string | null; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!element.open) element.showModal();
    element.querySelector(`[data-reference-step="${CSS.escape(stepRef ?? '')}"]`)?.scrollIntoView({ block: 'start' });
    return () => element.close();
  }, [stepRef]);
  return createPortal(<dialog ref={dialog} aria-labelledby="run-reference-title" className="ln-run-dialog is-sheet bg-surface text-ink" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header><h2 id="run-reference-title">Protocol original</h2><button type="button" className="focus-ring ln-run-dialog-close" aria-label="Close" onClick={onClose}><X aria-hidden /></button></header>
    <div className="ln-reference-body run-step-content">{groups.map(group => <section key={group.key} aria-label={group.title}>
      {groups.length > 1 ? <h3>{group.title}</h3> : <p className="ln-reference-title">{group.title}</p>}
      <ChipRenderContext.Provider value={chipContexts[group.key] ?? null}>{(references[group.key] ?? []).map(section => <section key={section.key}>
        <h4>{section.title}</h4>
        {section.blocks.map(block => { const step = block.execution?.role === 'step' ? `${group.key}:${block.execution.stepId ?? block.id}` : undefined;
          return <div key={block.id} data-reference-step={step} data-current={step && step === stepRef ? '' : undefined}><ProtocolContentBlockView block={block} executionContext /></div>; })}
      </section>)}</ChipRenderContext.Provider>
    </section>)}</div>
  </dialog>, document.body);
}
