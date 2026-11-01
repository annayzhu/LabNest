import { z } from 'zod';

/**
 * 研究方案 Copilot: from a research purpose to a design of experiments, with an author confirmation followed by five stages. Each stage's result is kept on
 * the run, so the author can stop between stages, change what the next stage reads, and see how every line came about.
 */
export const copilotStages = ['clarify', 'split', 'search', 'extract', 'design', 'write'] as const;
export type CopilotStage = typeof copilotStages[number];
export const stageLabels: Record<CopilotStage, string> = {
  clarify: 'Confirm the research question', split: 'Split the question', search: 'Find papers', extract: 'Read the experiments', design: 'Combine into a design', write: 'Write suggestions',
};

/** What one run may spend: papers read, full texts read, and the model's tool steps while it searches. */
export const copilotLimits = { maxPapers: 20, maxFullText: 8, maxToolSteps: 8 } as const;
export type CopilotBudget = { maxPapers: number; maxFullText: number; fallbackToPubMed?: boolean };
export const clarificationSchema = z.object({
  method: z.string().trim().min(2).max(200),
  subject: z.string().trim().min(2).max(400),
  sample: z.string().trim().min(2).max(400),
  objective: z.string().trim().min(2).max(500),
});
export type Clarification = z.infer<typeof clarificationSchema>;

export const clampBudget = (input: Partial<CopilotBudget> = {}): CopilotBudget => ({
  fallbackToPubMed: input.fallbackToPubMed === true,
  maxPapers: Math.min(copilotLimits.maxPapers, Math.max(1, Math.round(input.maxPapers ?? copilotLimits.maxPapers))),
  maxFullText: Math.min(copilotLimits.maxFullText, Math.max(0, Math.round(input.maxFullText ?? copilotLimits.maxFullText))),
});
/** About how many times the model is called: splitting (with a look at the plan), the search, one per paper, the design. */
export const estimateModelCalls = (budget: CopilotBudget) => 3 + (copilotLimits.maxToolSteps + 1) + budget.maxPapers + 1;

export const subQuestionSchema = z.object({
  id: z.string().trim().min(1).max(12),
  question: z.string().trim().min(2).max(300),
  /** How the question can be tested: what would count as an answer. */
  why: z.string().trim().max(400).default(''),
  /** English search terms: Europe PMC reads English. */
  keywords: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
});
export type SubQuestion = z.infer<typeof subQuestionSchema>;

export type Paper = {
  /** "PMC123456" for an open-access paper, "MED:12345678" otherwise: stable across searches. */
  key: string; title: string; authors?: string; year?: string; venue?: string; url?: string; doi?: string;
  openAccess: boolean; abstract?: string; source?: 'europe_pmc' | 'pubmed';
  /** Why the model picked it, and for which sub-questions. */
  why?: string; subQuestionIds?: string[];
  /** What was read: the Methods and Results of the full text, or only the abstract. */
  basis?: 'fulltext' | 'abstract';
};

const extractionItem = z.object({
  name: z.string().trim().min(2).max(160),
  subQuestionIds: z.array(z.string().trim().max(12)).max(8).default([]),
  approach: z.string().trim().max(160).default(''),
  purpose: z.string().trim().max(400).default(''),
  readouts: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
  controls: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
  sample: z.string().trim().max(200).default(''),
  /** Words of the paper this experiment rests on, copied as they are. */
  quote: z.string().trim().max(600).default(''),
});
export const extractionSchema = z.object({ experiments: z.array(extractionItem).max(8).default([]) });
export type ExtractedExperiment = z.infer<typeof extractionItem> & { verified: boolean; problem?: string };
export type PaperExtraction = { paperKey: string; basis: 'fulltext' | 'abstract'; experiments: ExtractedExperiment[]; error?: string };

const designExperiment = z.object({
  comparison: z.string().trim().max(500).optional(),
  decisionCriteria: z.array(z.string().trim().min(1).max(300)).max(8).optional(),
  name: z.string().trim().min(2).max(160),
  purpose: z.string().trim().max(400).default(''),
  approach: z.string().trim().max(160).default(''),
  readouts: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
  controls: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
  priority: z.enum(['must', 'optional']).default('optional'),
  /** The papers it rests on, by key. */
  evidence: z.array(z.string().trim().max(40)).max(10).default([]),
  note: z.string().trim().max(400).default(''),
});
export const designSchema = z.object({
  summary: z.string().trim().max(800).default(''),
  items: z.array(z.object({ subQuestionId: z.string().trim().max(12), experiments: z.array(designExperiment).max(8).default([]) })).max(12).default([]),
  gaps: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
});
export type DesignExperiment = z.infer<typeof designExperiment> & { verified: boolean; problem?: string };
export type Design = { summary: string; items: { subQuestionId: string; experiments: DesignExperiment[] }[]; gaps: string[] };

/** A change the Copilot proposes. Nothing is written until the author adopts it. */
export type PlanBlocks = { type: 'heading' | 'text'; text: string }[];
export type PlanSectionDraft = { key: 'design' | 'material_methods' | 'acceptance_criteria' | 'constraints'; title: string; blocks: PlanBlocks };
export type Suggestion =
  | { id: string; kind: 'design'; title: string; status: SuggestionStatus; sections?: PlanSectionDraft[]; blocks: { type: 'heading' | 'text'; text: string }[] }
  | { id: string; kind: 'references'; title: string; status: SuggestionStatus; blocks: { type: 'heading' | 'text'; text: string }[] }
  | { id: string; kind: 'experiment'; title: string; status: SuggestionStatus; experimentName: string; note?: string; purpose?: string; verified: boolean; adoptedExperimentId?: string };
export type SuggestionStatus = 'pending' | 'adopted' | 'ignored';

export type CopilotEvent = { at: string; stage: CopilotStage | 'run'; kind: 'stage' | 'tool' | 'model' | 'note' | 'error'; text: string };
/** ready: waiting for the next step; working: a step is running; paused: the author stops between stages; done; failed: the step can be tried again. */
export type RunStatus = 'ready' | 'working' | 'paused' | 'done' | 'failed';

/** Everything a stage has produced so far. */
export type CopilotState = {
  clarification?: Clarification & { questions: string[]; confirmedAt?: string };
  subQuestions?: SubQuestion[];
  papers?: Paper[];
  /** How far the reading of papers has come, and what it found. */
  extractIndex?: number;
  extractions?: PaperExtraction[];
  design?: Design;
  /** Stages finished, in order. */
  done: CopilotStage[];
};

/** What the author told the run. `mode` is whether the plan is new or already written and the run adjusts it. */
export type CopilotInputs = { sample?: string; model?: string; conditions?: string; method?: string; subject?: string; objective?: string; mode?: 'new' | 'adjust' };

export type CopilotRunView = {
  id: string; researchPlanId: string; purpose: string; inputs: CopilotInputs;
  status: RunStatus; stage: CopilotStage; autoContinue: boolean; budget: CopilotBudget;
  state: CopilotState; log: CopilotEvent[]; suggestions: Suggestion[];
  provider?: string; model?: string; modelCalls: number; error?: string; createdAt: string; updatedAt: string;
};

export const MAX_LOG_EVENTS = 300;

/** A plan title from the first sentence of the purpose, so a plan made by the Copilot has a name the author can find and change. */
export function planTitleFromPurpose(purpose: string) {
  const sentence = purpose.trim().split(/[。！？!?\n]|\.(?=\s|$)/)[0].trim();
  return sentence.length > 60 ? `${sentence.slice(0, 60)}…` : sentence;
}
