'use client';
import { Check, Circle, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from './I18nProvider';
import type { DesignReadiness } from '@/lib/copilot/plan-design/deps.server';
import type { ProtocolChoice } from '@/lib/copilot/plan-design/prompts';
import {
  blockKinds, claimTypeLabels, claimTypes, contextFields, designSteps, requiredBlocks, stepCalls, stepLabels, tierLabels, tiers,
  type Chain, type ContextCard, type ContextField, type ContextItem, type DesignRunView, type DesignStep, type Tier,
} from '@/lib/copilot/plan-design/spec';
import type { DesignAction } from '@/lib/copilot/plan-design/workflow';
import { chainTemplates, templateById } from '@/lib/copilot/plan-design/templates';
import { AiButton } from './AiAssistant';
import { DesignCardsStep } from './DesignCardsStep';
import { DesignReviewStep } from './DesignReviewStep';
import { Button } from './ui/Button';
import './design-workbench.css';

type PlanExperiment = { id: string; label: string; day: string; hasProtocol: boolean };
type OldRun = { id: string; purpose: string; status: string; at: string; suggestions: string[] };

export async function callApi<T>(path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  const response = await fetch(path, { method, headers: { 'content-type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : method === 'GET' ? {} : { body: '{}' }) });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'Something went wrong; try again');
  return payload;
}

/**
 * The research-plan design workbench (Q300): the steps on the left, the current step's artifact on the right. A model
 * step only drafts; the author edits and confirms before the next step opens (Q311). Signing writes the plan once.
 */
export function DesignWorkbench({ planId, defaultPurpose, archived, initialRuns, readiness, protocols, experiments, oldRuns }: {
  planId: string; defaultPurpose: string; archived: boolean; initialRuns: DesignRunView[]; readiness: DesignReadiness; protocols: ProtocolChoice[]; experiments: PlanExperiment[]; oldRuns: OldRun[];
}) {
  const { t } = useI18n();
  const base = `/api/research-plans/${planId}/design`;
  const [runs, setRuns] = useState(initialRuns);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const router = useRouter();
  const run = runs.find(item => item.status !== 'signed');
  const signed = runs.filter(item => item.status === 'signed');
  const put = (next: DesignRunView) => setRuns(list => list.some(item => item.id === next.id) ? list.map(item => item.id === next.id ? next : item) : [next, ...list]);
  const guard = async (label: string, work: () => Promise<void>) => {
    setBusy(label); setError(undefined);
    try { await work(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Something went wrong; try again'); } finally { setBusy(undefined); }
  };
  const act = (action: DesignAction) => guard(action.kind, async () => { if (!run) return; put((await callApi<{ run: DesignRunView }>(`${base}/${run.id}`, 'PATCH', { action, seen: run.updatedAt })).run); });
  /** A model step. `blockId` drafts that one card; the result can be a failed run, shown with its error. */
  const step = async (blockId?: string) => {
    if (!run) return undefined;
    const next = (await callApi<{ run: DesignRunView }>(`${base}/${run.id}/step`, 'POST', blockId ? { blockId } : {})).run;
    put(next);
    if (next.status === 'failed') throw new Error(next.error ?? 'The step did not finish; try again');
    return next;
  };
  const shared = { run: run!, busy, act, step: (blockId?: string) => guard(blockId ? `card:${blockId}` : 'step', async () => { await step(blockId); }), readiness };

  if (!run) return <div className="ln-dw">
    {!archived ? <StartDesign defaultPurpose={defaultPurpose} busy={busy === 'start'} hasSigned={signed.length > 0} onStart={purpose => guard('start', async () => put((await callApi<{ run: DesignRunView }>(base, 'POST', { purpose })).run))} /> : <p className="ln-dw-note">This plan is archived.</p>}
    {notice ? <p role="status" className="ln-dw-ok">{notice}</p> : null}
    {error ? <p role="alert" className="ln-dw-error">{error}</p> : null}
    <History signed={signed} experiments={experiments} oldRuns={oldRuns} />
  </div>;

  const current = run.step as DesignStep;
  return <div className="ln-dw">
    <div className="ln-dw-layout">
      <nav className="ln-dw-rail" aria-label="Design steps">
        <ol>{designSteps.map((item, index) => {
          const state = designSteps.indexOf(current) > index ? 'done' : item === current ? 'current' : 'todo';
          return <li key={item} data-state={state}>
            {state === 'done' ? <Check className="h-4 w-4" aria-hidden /> : <Circle className="h-4 w-4" aria-hidden fill={state === 'current' ? 'currentColor' : 'none'} />}
            <span><strong>{index + 1}. {stepLabels[item]}</strong>{state === 'done' && !archived ? <button type="button" className="ln-dw-link" disabled={Boolean(busy)} onClick={() => act({ kind: 'reopen', step: item })}>Reopen</button> : null}</span>
          </li>;
        })}</ol>
        <p className="ln-dw-note">Hypotheses and predictions, the evidence ledger, sample-size calculation and the feasibility and schedule check come in phase 2.</p>
        <p className="ln-dw-note">{`${run.modelCalls} model calls so far${run.provider ? ` · ${run.provider}` : ''}`}</p>
        <button type="button" className="ln-dw-link ln-dw-remove" disabled={Boolean(busy)} onClick={() => { if (window.confirm(t('Remove this design? Nothing was written to the plan yet.'))) void guard('remove', async () => { await callApi(`${base}/${run.id}`, 'DELETE'); setRuns(list => list.filter(item => item.id !== run.id)); }); }}><Trash2 className="h-3.5 w-3.5" aria-hidden />Remove this design</button>
      </nav>
      <section className="ln-dw-panel" aria-label={stepLabels[current]}>
        <p className="ln-dw-purpose"><span>Research purpose</span>{run.purpose}</p>
        {run.status === 'failed' && run.error ? <p role="alert" className="ln-dw-error">{`The last step failed: ${run.error}`}</p> : null}
        {error ? <p role="alert" className="ln-dw-error">{error}</p> : null}
        {!readiness.ready ? <p role="status" className="ln-dw-warn">{readiness.reason ?? 'AI is off.'} You can still edit and confirm what is drafted.</p> : null}
        {current === 'context' ? <ContextStep {...shared} /> : null}
        {current === 'chain' ? <ChainStep {...shared} /> : null}
        {current === 'cards' ? <DesignCardsStep {...shared} protocols={protocols} draftAll={() => guard('cards', async () => {
          let next: DesignRunView | undefined = run;
          for (let guardCount = 0; guardCount < 6 && next; guardCount += 1) {
            const chain = next.state.chain?.draft, tier = next.state.chain?.tier;
            if (!chain || !tier || requiredBlocks(chain, tier).every(block => next!.state.cards?.items.some(card => card.blockId === block.id))) break;
            next = await step();
          }
        })} /> : null}
        {current === 'review' ? <DesignReviewStep {...shared} protocols={protocols} base={`${base}/${run.id}`} onSigned={(next, experimentIds) => { put(next); setNotice(`Signed. ${experimentIds.length} planned experiments were made.`); router.refresh(); }} /> : null}
      </section>
    </div>
    <History signed={signed} experiments={experiments} oldRuns={oldRuns} />
  </div>;
}

export type StepProps = { run: DesignRunView; busy?: string; readiness: DesignReadiness; act: (action: DesignAction) => Promise<void>; step: (blockId?: string) => Promise<void> };

function StartDesign({ defaultPurpose, busy, hasSigned, onStart }: { defaultPurpose: string; busy: boolean; hasSigned: boolean; onStart: (purpose: string) => void }) {
  const [purpose, setPurpose] = useState(defaultPurpose);
  return <form className="ln-dw-start" onSubmit={event => { event.preventDefault(); if (purpose.trim().length >= 4) onStart(purpose); }}>
    <h2>{hasSigned ? 'Start a new design' : 'Design this plan'}</h2>
    <p className="ln-dw-note">Four steps: a context card from what LabNest already holds, an evidence chain from a template, a design card for each required experiment, and an independent review before you sign. Each step waits for you to confirm it.</p>
    <label>Research purpose<textarea rows={3} value={purpose} onChange={event => setPurpose(event.target.value)} placeholder="e.g. Show that SRGN knockdown inhibits migration of KYSE150 cells" /></label>
    <div className="ln-dw-actions">
      <Button type="submit" variant="primary" disabled={busy || purpose.trim().length < 4}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}Start</Button>
      <p className="ln-dw-note">Starting reads this plan, its project and the inventory. Nothing is sent to an AI service until you draft the context card.</p>
    </div>
  </form>;
}

const kindLabels: Record<ContextItem['kind'], string> = { plan: 'Plan', experiment: 'Experiments', result: 'Results', protocol: 'Protocols', inventory: 'Inventory', sample: 'Samples' };
const fieldLabels: Record<ContextField, string> = {
  question: 'Research question', claimType: 'Claim type', subject: 'Subject and candidates', modelSystem: 'Model system (cell line, source, STR and mycoplasma status)',
  resourcesHave: 'Resources we have', resourcesCanGet: 'Resources we can get', resourcesLack: 'Resources we lack', constraints: 'Constraints (time, budget, instruments)',
  outOfScope: 'Out of scope', success: 'What success looks like', priorResults: 'Existing results',
};
const stateLabels = { confirmed: 'Confirmed', ai: 'AI suggestion', pending: 'Undecided' } as const;

function ContextStep({ run, busy, act, step }: StepProps) {
  const items = run.state.gathered ?? [];
  const card = run.state.context?.card;
  const [draft, setDraft] = useState<ContextCard | undefined>(card);
  const [seenCard, setSeenCard] = useState(card);
  if (card !== seenCard) { setSeenCard(card); setDraft(card); }
  const dirty = Boolean(draft && card && JSON.stringify(draft) !== JSON.stringify(card));
  const kinds = [...new Set(items.map(item => item.kind))];
  const save = () => draft ? act({ kind: 'context', card: draft }) : Promise.resolve();
  return <div className="ln-dw-step">
    <details className="ln-dw-box" open={!card}>
      <summary>{`LabNest records to send (${items.filter(item => item.included).length} of ${items.length})`}</summary>
      <p className="ln-dw-note">Only these one-line summaries go to the AI service, never files or raw data. Untick what should stay here.</p>
      {kinds.map(kind => <fieldset key={kind} className="ln-dw-records"><legend>{kindLabels[kind]}</legend>
        {items.filter(item => item.kind === kind).map(item => <label key={item.id} className="ln-dw-check">
          <input type="checkbox" checked={item.included} disabled={Boolean(busy)} onChange={event => act({ kind: 'include', itemId: item.id, included: event.target.checked })} />
          <span><strong>{item.label}</strong>{item.detail ? <small>{item.detail}</small> : null}</span>
        </label>)}
      </fieldset>)}
      {!items.length ? <p className="ln-dw-note">Nothing in LabNest matched; the card starts from the purpose alone.</p> : null}
      <div className="ln-dw-actions"><AiButton type="button" disabled={Boolean(busy)} onClick={() => void step()}>{busy === 'step' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}{card ? 'Draft the card again' : 'Draft the context card'}</AiButton><span className="ln-dw-note">{`About ${stepCalls('context')} model call`}</span></div>
    </details>
    {draft ? <div className="ln-dw-box">
      <h3>Context card</h3>
      {draft.questions.length ? <div className="ln-dw-callout"><strong>Decide before confirming</strong><ul>{draft.questions.map(question => <li key={question}>{question}</li>)}</ul></div> : null}
      <div className="ln-dw-fields">{contextFields.map(field => <label key={field} className={field === 'question' || field === 'priorResults' ? 'is-wide' : undefined}>
        <span>{fieldLabels[field]}<em data-state={draft.states[field] ?? 'pending'}>{stateLabels[draft.states[field] ?? 'pending']}</em></span>
        {field === 'claimType'
          ? <select value={draft.claimType} onChange={event => setDraft({ ...draft, claimType: event.target.value as ContextCard['claimType'] })}><option value="">Choose…</option>{claimTypes.map(type => <option key={type} value={type}>{claimTypeLabels[type]}</option>)}</select>
          : <textarea rows={field === 'question' ? 2 : 2} value={draft[field]} onChange={event => setDraft({ ...draft, [field]: event.target.value })} />}
      </label>)}</div>
      <div className="ln-dw-actions">
        {dirty ? <Button type="button" disabled={Boolean(busy)} onClick={() => void save()}>Save changes</Button> : null}
        <Button type="button" variant="primary" disabled={Boolean(busy) || dirty} onClick={() => void act({ kind: 'confirm' })}>Confirm the card</Button>
        <span className="ln-dw-note">Confirming accepts the AI suggestions as they are; open fields stay open.</span>
      </div>
    </div> : null}
  </div>;
}

function ChainStep({ run, busy, act, step }: StepProps) {
  const chainState = run.state.chain;
  const template = templateById(chainState?.templateId ?? '') ?? chainTemplates[0];
  const [draft, setDraft] = useState<{ chain: Chain; tier: Tier } | undefined>(chainState?.draft && chainState.tier ? { chain: chainState.draft, tier: chainState.tier } : undefined);
  const [seen, setSeen] = useState(chainState?.draft);
  if (chainState?.draft !== seen) { setSeen(chainState?.draft); setDraft(chainState?.draft && chainState.tier ? { chain: chainState.draft, tier: chainState.tier } : undefined); }
  const dirty = Boolean(draft && (JSON.stringify(draft.chain) !== JSON.stringify(chainState?.draft) || draft.tier !== chainState?.tier));
  const required = draft ? requiredBlocks(draft.chain, draft.tier) : [];
  const setChain = (chain: Chain) => draft && setDraft({ ...draft, chain });
  const setBlock = (index: number, patch: Partial<Chain['blocks'][number]>) => draft && setChain({ ...draft.chain, blocks: draft.chain.blocks.map((block, at) => at === index ? { ...block, ...patch } : block) });
  return <div className="ln-dw-step">
    <div className="ln-dw-box">
      <label className="ln-dw-inline">Evidence-chain template<select value={template.id} disabled={Boolean(busy)} onChange={event => act({ kind: 'template', templateId: event.target.value })}>{chainTemplates.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <details><summary>What this template asks for</summary>
        <dl className="ln-dw-template">
          <dt>Least credible evidence</dt><dd><ul>{template.minimumEvidence.map(item => <li key={item}>{item}</li>)}</ul></dd>
          <dt>Required controls</dt><dd><ul>{template.requiredControls.map(item => <li key={item}>{item}</li>)}</ul></dd>
          <dt>Usual counter-explanations</dt><dd><ul>{template.alternatives.map(item => <li key={item}>{item}</li>)}</ul></dd>
        </dl>
      </details>
      <div className="ln-dw-actions"><AiButton type="button" disabled={Boolean(busy)} onClick={() => void step()}>{busy === 'step' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}{draft ? 'Draft the chain again' : 'Draft the evidence chain'}</AiButton><span className="ln-dw-note">{`About ${stepCalls('chain')} model call · designed from common practice, no literature`}</span></div>
    </div>
    {draft ? <div className="ln-dw-box">
      <h3>Evidence chain</h3>
      {draft.chain.drift.length ? <div className="ln-dw-callout is-warn"><strong>The model would change the context card</strong><ul>{draft.chain.drift.map(item => <li key={item}>{item}</li>)}</ul><p className="ln-dw-note">Nothing was changed. Reopen the context card to apply any of this.</p></div> : null}
      <div className="ln-dw-fields">
        <label className="is-wide"><span>Claim</span><textarea rows={2} value={draft.chain.claim} onChange={event => setChain({ ...draft.chain, claim: event.target.value })} /></label>
        <label><span>Main hypothesis</span><textarea rows={2} value={draft.chain.hypothesis} onChange={event => setChain({ ...draft.chain, hypothesis: event.target.value })} /></label>
        <label><span>Rationale</span><textarea rows={2} value={draft.chain.rationale} onChange={event => setChain({ ...draft.chain, rationale: event.target.value })} /></label>
        <label className="is-wide"><span>Least credible evidence (one per line)</span><textarea rows={3} value={draft.chain.minimumEvidence.join('\n')} onChange={event => setChain({ ...draft.chain, minimumEvidence: event.target.value.split('\n').map(line => line.trim()).filter(Boolean) })} /></label>
      </div>
      <fieldset className="ln-dw-records"><legend>Counter-explanations to rule out</legend>
        {draft.chain.alternatives.map((item, index) => <label key={index} className="ln-dw-check"><input type="checkbox" checked={item.exclude} onChange={event => setChain({ ...draft.chain, alternatives: draft.chain.alternatives.map((alt, at) => at === index ? { ...alt, exclude: event.target.checked } : alt) })} /><span>{item.text}</span></label>)}
      </fieldset>
      <fieldset className="ln-dw-tiers"><legend>Tier</legend>
        {tiers.map(tier => <label key={tier} className="ln-dw-check"><input type="radio" name="tier" checked={draft.tier === tier} onChange={() => setDraft({ ...draft, tier })} /><span>{tierLabels[tier]}{draft.chain.recommendedTier === tier ? <em data-state="ai">Recommended</em> : null}</span></label>)}
      </fieldset>
      <ol className="ln-dw-blocks">{draft.chain.blocks.map((block, index) => {
        const isRequired = required.includes(block);
        return <li key={block.id} data-required={isRequired}>
          <div className="ln-dw-block-head">
            <span className="ln-dw-badge" data-tone={isRequired ? 'must' : undefined}>{isRequired ? 'Must do' : 'Optional'}</span>
            <input aria-label="Block title" value={block.title} onChange={event => setBlock(index, { title: event.target.value })} />
            <select aria-label="Kind" value={block.kind} onChange={event => setBlock(index, { kind: event.target.value as typeof block.kind })}>{blockKinds.map(kind => <option key={kind} value={kind}>{kindNames[kind]}</option>)}</select>
            <select aria-label="Required from tier" value={block.minTier} onChange={event => setBlock(index, { minTier: event.target.value as Tier })}>{tiers.map(tier => <option key={tier} value={tier}>{`From ${tierLabels[tier]}`}</option>)}</select>
            <button type="button" className="ln-dw-icon" aria-label="Remove this block" onClick={() => setChain({ ...draft.chain, blocks: draft.chain.blocks.filter((_, at) => at !== index).map(other => ({ ...other, dependsOn: other.dependsOn.filter(dep => dep !== block.id) })) })}><Trash2 className="h-4 w-4" aria-hidden /></button>
          </div>
          {block.dependsOn.length ? <p className="ln-dw-note">{`After ${block.dependsOn.map(dep => draft.chain.blocks.find(other => other.id === dep)?.title ?? dep).join(', ')}`}</p> : null}
          <details><summary>{block.success || 'Success, failure and fallback'}</summary><div className="ln-dw-fields">
            {(['purpose', 'success', 'failure', 'fallback'] as const).map(key => <label key={key}><span>{blockFieldNames[key]}</span><textarea rows={2} value={block[key]} onChange={event => setBlock(index, { [key]: event.target.value })} /></label>)}
          </div></details>
        </li>;
      })}</ol>
      <div className="ln-dw-actions">
        {dirty ? <Button type="button" disabled={Boolean(busy)} onClick={() => void act({ kind: 'chain', chain: draft.chain, tier: draft.tier })}>Save changes</Button> : null}
        <Button type="button" variant="primary" disabled={Boolean(busy) || dirty || !required.length} onClick={() => void act({ kind: 'confirm' })}>Confirm the chain</Button>
        <span className="ln-dw-note">{`${required.length} required, ${draft.chain.blocks.length - required.length} optional. At most 5 required.`}</span>
      </div>
    </div> : null}
  </div>;
}

export const kindNames: Record<typeof blockKinds[number], string> = { baseline: 'Baseline', manipulation: 'Manipulation check', phenotype: 'Phenotype', specificity: 'Specificity or rescue', mechanism: 'Mechanism' };
const blockFieldNames = { purpose: 'What it answers', success: 'Success criterion', failure: 'What a failure means', fallback: 'Fallback' } as const;

function History({ signed, experiments, oldRuns }: { signed: DesignRunView[]; experiments: PlanExperiment[]; oldRuns: OldRun[] }) {
  if (!signed.length && !oldRuns.length) return null;
  return <div className="ln-dw-history">
    {signed.map(run => <div key={run.id} className="ln-dw-box">
      <h3>{`Design v${run.state.signed?.version} · signed ${run.signedAt?.slice(0, 10)}`}</h3>
      <p className="ln-dw-note">{run.state.chain?.draft?.claim}</p>
      <ul className="ln-dw-list">{(run.state.signed?.experimentIds ?? []).map(id => { const experiment = experiments.find(item => item.id === id); return experiment ? <li key={id}><Link href={`/experiments/${id}`} className="ln-dw-link">{experiment.label}</Link><span className="ln-dw-note">{experiment.hasProtocol ? experiment.day : `${experiment.day} · needs a Protocol`}</span><Link href={`/experiments/${id}/schedule`} className="ln-dw-link">Day plan</Link></li> : null; })}</ul>
    </div>)}
    {oldRuns.length ? <details className="ln-dw-box"><summary>Earlier Copilot runs (read-only)</summary>
      <p className="ln-dw-note">Made by the literature-first Copilot this workbench replaces. They can be read, not continued.</p>
      <ul className="ln-dw-list">{oldRuns.map(old => <li key={old.id}><span><strong>{old.at}</strong> {old.purpose}</span>{old.suggestions.length ? <small>{old.suggestions.join(' · ')}</small> : null}</li>)}</ul>
    </details> : null}
  </div>;
}
