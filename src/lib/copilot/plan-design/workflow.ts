import { askJson, type Complete } from '../structured';
import { stableJson } from '../suggestions';
import { emptyLedger, ledgerStatements, MAX_FULL_TEXTS, parseTerms, readingReader, readPrompt, relations, termsPrompt, verifiedEntries, type EvidenceEntry, type Ledger } from './evidence';
import { blockingRules, checkCards, checkHypotheses } from './rules';
import { withComputedN } from './sample-size';
import { cardPrompt, chainPrompt, contextPrompt, hypothesesPrompt, parseCard, parseChain, parseContext, parseHypotheses, parseReview, reviewPrompt, type ProtocolChoice } from './prompts';
import {
  chainSchema, contextCardSchema, contextFields, designCardSchema, hypothesesSchema, MAX_DESIGN_LOG, MAX_REQUIRED_BLOCKS, MAX_REVIEW_ROUNDS, requiredBlocks, requiredContextFields, stepLabels, stepsOf, tiers,
  type DesignCard, type DesignEvent, type DesignRunView, type DesignState, type DesignStep, type ReviewFinding, type ReviewRound, type Tier,
} from './spec';
import { suggestTemplate, templateById } from './templates';

/** What a model step needs: the drafting model, the reviewing one (the same model when none is set), the plan's Protocols. */
export type DesignDeps = { complete: Complete; review: { complete: Complete; provider: string; selfReview: boolean }; protocols: ProtocolChoice[]; now: () => Date };

/**
 * Runs `work` on a copy of the run with the helpers a model call needs. The copy comes back changed, never the input;
 * a failure marks it failed with the state as it was, so the same step can be tried again.
 */
async function withModel(input: DesignRunView, deps: DesignDeps, work: (run: DesignRunView, ask: Ask) => Promise<void>): Promise<DesignRunView> {
  const run = structuredClone(input);
  const log = (kind: DesignEvent['kind'], text: string) => { run.log.push({ at: deps.now().toISOString(), step: run.step, kind, text }); run.log.splice(0, Math.max(0, run.log.length - MAX_DESIGN_LOG)); };
  const ask: Ask = Object.assign(async <T>(complete: Complete, prompt: { system: string; user: string }, read: (text: string) => T) => {
    const answer = await askJson(complete, prompt, read, { onCall: () => { run.modelCalls += 1; }, onRetry: reason => log('note', `The answer could not be read (${reason.slice(0, 120)}); asked again`) });
    if (complete === deps.complete) run.model ??= answer.model;
    return answer;
  }, { log });
  run.error = undefined;
  try {
    await work(run, ask);
    run.status = 'idle';
  } catch (error) {
    run.status = 'failed';
    run.error = error instanceof Error ? error.message.slice(0, 500) : 'The step did not finish; try again';
    log('error', run.error);
  }
  return run;
}
type Ask = (<T>(complete: Complete, prompt: { system: string; user: string }, read: (text: string) => T) => Promise<{ value: T; model?: string }>) & { log: (kind: DesignEvent['kind'], text: string) => void };

/**
 * One model step: draft the context card, the hypotheses, the chain, one design card (the given block or the next one
 * missing), or a review round. No step confirms anything: the author does (Q311).
 */
export function runModelStep(input: DesignRunView, deps: DesignDeps, options: { blockId?: string } = {}): Promise<DesignRunView> {
  return withModel(input, deps, async (run, ask) => {
    const state = run.state;
    const verified = verifiedEntries(state.evidence);
    if (run.step === 'context') {
      const items = (state.gathered ?? []).filter(item => item.included);
      state.context = { card: (await ask(deps.complete, contextPrompt(run.purpose, items), parseContext)).value };
      ask.log('model', `Context card drafted from ${items.length} LabNest records`);
    } else if (run.step === 'hypotheses') {
      const draft = (await ask(deps.complete, hypothesesPrompt(confirmedContext(state), verified), parseHypotheses)).value;
      state.hypotheses = { draft };
      ask.log('model', `Hypotheses drafted: ${draft.rivals.length} counter-explanations`);
    } else if (run.step === 'chain') {
      const context = confirmedContext(state);
      const hypotheses = confirmedHypotheses(run);
      const template = templateById(state.chain?.templateId ?? '') ?? suggestTemplate(`${run.purpose} ${context.question}`, context.claimType);
      const draft = (await ask(deps.complete, chainPrompt(context, template, hypotheses, verified), text => parseChain(text, hypotheses))).value;
      state.chain = { templateId: template.id, templateVersion: template.version, draft, tier: draft.recommendedTier };
      ask.log('model', `Evidence chain drafted from template ${template.label}: ${draft.blocks.length} blocks`);
    } else if (run.step === 'cards') {
      const { chain, tier } = confirmedChain(state);
      const required = requiredBlocks(chain, tier);
      const block = options.blockId ? required.find(item => item.id === options.blockId) : required.find(item => !state.cards?.items.some(card => card.blockId === item.id));
      if (!block) throw new Error('Every required block already has a design card');
      const rivalIds = chain.alternatives.map(item => item.id ?? '').filter(Boolean);
      const card = (await ask(deps.complete, cardPrompt(confirmedContext(state), chain, tier, block, deps.protocols, verified), text => parseCard(text, block, deps.protocols, rivalIds))).value;
      state.cards ??= { items: [] };
      state.cards.items = [...state.cards.items.filter(item => item.blockId !== block.id), card].sort((a, b) => required.findIndex(item => item.id === a.blockId) - required.findIndex(item => item.id === b.blockId));
      state.cards.edited = { ...state.cards.edited, [block.id]: deps.now().toISOString() };
      ask.log('model', `Design card drafted: ${card.title}`);
    } else if (run.step === 'review') {
      const { chain, tier } = confirmedChain(state);
      if (!state.cards?.confirmedAt) throw new Error('Confirm the design cards first');
      const rounds = state.review?.rounds ?? [];
      if (rounds.length >= MAX_REVIEW_ROUNDS) throw new Error('Two review rounds are done; what is left goes into the limitations');
      const hypotheses = state.hypotheses?.confirmedAt ? state.hypotheses.draft : undefined;
      const prompt = reviewPrompt(confirmedContext(state), chain, tier, state.cards.items, designRules(state), rounds.length + 1, { hypotheses, evidence: state.evidence });
      const { value, model } = await ask(deps.review.complete, prompt, parseReview);
      const round: ReviewRound = {
        at: deps.now().toISOString(), provider: deps.review.provider, model, selfReview: deps.review.selfReview, verdict: value.verdict, dimensions: value.dimensions,
        supports: value.supports, strengths: value.strengths, seen: reviewedContent(state),
        findings: value.findings.map((finding, index): ReviewFinding => ({ ...finding, id: `${rounds.length + 1}-${index + 1}`, status: 'open' })),
      };
      state.review = { rounds: [...rounds, round] };
      ask.log('model', `Review round ${rounds.length + 1}: ${value.verdict}, ${value.findings.length} findings`);
    } else throw new Error('This design is signed');
  });
}

/** Search terms for the evidence boundary: one model call; LabNest runs the search itself (Q311). */
export function draftSearchTerms(input: DesignRunView, deps: DesignDeps): Promise<DesignRunView> {
  return withModel(input, deps, async (run, ask) => {
    const hypotheses = run.state.hypotheses?.draft;
    if (!hypotheses) throw new Error('Draft the hypotheses first');
    const queries = (await ask(deps.complete, termsPrompt(confirmedContext(run.state), hypotheses), parseTerms)).value;
    run.state.evidence = { ...(run.state.evidence ?? emptyLedger()), queries };
    ask.log('model', `Search terms drafted: ${queries.join(' · ')}`);
  });
}

/**
 * One search result read by the model. The quote it gives is looked up in `text`, the abstract or full text that was
 * sent; the paper then enters the ledger as an entry the author still has to confirm. An irrelevant paper adds none.
 */
export function readFoundPaper(input: DesignRunView, deps: DesignDeps, key: string, source: { text: string; read: 'abstract' | 'fulltext' }): Promise<DesignRunView> {
  return withModel(input, deps, async (run, ask) => {
    const ledger = run.state.evidence ?? emptyLedger();
    const paper = ledger.found.find(item => item.key === key);
    if (!paper) throw new Error('This paper is not in the search results');
    const statements = ledgerStatements(run.state.hypotheses?.draft, run.state.chain?.draft);
    try {
      const { value, model } = await ask(deps.complete, readPrompt(statements, paper, source.text), readingReader(source.text, statements.map(item => item.id)));
      paper.status = value.relevant ? 'read' : 'irrelevant';
      paper.note = value.relevant ? undefined : value.note || undefined;
      if (value.relevant) {
        const entry: EvidenceEntry = {
          id: nextEntryId(ledger), found: 'search', database: paper.database, pmid: paper.pmid, pmcid: paper.pmcid, doi: paper.doi, title: paper.title, year: paper.year, venue: paper.venue, url: paper.url,
          exists: 'yes', retracted: paper.retracted, quote: value.quote, read: source.read, quoteFound: value.quoteFound,
          target: value.target, relation: value.relation, system: value.system, note: value.note, confirmed: false, checkedAt: deps.now().toISOString(), model,
        };
        ledger.entries.push(entry);
        ask.log('model', `Read ${paper.title.slice(0, 80)}: ${value.quoteFound ? 'quote found' : 'quote not found'}`);
      } else ask.log('model', `Read ${paper.title.slice(0, 80)}: not relevant`);
    } catch (error) {
      paper.status = 'failed';
      paper.note = error instanceof Error ? error.message.slice(0, 200) : 'Could not read it';
      throw error;
    } finally {
      run.state.evidence = ledger;
    }
  });
}

export const nextEntryId = (ledger: Ledger) => `e${Math.max(0, ...ledger.entries.map(entry => Number(entry.id.slice(1)) || 0)) + 1}`;
/** How many papers were read in full so far: past three, the rest are read from their abstracts. */
export const fullTextsLeft = (ledger?: Ledger) => MAX_FULL_TEXTS - (ledger?.entries ?? []).filter(entry => entry.found === 'search' && entry.read === 'fulltext').length;

function confirmedContext(state: DesignState) {
  if (!state.context?.confirmedAt) throw new Error('Confirm the context card first');
  return state.context.card;
}
/** Under v2 the chain is built on the confirmed hypotheses; v1 runs have none. */
function confirmedHypotheses(run: DesignRunView) {
  if (!stepsOf(run.spec).includes('hypotheses')) return undefined;
  if (!run.state.hypotheses?.confirmedAt || !run.state.hypotheses.draft) throw new Error('Confirm the hypotheses first');
  return run.state.hypotheses.draft;
}
function confirmedChain(state: DesignState) {
  if (!state.chain?.confirmedAt || !state.chain.draft || !state.chain.tier) throw new Error('Confirm the evidence chain first');
  return { chain: state.chain.draft, tier: state.chain.tier };
}

/** What the author may do between model steps. Each returns the next step and state, or refuses. */
export type DesignAction =
  | { kind: 'include'; itemId: string; included: boolean }
  | { kind: 'context'; card: unknown }
  | { kind: 'hypotheses'; hypotheses: unknown }
  | { kind: 'template'; templateId: string }
  | { kind: 'chain'; chain: unknown; tier: Tier }
  | { kind: 'card'; card: unknown }
  | { kind: 'confirm' }
  | { kind: 'reopen'; step: DesignStep }
  | { kind: 'finding'; findingId: string; status: 'open' | 'resolved' | 'waived'; reason?: string }
  | { kind: 'waive'; key: string; reason: string }
  | { kind: 'queries'; queries: string[] }
  | { kind: 'evidence'; entryId: string; patch: Partial<Pick<EvidenceEntry, 'target' | 'relation' | 'system' | 'note' | 'confirmed'>> }
  | { kind: 'evidence-remove'; entryId: string };

/** The ledger can change from ② on, until the design is signed. */
export const ledgerOpen = (run: Pick<DesignRunView, 'spec' | 'step'>) => run.step !== 'signed' && run.step !== 'context' && stepsOf(run.spec).includes('hypotheses');

export function applyAction(run: DesignRunView, action: DesignAction, now: Date): { step: DesignRunView['step']; state: DesignState } {
  if (run.step === 'signed') throw new Error('This design is signed; start a new design to change it');
  const steps = stepsOf(run.spec);
  const state = structuredClone(run.state);
  let step = run.step;
  const at = now.toISOString();
  const only = (...allowed: DesignStep[]) => { if (!allowed.includes(step as DesignStep)) throw new Error('This step is not open'); };
  const entryOf = (entryId: string) => {
    if (!ledgerOpen(run)) throw new Error('The evidence ledger opens with the hypotheses');
    const entry = state.evidence?.entries.find(item => item.id === entryId);
    if (!entry) throw new Error('This paper is not in the ledger');
    return entry;
  };
  switch (action.kind) {
    case 'include': {
      only('context');
      const item = state.gathered?.find(entry => entry.id === action.itemId);
      if (!item) throw new Error('This record is not in the context');
      item.included = action.included;
      break;
    }
    case 'context': {
      only('context');
      if (!state.context) throw new Error('Draft the context card first');
      const card = contextCardSchema.parse(action.card);
      const before = state.context.card;
      card.states = Object.fromEntries(contextFields.map(field => [field, card[field] !== before[field] ? (String(card[field]).trim() ? 'confirmed' : 'pending') : before.states[field] ?? 'pending']));
      state.context = { card };
      break;
    }
    case 'hypotheses': {
      only('hypotheses');
      if (!state.hypotheses?.draft) throw new Error('Draft the hypotheses first');
      const draft = hypothesesSchema.parse(action.hypotheses);
      if (new Set(draft.rivals.map(rival => rival.id)).size !== draft.rivals.length) throw new Error('Two counter-explanations share an id');
      state.hypotheses = { draft };
      break;
    }
    case 'template':
      only('chain');
      if (!templateById(action.templateId)) throw new Error('No such template');
      state.chain = { ...(state.chain ?? { templateVersion: 1 }), templateId: action.templateId, templateVersion: templateById(action.templateId)!.version };
      break;
    case 'chain': {
      only('chain');
      if (!state.chain) throw new Error('Draft the evidence chain first');
      if (!tiers.includes(action.tier)) throw new Error('Choose a tier');
      const chain = chainSchema.parse(action.chain);
      // The rivals belong to ②: an edit of the chain cannot change them.
      const hypotheses = state.hypotheses?.confirmedAt ? state.hypotheses.draft : undefined;
      state.chain = { ...state.chain, draft: hypotheses ? { ...chain, hypothesis: hypotheses.main.statement, alternatives: hypotheses.rivals.map(rival => ({ id: rival.id, text: rival.statement, exclude: rival.exclude })) } : chain, tier: action.tier };
      break;
    }
    case 'card': {
      only('cards', 'review');
      const card = withComputedN(designCardSchema.parse(action.card));
      const before = state.cards?.items.find(item => item.blockId === card.blockId);
      if (!before) throw new Error('This block has no design card');
      if (stableJson({ ...before, confirmed: false }) === stableJson({ ...card, confirmed: false })) break;
      state.cards!.items = state.cards!.items.map(item => item.blockId === card.blockId ? { ...card, confirmed: item.confirmed } : item);
      state.cards!.edited = { ...state.cards!.edited, [card.blockId]: at };
      break;
    }
    case 'confirm': {
      const next = steps[steps.indexOf(step as DesignStep) + 1];
      if (step === 'context') {
        if (!state.context) throw new Error('Draft the context card first');
        const missing = requiredContextFields.filter(field => !String(state.context!.card[field]).trim());
        if (missing.length) throw new Error(`Fill in before confirming: ${missing.join(', ')}`);
        const card = state.context.card;
        card.states = Object.fromEntries(contextFields.map(field => [field, card.states[field] === 'ai' ? 'confirmed' : card.states[field] ?? 'pending']));
        state.context.confirmedAt = at;
        const template = suggestTemplate(`${run.purpose} ${card.question} ${card.subject}`, card.claimType);
        state.chain = state.chain?.draft ? state.chain : { templateId: template.id, templateVersion: template.version };
      } else if (step === 'hypotheses') {
        if (!state.hypotheses?.draft) throw new Error('Draft the hypotheses first');
        const serious = checkHypotheses(state.hypotheses.draft, state.context?.card.claimType ?? '').filter(finding => finding.severity === 'serious');
        if (serious.length) throw new Error(serious[0].text);
        state.hypotheses.confirmedAt = at;
        state.evidence ??= emptyLedger();
      } else if (step === 'chain') {
        if (!state.chain?.draft || !state.chain.tier) throw new Error('Draft the evidence chain first');
        const required = requiredBlocks(state.chain.draft, state.chain.tier);
        if (!required.length) throw new Error('No block is required at this tier');
        if (required.length > MAX_REQUIRED_BLOCKS) throw new Error(`At most ${MAX_REQUIRED_BLOCKS} required blocks: make some optional`);
        state.chain.confirmedAt = at;
        state.cards = { items: (state.cards?.items ?? []).filter(card => required.some(block => block.id === card.blockId)), edited: state.cards?.edited, editedAt: state.cards?.editedAt };
      } else if (step === 'cards') {
        const { chain, tier } = confirmedChain(state);
        const missing = requiredBlocks(chain, tier).filter(block => !state.cards?.items.some(card => card.blockId === block.id));
        if (missing.length) throw new Error(`Draft the remaining design cards first: ${missing.map(block => block.title).join(', ')}`);
        const unfinished = unfinishedCards(state.cards!.items);
        if (unfinished.length) throw new Error(`Needs a group and a readout: ${unfinished.map(card => card.title).join(', ')}`);
        state.cards!.items = state.cards!.items.map(card => ({ ...card, confirmed: true }));
        state.cards!.confirmedAt = at;
      } else throw new Error('Sign the design to finish this step');
      step = next;
      break;
    }
    case 'reopen': {
      const target = steps.indexOf(action.step), current = steps.indexOf(step as DesignStep);
      if (target < 0 || target >= current) throw new Error('Only an earlier step can be reopened');
      // Reopening a step reopens every later one; the review goes once anything it read can change.
      const reopened = steps.slice(target);
      if (reopened.includes('context') && state.context) delete state.context.confirmedAt;
      if (reopened.includes('hypotheses') && state.hypotheses) delete state.hypotheses.confirmedAt;
      if (reopened.includes('chain') && state.chain) { delete state.chain.confirmedAt; delete state.review; }
      if (reopened.includes('cards') && state.cards) delete state.cards.confirmedAt;
      step = action.step;
      break;
    }
    case 'finding': {
      only('review');
      const round = state.review?.rounds.at(-1);
      const finding = round?.findings.find(item => item.id === action.findingId);
      if (!round || !finding) throw new Error('This finding is not in the latest review');
      const reason = action.reason?.trim();
      if (action.status === 'waived' && !reason) throw new Error('Say why this finding does not apply');
      // A finding about one card is fixed only by changing that card; one about the whole design, by changing anything it read.
      const card = state.cards?.items.find(item => item.blockId === finding.blockId);
      const changed = card ? cardChanged(state, round, card) : changedSinceReview(state).length > 0;
      if (action.status === 'resolved' && finding.severity === 'critical' && !changed) throw new Error('Change the design card first, or waive the finding with a reason');
      Object.assign(finding, { status: action.status, reason: action.status === 'open' ? undefined : reason });
      break;
    }
    case 'waive':
      only('review');
      state.waivers = { ...state.waivers };
      if (action.reason.trim()) state.waivers[action.key] = action.reason.trim().slice(0, 600); else delete state.waivers[action.key];
      break;
    case 'queries': {
      if (!ledgerOpen(run)) throw new Error('The evidence ledger opens with the hypotheses');
      const queries = [...new Set(action.queries.map(query => query.trim().replace(/\s+/g, ' ')).filter(Boolean))].slice(0, 3);
      if (queries.some(query => query.length > 160)) throw new Error('A search term is too long');
      state.evidence = { ...(state.evidence ?? emptyLedger()), queries };
      break;
    }
    case 'evidence': {
      const entry = entryOf(action.entryId);
      const patch = action.patch;
      if (patch.relation !== undefined && !relations.includes(patch.relation)) throw new Error('Choose how the paper bears on it');
      if (patch.target !== undefined && !ledgerTargets(state).includes(patch.target)) throw new Error('Choose what the paper bears on');
      Object.assign(entry, {
        ...(patch.target !== undefined ? { target: patch.target } : {}), ...(patch.relation !== undefined ? { relation: patch.relation } : {}),
        ...(patch.system !== undefined ? { system: patch.system.trim().slice(0, 300) } : {}), ...(patch.note !== undefined ? { note: patch.note.trim().slice(0, 600) } : {}),
        ...(patch.confirmed !== undefined ? { confirmed: patch.confirmed } : {}),
      });
      break;
    }
    case 'evidence-remove':
      entryOf(action.entryId);
      state.evidence!.entries = state.evidence!.entries.filter(item => item.id !== action.entryId);
      break;
  }
  return { step, state };
}

/** What an entry can bear on: the main hypothesis, each rival, each block of the chain, or the background. */
export const ledgerTargets = (state: DesignState) => [...ledgerStatements(state.hypotheses?.draft, state.chain?.draft).map(item => item.id), 'background'];

export const designRules = (state: DesignState) =>
  state.cards && state.chain?.draft && state.chain.tier ? checkCards(state.cards.items, state.chain.draft, state.chain.tier, state.hypotheses?.confirmedAt ? state.hypotheses.draft : undefined) : [];

/**
 * Why the design cannot be signed yet, if anything stops it: a card with no group or readout, no review, anything the
 * review read changed since while a round is left, an open critical finding, an unwaived serious rule. Once both rounds
 * are used, later changes are signed as not reviewed again and written into the limitations.
 */
export function signBlockers(state: DesignState) {
  const problems: string[] = [];
  if (!state.cards?.confirmedAt) problems.push('Confirm the design cards');
  for (const card of unfinishedCards(state.cards?.items ?? [])) problems.push(`Needs a group and a readout: ${card.title}`);
  const rounds = state.review?.rounds ?? [];
  const round = rounds.at(-1);
  if (!round) problems.push('Run the review');
  const changed = changedSinceReview(state);
  if (changed.length && rounds.length < MAX_REVIEW_ROUNDS) problems.push(`Changed after review round ${rounds.length}, review again: ${changed.join(', ')}`);
  for (const finding of round?.findings ?? []) if (finding.severity === 'critical' && finding.status === 'open') problems.push(`Critical review finding: ${finding.problem}`);
  for (const finding of blockingRules(designRules(state), state.waivers)) problems.push(`Rule ${finding.rule}: ${finding.text}`);
  return problems;
}

/** A short fingerprint of an artifact's content (FNV-1a over its sorted JSON). */
const fingerprint = (value: unknown) => {
  const json = stableJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < json.length; index += 1) { hash ^= json.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(36);
};
const cardContent = (card: DesignCard) => ({ ...card, confirmed: undefined, drift: undefined });

/** What a review round reads, by artifact: the round holds for these versions only (§14.2, the review bound to its content). */
export function reviewedContent(state: DesignState): Record<string, string> {
  const content: Record<string, string> = {};
  if (state.context) content.context = fingerprint({ ...state.context.card, states: undefined, questions: undefined });
  if (state.hypotheses?.draft) content.hypotheses = fingerprint({ ...state.hypotheses.draft, drift: undefined });
  if (state.chain?.draft) content.chain = fingerprint({ ...state.chain.draft, drift: undefined, tier: state.chain.tier });
  for (const card of state.cards?.items ?? []) content[`card:${card.blockId}`] = fingerprint(cardContent(card));
  if (state.evidence) content.evidence = fingerprint(verifiedEntries(state.evidence).map(({ id, target, relation, quote, title }) => ({ id, target, relation, quote, title })));
  return content;
}

const artifactLabels: Record<string, string> = { context: stepLabels.context, hypotheses: stepLabels.hypotheses, chain: stepLabels.chain, evidence: 'Evidence ledger' };

/** What changed after the latest review round, by name: the cards by title. Rounds before v2 compare card edit times. */
export function changedSinceReview(state: DesignState): string[] {
  const round = state.review?.rounds.at(-1);
  if (!round) return [];
  if (!round.seen) return (state.cards?.items ?? []).filter(card => editedSince(state, card, round.at)).map(card => card.title);
  const now = reviewedContent(state);
  return Object.keys(now).filter(key => now[key] !== round.seen![key]).map(key => key.startsWith('card:') ? state.cards!.items.find(card => `card:${card.blockId}` === key)!.title : artifactLabels[key] ?? key);
}

function cardChanged(state: DesignState, round: ReviewRound, card: DesignCard) {
  return round.seen ? round.seen[`card:${card.blockId}`] !== fingerprint(cardContent(card)) : editedSince(state, card, round.at);
}
const editedSince = (state: DesignState, card: DesignCard, at: string) => (state.cards?.edited?.[card.blockId] ?? state.cards?.editedAt ?? '') > at;

/** Cards no planned experiment can be made from: nothing to compare, or nothing measured. */
const unfinishedCards = (cards: DesignCard[]) => cards.filter(card => !card.groups.length || !card.readouts.length);
