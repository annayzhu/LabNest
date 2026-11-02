import { requiredBlocks, type Chain, type DesignCard, type Tier } from './spec';

/**
 * The design rules (Q304), run by the program on every read of the cards, never by the model. A serious finding blocks
 * sign-off until the card is fixed or the author writes why it does not apply. Rule 8 paraphrases MIQE 2.0 (Clin Chem 2025).
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

export function checkCards(cards: DesignCard[], chain: Chain, tier: Tier): RuleFinding[] {
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
