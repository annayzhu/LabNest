'use client';
import { useState } from 'react';
import type { Outline, OutlineUse, RecognitionLanguage, ScopeChoice } from '@/lib/protocol-recognition-scope';
import { partKept } from '@/lib/protocol-recognition-scope';
import { AiButton } from './AiAssistant';
import { Button } from './ui/Button';
import './recognition-draft.css';

const partUses: Record<OutlineUse, string> = {
  description: 'Description', purpose: 'Purpose', background: 'Background', material: 'Materials', steps: 'Steps',
  result_templates: 'Results', consumption_rules: 'Consumption rules', drop: 'Leave out', unknown: 'Unsorted',
};

const languageLabels: Record<RecognitionLanguage, string> = {
  zh: 'Organize in Chinese (numbers, units, reagent names and catalog numbers as in the original)',
  source: 'Keep the original wording',
};

/** The draft's language, chosen before the model is asked and again in the scope. */
export function LanguageChoice({ value, onChange, disabled }: { value: RecognitionLanguage; onChange: (value: RecognitionLanguage) => void; disabled?: boolean }) {
  return <fieldset className="ln-scope-languages" disabled={disabled}>
    <legend>Draft language</legend>
    {(['zh', 'source'] as const).map(language => <label key={language}><input type="radio" name="recognition-language" checked={value === language} onChange={() => onChange(language)} />{languageLabels[language]}</label>)}
  </fieldset>;
}

const pagesText = (from: number, to: number) => from === to ? `p${from}` : `p${from}–${to}`;

/**
 * 目录与范围: what the first pass found, for the author to confirm before the second pass reads anything. One workflow,
 * the systems to keep, the draft's language, and the parts to leave out; a part of another workflow or of a system not
 * kept is left out with it.
 */
export function RecognitionScope({ outline, choice: initial, busy, onConfirm, onCancel }: { outline: Outline; choice: ScopeChoice; busy?: boolean; onConfirm: (choice: ScopeChoice) => void; onCancel: () => void }) {
  const [choice, setChoice] = useState(initial);
  const toggle = (index: number) => setChoice(current => ({ ...current, dropped: current.dropped.includes(index) ? current.dropped.filter(item => item !== index) : [...current.dropped, index].sort((a, b) => a - b) }));
  const toggleSystem = (option: string) => setChoice(current => {
    const kept = current.systems ?? [];
    const next = kept.includes(option) ? kept.filter(item => item !== option) : outline.systems!.options.filter(item => item === option || kept.includes(item));
    return { ...current, systems: next };
  });
  const noSystem = Boolean(outline.systems) && !choice.systems?.length;
  return <section className="ln-scope" aria-label="Contents and scope">
    <div>
      <h3 className="text-sm font-semibold text-ink">Contents and scope</h3>
      <p className="ln-design-note">{outline.read ? 'The model read the headings and the first lines of each page. Confirm what to organize; only those pages are sent next.' : 'The contents could not be read; the whole source will be organized in order.'}</p>
    </div>
    {outline.workflows.length ? <fieldset className="ln-scope-group">
      <legend>Workflow (the original gives several; organize one)</legend>
      {outline.workflows.map(workflow => <label key={workflow}><input type="radio" name="recognition-workflow" checked={choice.workflow === workflow} onChange={() => setChoice(current => ({ ...current, workflow }))} />{workflow}</label>)}
    </fieldset> : null}
    {outline.systems ? <fieldset className="ln-scope-group">
      <legend>{outline.systems.label === '体系' ? 'Systems: values are written in this order' : `Systems (${outline.systems.label}): values are written in this order`}</legend>
      {outline.systems.options.map(option => <label key={option}><input type="checkbox" checked={Boolean(choice.systems?.includes(option))} onChange={() => toggleSystem(option)} />{option}</label>)}
      {noSystem ? <p className="text-xs text-warning">Keep at least one system.</p> : null}
    </fieldset> : null}
    <LanguageChoice value={choice.language} onChange={language => setChoice(current => ({ ...current, language }))} disabled={busy} />
    <fieldset className="ln-scope-group">
      <legend>Parts of the original</legend>
      <ul className="ln-scope-parts">{outline.parts.map((part, index) => {
        const other = (part.workflow && choice.workflow && part.workflow !== choice.workflow) || (part.system && choice.systems && !choice.systems.includes(part.system));
        const kept = partKept(part, index, choice);
        return <li key={`${part.from}-${part.to}-${index}`} data-left-out={kept ? undefined : ''}>
          <label><input type="checkbox" checked={kept} disabled={Boolean(other)} onChange={() => toggle(index)} />
            <span className="ln-scope-pages">{pagesText(part.from, part.to)}</span>
            <span className="ln-scope-label">{part.label}</span>
            <span className="ln-scope-use">{partUses[part.use]}</span>
            {part.workflow ? <span className="ln-scope-tag">{part.workflow}</span> : null}
            {part.system ? <span className="ln-scope-tag">{part.system}</span> : null}
          </label>
        </li>;
      })}</ul>
    </fieldset>
    {outline.conflicts.length ? <div className="ln-scope-group">
      <p className="text-xs font-medium text-graphite">Differences within the original (written into the description as “原文差异”, for you to settle):</p>
      <ul className="list-disc pl-5 text-xs text-graphite">{outline.conflicts.map(item => <li key={item}>{item}</li>)}</ul>
    </div> : null}
    <div className="flex flex-wrap items-center gap-2">
      <AiButton disabled={busy || noSystem} aria-busy={busy} onClick={() => onConfirm(choice)}>{busy ? 'Organizing with AI… (may take a few minutes)' : 'Organize this scope'}</AiButton>
      <Button type="button" disabled={busy} onClick={onCancel}>Cancel</Button>
    </div>
  </section>;
}
