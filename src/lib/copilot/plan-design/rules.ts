import { planSampleSize } from './sample-size';
import { requiredBlocks, sampleSizeOf, type Chain, type ClaimType, type DesignCard, type Hypotheses, type Tier } from './spec';

/**
 * The design rules (Q304), run by the program on every read of the cards, never by the model. A serious finding blocks
 * sign-off until the card is fixed or the author writes why it does not apply. Rule 8 paraphrases MIQE 2.0 (Clin Chem 2025).
 * Rules 13–15 are the structural mistakes K-Dense experimental-design lists (no randomization, nuisance variables left
 * unblocked, factors that cannot be estimated apart); 16–17 come from statistical-power; 18 ties each rival the author
 * chose to rule out to a control or a block (Q303). A finding with no block is about the whole design.
 */
export type RuleSeverity = 'serious' | 'important' | 'minor';
export type RuleFinding = { key: string; rule: number; severity: RuleSeverity; blockId: string; field: string; text: string };

/** Method names as people write them, so a readout matches however it is spelled. */
export const methodSynonyms: Record<'qpcr' | 'western_blot' | 'imaging', RegExp> = {
  qpcr: /\bq-?PCR\b|\bRT-?q?PCR\b|real[- ]time PCR|实时荧光定量|荧光定量 ?PCR|定量 ?PCR/i,
  western_blot: /western ?blot(?:ting)?|\bWB\b|免疫印迹|蛋白印迹/i,
  imaging: /免疫荧光|\bIF\b|immunofluorescen|confocal|共聚焦|显微镜|成像|imaging|划痕|wound healing|transwell.*(?:计数|拍照)|IHC|免疫组化/i,
};

const usesAssay = (card: DesignCard, assay: keyof typeof methodSynonyms) =>
  card.readouts.some(readout => readout.assay === assay || methodSynonyms[assay].test(`${readout.name} ${readout.method}`));
const filled = (value: string) => value.trim().length > 0;
const manipulates = (card: DesignCard) => ['knockdown', 'knockout', 'overexpression'].includes(card.manipulation.kind);

export function checkCards(cards: DesignCard[], chain: Chain, tier: Tier, hypotheses?: Hypotheses): RuleFinding[] {
  const findings: RuleFinding[] = [];
  const add = (rule: number, severity: RuleSeverity, card: DesignCard, field: string, text: string) => findings.push({ key: `r${rule}:${card.blockId}`, rule, severity, blockId: card.blockId, field, text });
  const blocks = new Map(chain.blocks.map(block => [block.id, block]));
  const reaches = (from: string, target: (id: string) => boolean, seen = new Set<string>()): boolean => {
    for (const id of [...(cards.find(card => card.blockId === from)?.dependsOn ?? []), ...(blocks.get(from)?.dependsOn ?? [])]) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (target(id) || reaches(id, target, seen)) return true;
    }
    return false;
  };
  const hasRescue = chain.blocks.some(block => block.kind === 'specificity' && /拯救|回补|rescue/i.test(block.title));
  const required = new Set(requiredBlocks(chain, tier).map(block => block.id));

  for (const card of cards) {
    const kind = blocks.get(card.blockId)?.kind;
    if (!card.controls.some(control => ['negative', 'vehicle', 'empty_vector', 'isotype'].includes(control.kind) && control.concurrent))
      add(1, 'serious', card, 'controls', 'No concurrent negative control: add one run alongside the treated groups');
    if (kind === 'phenotype' && manipulates(card) && !filled(card.manipulation.efficiencyCheck) && !reaches(card.blockId, id => blocks.get(id)?.kind === 'manipulation'))
      add(2, 'serious', card, 'manipulation', 'The phenotype is read before the manipulation is shown to work: verify the efficiency first, or in the same experiment');
    if (card.manipulation.kind === 'knockdown' && (card.manipulation.independentReagents ?? 0) < 2 && !hasRescue)
      add(3, 'important', card, 'manipulation', 'Only one siRNA and no rescue: use a second independent siRNA or add a rescue experiment');
    if (card.manipulation.kind === 'overexpression' && !card.controls.some(control => control.kind === 'empty_vector'))
      add(4, 'important', card, 'controls', 'Overexpression without an empty-vector control');
    if (card.unit.nCounts === 'technical' || card.unit.nCounts === 'wells')
      add(5, 'serious', card, 'unit', 'Wells or technical replicates are counted as n: n is the number of independent biological replicates');
    if (card.replicates.biological === null || card.replicates.biological < 3)
      add(6, 'minor', card, 'replicates', 'Fewer than 3 biological replicates, or none stated');
    if (card.groups.length > 2 && !filled(card.analysis.multipleComparison))
      add(7, 'important', card, 'analysis', 'More than two groups and no correction for multiple comparisons');
    if (usesAssay(card, 'qpcr') && card.referenceGenes.length < 2)
      add(8, 'important', card, 'referenceGenes', 'qPCR with fewer than two reference genes: MIQE 2.0 asks for reference genes validated as stable in this system');
    if (usesAssay(card, 'western_blot') && (!filled(card.loadingControl) || !filled(card.normalization)))
      add(9, 'important', card, 'loadingControl', 'Western blot without a loading control or a stated normalization for quantification');
    if (usesAssay(card, 'imaging') && !filled(card.blinding))
      add(10, 'minor', card, 'blinding', 'Image quantification without blinding');
    if (!card.criteria.length)
      add(11, 'serious', card, 'criteria', 'No decision criteria: write them before the experiment starts');
    if (card.groups.some(group => !filled(group.treatment)))
      add(12, 'important', card, 'groups', 'A group has no treatment');
    if (card.groups.length >= 2 && !filled(card.randomization))
      add(13, 'important', card, 'randomization', 'No randomization: say how dishes, wells or plate positions are assigned to the groups');
    if ((card.replicates.biological ?? 0) >= 2 && !filled(card.batch))
      add(14, 'important', card, 'batch', 'Batches not planned: run each independent replicate on its own day or passage, with every group in each batch');
    const combinations = card.factors.length >= 2 ? card.factors.reduce((product, factor) => product * Math.max(1, factor.levels.length), 1) : 0;
    if (combinations && card.groups.length < combinations)
      add(15, 'important', card, 'factors', `The groups cover ${card.groups.length} of the ${combinations} combinations of the factors, so their effects and interaction cannot be told apart`);
    const size = sampleSizeOf(card), plan = planSampleSize(card);
    if ((size.basis === 'minimum_effect' || size.basis === 'pilot') && plan.missing === 'effect')
      add(16, 'important', card, 'sampleSize', 'The sample size has a basis but no effect: give the difference worth finding and its SD, or the effect size');
    if (plan.enrolled && card.replicates.biological !== null && card.replicates.biological < plan.enrolled)
      add(17, 'important', card, 'replicates', `Planned ${card.replicates.biological} biological replicates per group; the sample-size calculation needs ${plan.enrolled}`);
  }
  for (const rival of hypotheses?.rivals ?? []) {
    if (!rival.exclude) continue;
    const covered = requiredBlocks(chain, tier).some(block => block.addresses.includes(rival.id)) || cards.some(card => card.controls.some(control => control.addresses.includes(rival.id)));
    if (!covered) findings.push({ key: `r18:${rival.id}`, rule: 18, severity: 'important', blockId: '', field: 'controls', text: `Nothing rules out “${rival.statement}”: tie it to a control or a required block` });
  }
  // Rule 2 also covers order: a required phenotype block whose manipulation block is not required runs unverified.
  for (const block of chain.blocks) if (block.kind === 'phenotype' && required.has(block.id)) {
    const missing = block.dependsOn.filter(id => blocks.get(id)?.kind === 'manipulation' && !required.has(id));
    const card = cards.find(item => item.blockId === block.id);
    if (missing.length && card && !filled(card.manipulation.efficiencyCheck) && !findings.some(finding => finding.key === `r2:${card.blockId}`)) add(2, 'serious', card, 'dependsOn', 'The block that verifies the manipulation is optional at this tier: make it required');
  }
  return findings;
}

/** Findings that stop the sign-off: serious ones the author has not waived. */
export const blockingRules = (findings: RuleFinding[], waivers: Record<string, string> = {}) =>
  findings.filter(finding => finding.severity === 'serious' && !waivers[finding.key]?.trim());

/** A finding on the hypotheses table (②), shown before it is confirmed. A serious one stops the confirmation. */
export type HypothesisFinding = { key: string; severity: RuleSeverity; rivalId: string; field: string; text: string };

const causalWords = /导致|引起|促进|抑制|调控|介导|驱动|造成|决定|\bcaus(?:e|es|ed|ing)\b|\bdrive[sn]?\b|\bpromot(?:e|es|ed|ing)\b|\binhibit(?:s|ed|ing)?\b|\bregulat(?:e|es|ed|ing)\b|\bmediat(?:e|es|ed|ing)\b|\binduc(?:e|es|ed|ing)\b/i;
const bindingWords = /直接结合|直接相互作用|direct(?:ly)? bind|direct interaction/i;
const same = (a: string, b: string) => a.replace(/[\s，。,.;；]/g, '') === b.replace(/[\s，。,.;；]/g, '');

/**
 * Checks on the discriminating-prediction table (K-Dense hypothesis-generation: every candidate states a result
 * incompatible with it, a test where the rivals predict differently, and what would leave it undecided; claim
 * language matches the claim type). They describe the table; they never score or choose a hypothesis.
 */
export function checkHypotheses(hypotheses: Hypotheses, claimType: ClaimType | ''): HypothesisFinding[] {
  const findings: HypothesisFinding[] = [];
  const main = hypotheses.main;
  if (!filled(main.incompatible)) findings.push({ key: 'h1', severity: 'serious', rivalId: '', field: 'incompatible', text: 'Say what result would count against the main hypothesis: without one it cannot be tested' });
  if (claimType === 'association' && causalWords.test(main.statement)) findings.push({ key: 'h5', severity: 'important', rivalId: '', field: 'statement', text: 'The claim is an association, but the hypothesis is worded as cause and effect' });
  if (claimType === 'interaction' && bindingWords.test(main.statement)) findings.push({ key: 'h6', severity: 'important', rivalId: '', field: 'statement', text: 'The claim is an interaction in a complex; direct binding needs purified proteins' });
  const ruled = hypotheses.rivals.filter(rival => rival.exclude);
  if (ruled.length < 2) findings.push({ key: 'h7', severity: 'minor', rivalId: '', field: 'rivals', text: 'Fewer than two counter-explanations to rule out: list rivals from different classes before choosing tests' });
  for (const rival of ruled) {
    if (!filled(rival.test)) findings.push({ key: `h2:${rival.id}`, severity: 'important', rivalId: rival.id, field: 'test', text: 'No experiment named that tells this explanation from the main hypothesis' });
    else if (filled(rival.ifMain) && filled(rival.ifRival) && same(rival.ifMain, rival.ifRival)) findings.push({ key: `h3:${rival.id}`, severity: 'important', rivalId: rival.id, field: 'ifRival', text: 'Both predict the same result in this test, so it cannot tell them apart' });
    if (!filled(rival.undecided)) findings.push({ key: `h4:${rival.id}`, severity: 'minor', rivalId: rival.id, field: 'undecided', text: 'Say what result would leave it undecided' });
  }
  return findings;
}
