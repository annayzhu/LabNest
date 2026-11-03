'use client';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { checkHypotheses, type HypothesisFinding } from '@/lib/copilot/plan-design/rules';
import { rivalKindLabels, rivalKinds, stepCalls, type Hypotheses, type Rival } from '@/lib/copilot/plan-design/spec';
import { AiButton } from './AiAssistant';
import type { StepProps } from './DesignWorkbench';
import { useI18n } from './I18nProvider';
import { Button } from './ui/Button';

/**
 * ② Hypotheses and predictions (Q303; K-Dense hypothesis-generation): the main hypothesis, rivals from different
 * classes, and for each rival the test that tells it apart. Nothing is scored or ranked; the author ticks which
 * rivals the design must rule out. The checks run on every change; a result that would count against the main
 * hypothesis is required before confirming.
 */
export function DesignHypothesesStep({ run, busy, act, step }: StepProps) {
  const { t } = useI18n();
  const saved = run.state.hypotheses?.draft;
  const [draft, setDraft] = useState<Hypotheses | undefined>(saved);
  const [seen, setSeen] = useState(saved);
  // Compared by content: a ledger change elsewhere on the page must not wipe unsaved edits here.
  if (JSON.stringify(saved) !== JSON.stringify(seen)) { setSeen(saved); setDraft(saved); }
  const dirty = Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved));
  const findings = draft ? checkHypotheses(draft, run.state.context?.card.claimType ?? '') : [];
  const serious = findings.filter(finding => finding.severity === 'serious');
  const at = (rivalId: string, field: string) => findings.filter(finding => finding.rivalId === rivalId && finding.field === field).map(finding => <FindingLine key={finding.key} finding={finding} />);
  const setMain = (patch: Partial<Hypotheses['main']>) => draft && setDraft({ ...draft, main: { ...draft.main, ...patch } });
  const setRival = (id: string, patch: Partial<Rival>) => draft && setDraft({ ...draft, rivals: draft.rivals.map(rival => rival.id === id ? { ...rival, ...patch } : rival) });
  const addRival = () => draft && setDraft({ ...draft, rivals: [...draft.rivals, { id: `r${Math.max(0, ...draft.rivals.map(rival => Number(rival.id.slice(1)) || 0)) + 1}`, statement: '', kind: 'mechanism', test: '', ifMain: '', ifRival: '', undecided: '', exclude: true }] });
  const blankRival = draft?.rivals.some(rival => rival.statement.trim().length < 2) ?? false;

  return <div className="ln-dw-step">
    <div className="ln-dw-box">
      <p className="ln-dw-note">Rivals come first, then the tests that tell them apart. Every hypothesis here is a candidate: the AI lists them, you decide which ones the design must rule out.</p>
      <div className="ln-dw-actions"><AiButton type="button" disabled={Boolean(busy)} onClick={() => { if (!dirty || window.confirm(t('Draft again? Your unsaved changes are lost.'))) void step(); }}>{busy === 'step' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}{saved ? 'Draft the hypotheses again' : 'Draft the hypotheses'}</AiButton><span className="ln-dw-note">{`About ${stepCalls('hypotheses')} model call · from the confirmed context card and verified evidence only`}</span></div>
    </div>
    {draft ? <div className="ln-dw-box">
      <h3>Hypotheses and predictions</h3>
      {draft.drift.length ? <div className="ln-dw-callout is-warn"><strong>The model would change the context card</strong><ul>{draft.drift.map(item => <li key={item}>{item}</li>)}</ul><p className="ln-dw-note">Nothing was changed. Reopen the context card to apply any of this.</p></div> : null}
      <div className="ln-dw-fields">
        <label className="is-wide"><span>Main hypothesis<em data-state="ai">Candidate</em></span><textarea rows={2} value={draft.main.statement} onChange={event => setMain({ statement: event.target.value })} /></label>
        <label><span>What it predicts</span><textarea rows={2} value={draft.main.predicts} onChange={event => setMain({ predicts: event.target.value })} /></label>
        <label><span>A result that would count against it</span><textarea rows={2} value={draft.main.incompatible} onChange={event => setMain({ incompatible: event.target.value })} /></label>
        <label><span>Proposed mechanism (optional)</span><textarea rows={2} value={draft.main.mechanism} onChange={event => setMain({ mechanism: event.target.value })} /></label>
        <label><span>What is estimated</span><textarea rows={2} value={draft.estimand} onChange={event => setDraft({ ...draft, estimand: event.target.value })} placeholder="The comparison, system, readout and time point" /></label>
      </div>
      {at('', 'statement')}{at('', 'incompatible')}
      <fieldset className="ln-dw-rows"><legend>Counter-explanations and the tests that tell them apart</legend>
        {at('', 'rivals')}
        <ol className="ln-dw-blocks">{draft.rivals.map(rival => <li key={rival.id} data-required={rival.exclude}>
          <div className="ln-dw-block-head">
            <label className="ln-dw-check"><input type="checkbox" checked={rival.exclude} onChange={event => setRival(rival.id, { exclude: event.target.checked })} />Rule out</label>
            <input aria-label="Counter-explanation" value={rival.statement} onChange={event => setRival(rival.id, { statement: event.target.value })} placeholder="Counter-explanation" />
            <select aria-label="Kind of explanation" value={rival.kind} onChange={event => setRival(rival.id, { kind: event.target.value as Rival['kind'] })}>{rivalKinds.map(kind => <option key={kind} value={kind}>{rivalKindLabels[kind]}</option>)}</select>
            <button type="button" className="ln-dw-icon" aria-label="Remove this counter-explanation" onClick={() => setDraft({ ...draft, rivals: draft.rivals.filter(other => other.id !== rival.id) })}><Trash2 className="h-4 w-4" aria-hidden /></button>
          </div>
          <div className="ln-dw-fields">
            <label><span>Test that tells them apart</span><textarea rows={2} value={rival.test} onChange={event => setRival(rival.id, { test: event.target.value })} /></label>
            <label><span>If the main hypothesis holds</span><textarea rows={2} value={rival.ifMain} onChange={event => setRival(rival.id, { ifMain: event.target.value })} /></label>
            <label><span>If this explanation holds</span><textarea rows={2} value={rival.ifRival} onChange={event => setRival(rival.id, { ifRival: event.target.value })} /></label>
            <label><span>Undecided if</span><textarea rows={2} value={rival.undecided} onChange={event => setRival(rival.id, { undecided: event.target.value })} /></label>
          </div>
          {at(rival.id, 'test')}{at(rival.id, 'ifRival')}{at(rival.id, 'undecided')}
        </li>)}</ol>
        <button type="button" className="ln-dw-link" onClick={addRival}><Plus className="h-3.5 w-3.5" aria-hidden />Add a counter-explanation</button>
      </fieldset>
      <div className="ln-dw-actions">
        {dirty ? <Button type="button" disabled={Boolean(busy) || blankRival} onClick={() => void act({ kind: 'hypotheses', hypotheses: draft })}>Save changes</Button> : null}
        <Button type="button" variant="primary" disabled={Boolean(busy) || dirty || serious.length > 0} onClick={() => void act({ kind: 'confirm' })}>Confirm the hypotheses</Button>
        <span className="ln-dw-note">{serious.length ? serious[0].text : `${draft.rivals.filter(rival => rival.exclude).length} to rule out: each becomes a control or a block in the next steps.`}</span>
      </div>
    </div> : null}
  </div>;
}

const severityNames = { serious: 'Serious', important: 'Important', minor: 'Minor' } as const;
function FindingLine({ finding }: { finding: HypothesisFinding }) {
  return <p className="ln-dw-rule" data-severity={finding.severity}>{`${severityNames[finding.severity]}: ${finding.text}`}</p>;
}
