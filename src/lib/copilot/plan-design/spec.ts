import { z } from 'zod';
import { powerDesigns } from '../../stats/power';
import type { Ledger } from './evidence';

/**
 * The research-plan design workbench. Each step ends in an artifact the author edits and confirms: the context card,
 * the hypotheses and predictions, the evidence chain, one design card per required block, and an independent review
 * before sign-off. The next step reads only confirmed artifacts, never a chat history.
 * - plan-design-v1 (Q300–Q312, phase 1): four steps, no hypotheses step. Runs started under it keep their four steps.
 * - plan-design-v2 (Q332, phase 2): adds ② hypotheses and predictions, the evidence ledger, the sample-size
 *   calculation and the detailed review rubric, drawn from the K-Dense skills hypothesis-generation,
 *   experimental-design, statistical-power and scientific-critical-thinking (MIT).
 */
export const DESIGN_SPEC = 'plan-design-v2';
export const designSteps = ['context', 'hypotheses', 'chain', 'cards', 'review'] as const;
export type DesignStep = typeof designSteps[number];
const firstSteps: readonly DesignStep[] = ['context', 'chain', 'cards', 'review'];
/** The steps a run goes through, by the spec it started under. */
export const stepsOf = (spec: string): readonly DesignStep[] => spec === 'plan-design-v1' ? firstSteps : designSteps;
export const stepLabels: Record<DesignStep, string> = { context: 'Context card', hypotheses: 'Hypotheses and predictions', chain: 'Evidence chain', cards: 'Design cards', review: 'Review and sign-off' };
export type RunStep = DesignStep | 'signed';
/** idle: waiting for the author; working: a model step runs; failed: the step can be tried again. */
export type RunStatus = 'idle' | 'working' | 'failed' | 'signed';

const text = (max = 2000) => z.string().trim().max(max).default('');
const list = (max = 2000) => z.array(z.string().trim().min(1).max(max)).max(60).default([]);
/** Rival ids a block or a control rules out. */
const addresses = z.array(z.string().trim().max(8)).max(8).default([]);

export const claimTypes = ['association', 'necessity', 'sufficiency', 'mechanism', 'interaction', 'direct_binding'] as const;
export type ClaimType = typeof claimTypes[number];
export const claimTypeLabels: Record<ClaimType, string> = {
  association: 'Association', necessity: 'Necessity', sufficiency: 'Sufficiency', mechanism: 'Mechanism', interaction: 'Interaction', direct_binding: 'Direct binding',
};

/** Who said a context field: the author, the AI (until the author confirms it), or nobody yet. */
export const fieldStates = ['confirmed', 'ai', 'pending'] as const;
export type FieldState = typeof fieldStates[number];
export const contextFields = ['question', 'claimType', 'subject', 'modelSystem', 'resourcesHave', 'resourcesCanGet', 'resourcesLack', 'constraints', 'outOfScope', 'success', 'priorResults'] as const;
export type ContextField = typeof contextFields[number];
/** Without these the later steps cannot design anything. */
export const requiredContextFields: ContextField[] = ['question', 'claimType', 'subject'];

export const contextCardSchema = z.object({
  question: text(600),
  claimType: z.enum(claimTypes).or(z.literal('')).default(''),
  subject: text(600),
  modelSystem: text(800),
  resourcesHave: text(1500),
  resourcesCanGet: text(1500),
  resourcesLack: text(1500),
  constraints: text(1000),
  outOfScope: text(1000),
  success: text(1000),
  priorResults: text(2000),
  /** Ambiguities that change the design, put to the author as questions. */
  questions: list(400),
  states: z.record(z.string(), z.enum(fieldStates)).default({}),
});
export type ContextCard = z.infer<typeof contextCardSchema>;

/** One piece of LabNest data the context card may send to the model (Q301). The author can leave any of them out. */
export type ContextItem = { id: string; kind: 'plan' | 'experiment' | 'result' | 'protocol' | 'inventory' | 'sample'; label: string; detail: string; included: boolean; href?: string };

/**
 * ② Rivals come from different classes of explanation, not variations of one (hypothesis-generation: "generate rivals
 * before choosing tests"). None is scored, ranked or chosen for the author.
 */
export const rivalKinds = ['mechanism', 'reagent', 'measurement', 'confounding', 'reverse', 'context', 'chance'] as const;
export type RivalKind = typeof rivalKinds[number];
export const rivalKindLabels: Record<RivalKind, string> = {
  mechanism: 'Another mechanism', reagent: 'Reagent or handling artifact', measurement: 'Measurement artifact', confounding: 'Confounding',
  reverse: 'Reverse causation', context: 'Only in this system or condition', chance: 'Chance',
};

export const hypothesesSchema = z.object({
  /** What is estimated: the contrast, the outcome, the system and the time point. */
  estimand: text(600),
  main: z.object({
    statement: z.string().trim().min(2).max(1200),
    mechanism: text(1200),
    predicts: text(800),
    /** A result that would count against it under the stated conditions: without one it cannot be tested. */
    incompatible: text(800),
  }),
  /** The discriminating-prediction table: for each rival, the test that tells it from the main hypothesis. */
  rivals: z.array(z.object({
    id: z.string().trim().regex(/^r\d{1,2}$/),
    statement: z.string().trim().min(2).max(800),
    kind: z.enum(rivalKinds).default('mechanism'),
    test: text(600),
    ifMain: text(600),
    ifRival: text(600),
    undecided: text(600),
    /** Ticked by the author: the design must rule it out with a control or a block. */
    exclude: z.boolean().default(true),
  })).max(8).default([]),
  drift: list(600),
});
export type Hypotheses = z.infer<typeof hypothesesSchema>;
export type Rival = Hypotheses['rivals'][number];

export const blockKinds = ['baseline', 'manipulation', 'phenotype', 'specificity', 'mechanism'] as const;
export type BlockKind = typeof blockKinds[number];
export const tiers = ['light', 'standard', 'publication'] as const;
export type Tier = typeof tiers[number];
export const tierLabels: Record<Tier, string> = { light: 'Light', standard: 'Standard', publication: 'Publication' };

const chainBlockSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]{1,24}$/),
  title: z.string().trim().min(2).max(160),
  kind: z.enum(blockKinds),
  /** The lightest tier that requires the block; above the chosen tier it is optional. */
  minTier: z.enum(tiers).default('standard'),
  purpose: text(800),
  success: text(800),
  failure: text(800),
  fallback: text(800),
  dependsOn: z.array(z.string().trim().max(24)).max(10).default([]),
  addresses,
});
export type ChainBlock = z.infer<typeof chainBlockSchema>;

export const chainSchema = z.object({
  claim: z.string().trim().min(2).max(800),
  hypothesis: text(1200),
  rationale: text(2000),
  minimumEvidence: list(600),
  /** Counter-claims the design must rule out; under v2 they are the confirmed rivals, carried over with their ids. */
  alternatives: z.array(z.object({ id: z.string().trim().max(8).optional(), text: z.string().trim().min(2).max(600), exclude: z.boolean().default(true) })).max(12).default([]),
  blocks: z.array(chainBlockSchema).min(1).max(12),
  recommendedTier: z.enum(tiers).default('standard'),
  /** Places where the model wants to change an earlier confirmed artifact: shown, never applied. */
  drift: list(600),
});
export type Chain = z.infer<typeof chainSchema>;
export const MAX_REQUIRED_BLOCKS = 5;

export const controlKinds = ['negative', 'positive', 'vehicle', 'empty_vector', 'isotype', 'loading', 'reference_gene', 'other'] as const;
export const manipulationKinds = ['none', 'knockdown', 'knockout', 'overexpression', 'drug', 'other'] as const;
export const assays = ['qpcr', 'western_blot', 'imaging', 'flow', 'viability', 'migration', 'elisa', 'co_ip', 'sequencing', 'other'] as const;
export const nCounts = ['biological', 'technical', 'wells', 'animals', 'other'] as const;
export const sampleSizeBases = ['minimum_effect', 'pilot', 'convention', 'pending'] as const;
export type SampleSizeBasis = typeof sampleSizeBases[number];
const count = z.number().int().min(0).max(1000).nullable().default(null);
const amount = z.number().min(-1e9).max(1e9).nullable().default(null);

/**
 * The sample size (Q305, statistical-power): the effect comes first, from the smallest effect worth finding, a pilot or
 * a convention, and the program computes n from it. The model may propose the effect and say where it comes from; it
 * never writes n. With a convention, n is the author's and the program reports the smallest effect it can detect.
 */
export const sampleSizeSchema = z.object({
  n: count,
  basis: z.enum(sampleSizeBases).default('pending'),
  note: text(600),
  design: z.enum(powerDesigns).default('two_groups'),
  /** The difference worth finding and the SD it is measured against, in the readout's units; or the effect size itself. */
  difference: amount,
  sd: amount,
  effect: amount,
  alpha: z.number().min(0.001).max(0.2).default(0.05),
  power: z.number().min(0.5).max(0.99).default(0.8),
  /** Comparisons in the family the α is shared across (Bonferroni). */
  comparisons: z.number().int().min(1).max(50).default(1),
  /** The share of replicates expected to be lost, as 0–0.5. */
  attrition: z.number().min(0).max(0.5).default(0),
  /** Where the numbers come from: a pilot experiment, a prior result, a paper in the ledger. */
  source: text(600),
});
export type SampleSize = z.infer<typeof sampleSizeSchema>;
export const blankSampleSize: SampleSize = sampleSizeSchema.parse({});

export const designCardSchema = z.object({
  blockId: z.string().trim().max(24),
  title: z.string().trim().min(2).max(160),
  unit: z.object({ experimental: text(400), analysis: text(400), nCounts: z.enum(nCounts).default('biological') }).default({ experimental: '', analysis: '', nCounts: 'biological' }),
  factors: z.array(z.object({ name: z.string().trim().min(1).max(200), levels: list(200) })).max(12).default([]),
  /** Group names become the planned experiment's groups. */
  groups: z.array(z.object({ name: z.string().trim().min(1).max(60), treatment: text(600), control: z.boolean().default(false) })).max(40).default([]),
  controls: z.array(z.object({ name: z.string().trim().min(1).max(300), kind: z.enum(controlKinds).default('other'), excludes: text(600), concurrent: z.boolean().default(true), addresses })).max(40).default([]),
  manipulation: z.object({ kind: z.enum(manipulationKinds).default('none'), independentReagents: count, efficiencyCheck: text(600) }).default({ kind: 'none', independentReagents: null, efficiencyCheck: '' }),
  replicates: z.object({ biological: count, technical: count, note: text(600) }).default({ biological: null, technical: null, note: '' }),
  sampleSize: sampleSizeSchema.default(blankSampleSize),
  randomization: text(800),
  blinding: text(800),
  batch: text(800),
  readouts: z.array(z.object({ name: z.string().trim().min(1).max(300), method: text(300), timepoint: text(200), assay: z.enum(assays).default('other') })).max(40).default([]),
  referenceGenes: list(80),
  loadingControl: text(200),
  normalization: text(600),
  analysis: z.object({ test: text(600), primaryComparison: text(600), multipleComparison: text(600), exclusion: text(600) }).default({ test: '', primaryComparison: '', multipleComparison: '', exclusion: '' }),
  criteria: list(800),
  dependsOn: z.array(z.string().trim().max(24)).max(10).default([]),
  /** A LabNest Protocol by id, or a note that one is needed. */
  protocol: z.object({ id: z.string().trim().max(40).default(''), title: text(300), needed: z.boolean().default(false) }).default({ id: '', title: '', needed: false }),
  methodNote: text(1500),
  drift: list(600),
  confirmed: z.boolean().default(false),
});
export type DesignCard = z.infer<typeof designCardSchema>;

export const reviewDimensions = ['controls', 'confounding', 'pseudoreplication', 'sample_size', 'multiple_comparisons', 'overclaiming', 'feasibility', 'safety_ethics'] as const;
export type ReviewDimension = typeof reviewDimensions[number];
export const dimensionLabels: Record<ReviewDimension, string> = {
  controls: 'Controls', confounding: 'Confounding and batch', pseudoreplication: 'Pseudoreplication', sample_size: 'Sample size basis',
  multiple_comparisons: 'Multiple comparisons', overclaiming: 'Overclaiming', feasibility: 'Feasibility', safety_ethics: 'Safety and ethics',
};
export const severities = ['critical', 'major', 'minor'] as const;
export type Severity = typeof severities[number];
export const MAX_REVIEW_ROUNDS = 2;

/**
 * A review that judged every dimension, with an actionable finding behind each concern: an empty answer is not a review
 * (v2), and a finding without a change to make is not one either (v3, scientific-critical-thinking: "suggest
 * improvements rather than just criticizing"). `supports` states the strongest conclusion the design can bear.
 */
export const reviewSchema = z.object({
  verdict: z.enum(['ready', 'revise', 'rethink']),
  supports: text(800),
  strengths: z.array(z.string().trim().min(2).max(400)).max(5).default([]),
  dimensions: z.array(z.object({ key: z.enum(reviewDimensions), verdict: z.enum(['ok', 'concern', 'not_applicable']), note: text(600) })).max(reviewDimensions.length),
  findings: z.array(z.object({
    severity: z.enum(severities), dimension: z.enum(reviewDimensions),
    blockId: z.string().trim().max(24).default(''), field: z.string().trim().max(60).default(''),
    problem: z.string().trim().min(2).max(800), suggestion: z.string().trim().min(4, 'Every finding needs a concrete change to make').max(800),
  })).max(30).default([]),
})
  .refine(review => reviewDimensions.every(key => review.dimensions.some(item => item.key === key)), { message: `Judge every dimension once: ${reviewDimensions.join(', ')}` })
  .refine(review => review.dimensions.every(item => item.verdict !== 'concern' || review.findings.some(finding => finding.dimension === item.key)), { message: 'Give at least one finding for each dimension with a concern' });
type ReviewAnswer = z.infer<typeof reviewSchema>;
export type ReviewFinding = ReviewAnswer['findings'][number] & { id: string; status: 'open' | 'resolved' | 'waived'; reason?: string };
export type ReviewRound = {
  at: string; provider: string; model?: string; selfReview: boolean; verdict: ReviewAnswer['verdict']; dimensions: ReviewAnswer['dimensions']; findings: ReviewFinding[];
  supports?: string; strengths?: string[];
  /** A fingerprint of each artifact the round read: the review holds for these versions only. Rounds before v2 have none. */
  seen?: Record<string, string>;
};

export type DesignState = {
  gathered?: ContextItem[];
  context?: { card: ContextCard; confirmedAt?: string };
  hypotheses?: { draft?: Hypotheses; confirmedAt?: string };
  chain?: { templateId: string; templateVersion: number; draft?: Chain; tier?: Tier; confirmedAt?: string };
  /**
   * `edited` holds when each block's card last changed. Runs saved before it only have `editedAt`, the latest change.
   * Reviews from v2 on compare content fingerprints instead (`ReviewRound.seen`).
   */
  cards?: { items: DesignCard[]; confirmedAt?: string; edited?: Record<string, string>; editedAt?: string };
  review?: { rounds: ReviewRound[] };
  /** Papers and how far each is verified; kept from ② on. */
  evidence?: Ledger;
  /** Rule findings the author chose to sign past, with the reason. */
  waivers?: Record<string, string>;
  signed?: { at: string; version: number; experimentIds: string[]; sections: string[] };
};

export type DesignEvent = { at: string; step: RunStep; kind: 'step' | 'model' | 'note' | 'error'; text: string };
export const MAX_DESIGN_LOG = 200;

export type DesignRunView = {
  id: string; researchPlanId: string; spec: string; purpose: string; step: RunStep; status: RunStatus;
  state: DesignState; log: DesignEvent[]; provider?: string; model?: string; modelCalls: number; error?: string;
  signedAt?: string; createdAt: string; updatedAt: string;
};

/** The blocks required at a tier; the rest of the chain is optional. */
export const tierRank: Record<Tier, number> = { light: 0, standard: 1, publication: 2 };
export const requiredBlocks = (chain: Chain, tier: Tier) => chain.blocks.filter(block => tierRank[block.minTier] <= tierRank[tier]);

/** About how many model calls each step makes (§8.5); the mechanical parts call none. */
export const stepCalls = (step: DesignStep, requiredCount = 3) => step === 'cards' ? requiredCount : 1;

/** A card's sample size with every field present: cards saved before phase 2 have only n, basis and note. */
export const sampleSizeOf = (card: DesignCard): SampleSize => {
  const parsed = sampleSizeSchema.safeParse(card.sampleSize ?? {});
  return parsed.success ? parsed.data : { ...blankSampleSize, n: card.sampleSize?.n ?? null, basis: card.sampleSize?.basis ?? 'pending', note: card.sampleSize?.note ?? '' };
};
