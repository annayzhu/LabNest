import { blockingRules, checkCards } from './rules';
import { cardPrompt, chainPrompt, contextPrompt, parseCard, parseChain, parseContext, parseReview, reviewPrompt, type ProtocolChoice } from './prompts';
import {
  chainSchema, contextCardSchema, contextFields, designCardSchema, designSteps, MAX_DESIGN_LOG, MAX_REQUIRED_BLOCKS, MAX_REVIEW_ROUNDS, requiredBlocks, requiredContextFields, tiers,
  type DesignEvent, type DesignRunView, type DesignState, type DesignStep, type ReviewFinding, type Tier,
} from './spec';
import { suggestTemplate, templateById } from './templates';

type Complete = (system: string, user: string) => Promise<{ text: string; model?: string }>;
/** What a model step needs: the drafting model, the reviewing one (the same model when none is set), the plan's Protocols. */
export type DesignDeps = { complete: Complete; review: { complete: Complete; provider: string; selfReview: boolean }; protocols: ProtocolChoice[]; now: () => Date };

/**
 * One model step: draft the context card, the chain, one design card (the given block or the next one missing), or a
 * review round. The run comes back changed, never mutated; a failure marks it failed with the state as it was, so the
 * same step can be tried again. No step confirms anything: the author does (Q311).
 */
export async function runModelStep(input: DesignRunView, deps: DesignDeps, options: { blockId?: string } = {}): Promise<DesignRunView> {
  const run = structuredClone(input);
  const state = run.state;
  const log = (kind: DesignEvent['kind'], text: string) => { run.log.push({ at: deps.now().toISOString(), step: run.step, kind, text }); run.log.splice(0, Math.max(0, run.log.length - MAX_DESIGN_LOG)); };
  const structured = async <T,>(complete: Complete, system: string, user: string, read: (text: string) => T) => {
    run.modelCalls += 1;
    const first = await complete(system, user);
    if (complete === deps.complete) run.model ??= first.model;
    try { return { value: read(first.text), model: first.model }; } catch (error) {
      log('note', `The answer could not be read (${error instanceof Error ? error.message.slice(0, 120) : 'unknown'}); asked again`);
      run.modelCalls += 1;
      const second = await complete(system, `${user}\n\n你上一次的回答无法解析：${error instanceof Error ? error.message.slice(0, 300) : ''}\n请只输出要求的 JSON 对象。`);
      return { value: read(second.text), model: second.model };
    }
  };
  run.error = undefined;
  try {
    if (run.step === 'context') {
      const items = (state.gathered ?? []).filter(item => item.included);
      const prompt = contextPrompt(run.purpose, items);
      state.context = { card: (await structured(deps.complete, prompt.system, prompt.user, parseContext)).value };
      log('model', `Context card drafted from ${items.length} LabNest records`);
    } else if (run.step === 'chain') {
      const context = confirmedContext(state);
      const template = templateById(state.chain?.templateId ?? '') ?? suggestTemplate(`${run.purpose} ${context.question}`, context.claimType);
      const prompt = chainPrompt(context, template);
      const draft = (await structured(deps.complete, prompt.system, prompt.user, parseChain)).value;
      state.chain = { templateId: template.id, templateVersion: template.version, draft, tier: draft.recommendedTier };
      log('model', `Evidence chain drafted from template ${template.label}: ${draft.blocks.length} blocks`);
    } else if (run.step === 'cards') {
      const { chain, tier } = confirmedChain(state);
      const required = requiredBlocks(chain, tier);
      const block = options.blockId ? required.find(item => item.id === options.blockId) : required.find(item => !state.cards?.items.some(card => card.blockId === item.id));
      if (!block) throw new Error('Every required block already has a design card');
      const prompt = cardPrompt(confirmedContext(state), chain, tier, block, deps.protocols);
      const card = (await structured(deps.complete, prompt.system, prompt.user, text => parseCard(text, block, deps.protocols))).value;
      state.cards ??= { items: [] };
      state.cards.items = [...state.cards.items.filter(item => item.blockId !== block.id), card].sort((a, b) => required.findIndex(item => item.id === a.blockId) - required.findIndex(item => item.id === b.blockId));
      state.cards.editedAt = deps.now().toISOString();
      log('model', `Design card drafted: ${card.title}`);
    } else if (run.step === 'review') {
      const { chain, tier } = confirmedChain(state);
      if (!state.cards?.confirmedAt) throw new Error('Confirm the design cards first');
      const rounds = state.review?.rounds ?? [];
      if (rounds.length >= MAX_REVIEW_ROUNDS) throw new Error('Two review rounds are done; what is left goes into the limitations');
      const prompt = reviewPrompt(confirmedContext(state), chain, tier, state.cards.items, checkCards(state.cards.items, chain, tier), rounds.length + 1);
      const { value, model } = await structured(deps.review.complete, prompt.system, prompt.user, parseReview);
      const at = deps.now().toISOString();
      state.review = { rounds: [...rounds, { at, provider: deps.review.provider, model, selfReview: deps.review.selfReview, verdict: value.verdict, dimensions: value.dimensions,
        findings: value.findings.map((finding, index): ReviewFinding => ({ ...finding, id: `${rounds.length + 1}-${index + 1}`, status: 'open' })) }] };
      log('model', `Review round ${rounds.length + 1}: ${value.verdict}, ${value.findings.length} findings`);
    } else throw new Error('This design is signed');
    run.status = 'idle';
  } catch (error) {
    run.status = 'failed';
    run.error = error instanceof Error ? error.message.slice(0, 500) : 'The step did not finish; try again';
    log('error', run.error);
  }
  return run;
}

function confirmedContext(state: DesignState) {
  if (!state.context?.confirmedAt) throw new Error('Confirm the context card first');
  return state.context.card;
}
function confirmedChain(state: DesignState) {
  if (!state.chain?.confirmedAt || !state.chain.draft || !state.chain.tier) throw new Error('Confirm the evidence chain first');
  return { chain: state.chain.draft, tier: state.chain.tier };
}

/** What the author may do between model steps. Each returns the next step and state, or refuses. */
export type DesignAction =
  | { kind: 'include'; itemId: string; included: boolean }
  | { kind: 'context'; card: unknown }
  | { kind: 'template'; templateId: string }
  | { kind: 'chain'; chain: unknown; tier: Tier }
  | { kind: 'card'; card: unknown }
  | { kind: 'confirm' }
  | { kind: 'reopen'; step: DesignStep }
  | { kind: 'finding'; findingId: string; status: 'open' | 'resolved' | 'waived'; reason?: string }
  | { kind: 'waive'; key: string; reason: string };

export function applyAction(run: DesignRunView, action: DesignAction, now: Date): { step: DesignRunView['step']; state: DesignState } {
  if (run.step === 'signed') throw new Error('This design is signed; start a new design to change it');
  const state = structuredClone(run.state);
  let step = run.step;
  const at = now.toISOString();
  const only = (...steps: DesignStep[]) => { if (!steps.includes(step as DesignStep)) throw new Error('This step is not open'); };
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
    case 'template':
      only('chain');
      if (!templateById(action.templateId)) throw new Error('No such template');
      state.chain = { ...(state.chain ?? { templateVersion: 1 }), templateId: action.templateId, templateVersion: templateById(action.templateId)!.version };
      break;
    case 'chain': {
      only('chain');
      if (!state.chain) throw new Error('Draft the evidence chain first');
      if (!tiers.includes(action.tier)) throw new Error('Choose a tier');
      state.chain = { ...state.chain, draft: chainSchema.parse(action.chain), tier: action.tier };
      break;
    }
    case 'card': {
      only('cards', 'review');
      const card = designCardSchema.parse(action.card);
      if (!state.cards?.items.some(item => item.blockId === card.blockId)) throw new Error('This block has no design card');
      state.cards.items = state.cards.items.map(item => item.blockId === card.blockId ? card : item);
      state.cards.editedAt = at;
      break;
    }
    case 'confirm':
      if (step === 'context') {
        if (!state.context) throw new Error('Draft the context card first');
        const missing = requiredContextFields.filter(field => !String(state.context!.card[field]).trim());
        if (missing.length) throw new Error(`Fill in before confirming: ${missing.join(', ')}`);
        const card = state.context.card;
        card.states = Object.fromEntries(contextFields.map(field => [field, card.states[field] === 'ai' ? 'confirmed' : card.states[field] ?? 'pending']));
        state.context.confirmedAt = at;
        const template = suggestTemplate(`${run.purpose} ${card.question} ${card.subject}`, card.claimType);
        state.chain = state.chain?.draft ? state.chain : { templateId: template.id, templateVersion: template.version };
        step = 'chain';
      } else if (step === 'chain') {
        if (!state.chain?.draft || !state.chain.tier) throw new Error('Draft the evidence chain first');
        const required = requiredBlocks(state.chain.draft, state.chain.tier);
        if (!required.length) throw new Error('No block is required at this tier');
        if (required.length > MAX_REQUIRED_BLOCKS) throw new Error(`At most ${MAX_REQUIRED_BLOCKS} required blocks: make some optional`);
        state.chain.confirmedAt = at;
        state.cards = { items: (state.cards?.items ?? []).filter(card => required.some(block => block.id === card.blockId)), editedAt: state.cards?.editedAt };
        step = 'cards';
      } else if (step === 'cards') {
        const { chain, tier } = confirmedChain(state);
        const missing = requiredBlocks(chain, tier).filter(block => !state.cards?.items.some(card => card.blockId === block.id));
        if (missing.length) throw new Error(`Draft the remaining design cards first: ${missing.map(block => block.title).join(', ')}`);
        state.cards!.items = state.cards!.items.map(card => ({ ...card, confirmed: true }));
        state.cards!.confirmedAt = at;
        step = 'review';
      } else throw new Error('Sign the design to finish this step');
      break;
    case 'reopen': {
      const target = designSteps.indexOf(action.step), current = designSteps.indexOf(step as DesignStep);
      if (target < 0 || target >= current) throw new Error('Only an earlier step can be reopened');
      if (target <= designSteps.indexOf('context') && state.context) delete state.context.confirmedAt;
      if (target <= designSteps.indexOf('chain') && state.chain) { delete state.chain.confirmedAt; delete state.review; }
      if (target <= designSteps.indexOf('cards') && state.cards) delete state.cards.confirmedAt;
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
      if (action.status === 'resolved' && finding.severity === 'critical' && !(state.cards?.editedAt && state.cards.editedAt > round.at)) throw new Error('Change the design card first, or waive the finding with a reason');
      Object.assign(finding, { status: action.status, reason: action.status === 'open' ? undefined : reason });
      break;
    }
    case 'waive':
      only('review');
      state.waivers = { ...state.waivers };
      if (action.reason.trim()) state.waivers[action.key] = action.reason.trim().slice(0, 600); else delete state.waivers[action.key];
      break;
  }
  return { step, state };
}

export const designRules = (state: DesignState) =>
  state.cards && state.chain?.draft && state.chain.tier ? checkCards(state.cards.items, state.chain.draft, state.chain.tier) : [];

/** Why the design cannot be signed yet, if anything stops it: no review, an open critical finding, an unwaived serious rule. */
export function signBlockers(state: DesignState) {
  const problems: string[] = [];
  if (!state.cards?.confirmedAt) problems.push('Confirm the design cards');
  const round = state.review?.rounds.at(-1);
  if (!round) problems.push('Run the review');
  for (const finding of round?.findings ?? []) if (finding.severity === 'critical' && finding.status === 'open') problems.push(`Critical review finding: ${finding.problem}`);
  for (const finding of blockingRules(designRules(state), state.waivers)) problems.push(`Rule ${finding.rule}: ${finding.text}`);
  return problems;
}
