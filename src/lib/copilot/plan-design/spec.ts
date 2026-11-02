import { z } from 'zod';

/**
 * plan-design-v1: the research-plan design workbench (Q300–Q312, phase 1). Four steps, each ending in an artifact the
 * author edits and confirms: the context card, the evidence chain, one design card per required block, and an
 * independent review before sign-off. The next step reads only confirmed artifacts, never a chat history.
 */
export const DESIGN_SPEC = 'plan-design-v1';
export const designSteps = ['context', 'chain', 'cards', 'review'] as const;
export type DesignStep = typeof designSteps[number];
export const stepLabels: Record<DesignStep, string> = { context: 'Context card', chain: 'Evidence chain', cards: 'Design cards', review: 'Review and sign-off' };
export type RunStep = DesignStep | 'signed';
/** idle: waiting for the author; working: a model step runs; failed: the step can be tried again. */
export type RunStatus = 'idle' | 'working' | 'failed' | 'signed';

const text = (max = 2000) => z.string().trim().max(max).default('');
const list = (max = 2000) => z.array(z.string().trim().min(1).max(max)).max(60).default([]);

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
});
export type ChainBlock = z.infer<typeof chainBlockSchema>;

export const chainSchema = z.object({
  claim: z.string().trim().min(2).max(800),
  hypothesis: text(1200),
  rationale: text(2000),
  minimumEvidence: list(600),
  /** Counter-claims the design must rule out; the author ticks which ones become controls. */
  alternatives: z.array(z.object({ text: z.string().trim().min(2).max(600), exclude: z.boolean().default(true) })).max(12).default([]),
  blocks: z.array(chainBlockSchema).min(1).max(12),
  recommendedTier: z.enum(tiers).default('standard'),
  /** Places where the model wants to change the confirmed context card: shown, never applied. */
  drift: list(600),
});
export type Chain = z.infer<typeof chainSchema>;
export const MAX_REQUIRED_BLOCKS = 5;

export const controlKinds = ['negative', 'positive', 'vehicle', 'empty_vector', 'isotype', 'loading', 'reference_gene', 'other'] as const;
export const manipulationKinds = ['none', 'knockdown', 'knockout', 'overexpression', 'drug', 'other'] as const;
export const assays = ['qpcr', 'western_blot', 'imaging', 'flow', 'viability', 'migration', 'elisa', 'co_ip', 'sequencing', 'other'] as const;
export const nCounts = ['biological', 'technical', 'wells', 'animals', 'other'] as const;
export const sampleSizeBases = ['minimum_effect', 'pilot', 'convention', 'pending'] as const;
const count = z.number().int().min(0).max(1000).nullable().default(null);

export const designCardSchema = z.object({
  blockId: z.string().trim().max(24),
  title: z.string().trim().min(2).max(160),
  unit: z.object({ experimental: text(400), analysis: text(400), nCounts: z.enum(nCounts).default('biological') }).default({ experimental: '', analysis: '', nCounts: 'biological' }),
  factors: z.array(z.object({ name: z.string().trim().min(1).max(200), levels: list(200) })).max(12).default([]),
  /** Group names become the planned experiment's groups. */
  groups: z.array(z.object({ name: z.string().trim().min(1).max(60), treatment: text(600), control: z.boolean().default(false) })).max(40).default([]),
  controls: z.array(z.object({ name: z.string().trim().min(1).max(300), kind: z.enum(controlKinds).default('other'), excludes: text(600), concurrent: z.boolean().default(true) })).max(40).default([]),
  manipulation: z.object({ kind: z.enum(manipulationKinds).default('none'), independentReagents: count, efficiencyCheck: text(600) }).default({ kind: 'none', independentReagents: null, efficiencyCheck: '' }),
  replicates: z.object({ biological: count, technical: count, note: text(600) }).default({ biological: null, technical: null, note: '' }),
  sampleSize: z.object({ n: count, basis: z.enum(sampleSizeBases).default('pending'), note: text(600) }).default({ n: null, basis: 'pending', note: '' }),
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

export const reviewSchema = z.object({
  verdict: z.enum(['ready', 'revise', 'rethink']).default('revise'),
  dimensions: z.array(z.object({ key: z.enum(reviewDimensions), verdict: z.enum(['ok', 'concern', 'not_applicable']), note: text(600) })).max(reviewDimensions.length).default([]),
  findings: z.array(z.object({
    severity: z.enum(severities), dimension: z.enum(reviewDimensions),
    blockId: z.string().trim().max(24).default(''), field: z.string().trim().max(60).default(''),
    problem: z.string().trim().min(2).max(800), suggestion: text(800),
  })).max(30).default([]),
});
export type ReviewFinding = z.infer<typeof reviewSchema>['findings'][number] & { id: string; status: 'open' | 'resolved' | 'waived'; reason?: string };
export type ReviewRound = { at: string; provider: string; model?: string; selfReview: boolean; verdict: 'ready' | 'revise' | 'rethink'; dimensions: z.infer<typeof reviewSchema>['dimensions']; findings: ReviewFinding[] };

export type DesignState = {
  gathered?: ContextItem[];
  context?: { card: ContextCard; confirmedAt?: string };
  chain?: { templateId: string; templateVersion: number; draft?: Chain; tier?: Tier; confirmedAt?: string };
  /** `editedAt` lets a critical review finding count as fixed only after a card changed. */
  cards?: { items: DesignCard[]; confirmedAt?: string; editedAt?: string };
  review?: { rounds: ReviewRound[] };
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
