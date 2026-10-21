import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '../db';
import { normalizeResearchPlanDocument } from '../scientific-document';
import { reserveRecordCode } from '../record-codes';
import { runUnit, type EngineDeps } from './engine';
import { appendBlocks } from './suggestions';
import { clampBudget, copilotStages, MAX_LOG_EVENTS, planTitleFromPurpose, subQuestionSchema, type CopilotBudget, type CopilotEvent, type CopilotRunView, type CopilotState, type CopilotStage, type RunStatus, type Suggestion } from './types';

type Row = Prisma.ResearchPlanCopilotRunGetPayload<Record<string, never>>;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const STALE_MS = 10 * 60 * 1000;

export function viewOf(row: Row): CopilotRunView {
  const state = (row.stateJson ?? {}) as Partial<CopilotState>;
  return {
    id: row.id, researchPlanId: row.researchPlanId, purpose: row.purpose, inputs: (row.inputsJson ?? {}) as CopilotRunView['inputs'],
    status: row.status as RunStatus, stage: (copilotStages as readonly string[]).includes(row.stage) ? row.stage as CopilotStage : 'split', autoContinue: row.autoContinue,
    budget: clampBudget((row.budgetJson ?? {}) as Partial<CopilotBudget>), state: { ...state, done: Array.isArray(state.done) ? state.done : [] },
    log: Array.isArray(row.logJson) ? row.logJson as unknown as CopilotEvent[] : [], suggestions: Array.isArray(row.suggestionsJson) ? row.suggestionsJson as unknown as Suggestion[] : [],
    provider: row.provider ?? undefined, model: row.model ?? undefined, modelCalls: row.modelCalls, error: row.error ?? undefined, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listRuns(planId: string) {
  return (await prisma.researchPlanCopilotRun.findMany({ where: { researchPlanId: planId }, orderBy: { createdAt: 'desc' }, take: 5 })).map(viewOf);
}

async function loadRow(planId: string, runId: string) {
  const row = await prisma.researchPlanCopilotRun.findFirst({ where: { id: runId, researchPlanId: planId } });
  if (!row) throw new Error('Copilot run not found');
  return row;
}

/** A new run, ready to start. No model is called and nothing leaves the machine until the first step. */
export async function createRun(planId: string, input: { purpose: string; inputs?: CopilotRunView['inputs']; budget?: Partial<CopilotBudget>; autoContinue?: boolean }) {
  const purpose = input.purpose.trim();
  if (purpose.length < 4) throw new Error('Write the research purpose first');
  if (purpose.length > 1500) throw new Error('The research purpose is too long (1500 characters at most)');
  if (!await prisma.researchPlan.findUnique({ where: { id: planId }, select: { id: true } })) throw new Error('Research plan not found');
  const inputs = Object.fromEntries(Object.entries(input.inputs ?? {}).map(([key, value]) => [key, String(value ?? '').trim().slice(0, 400)]).filter(([key, value]) => value && (key !== 'mode' || value === 'new' || value === 'adjust')));
  return viewOf(await prisma.researchPlanCopilotRun.create({ data: { researchPlanId: planId, purpose, inputsJson: json(inputs), budgetJson: json(clampBudget(input.budget)), autoContinue: input.autoContinue ?? true } }));
}

/** A draft plan named from the purpose, in the project, with a run ready to start on it: what "new plan with the Copilot" opens. */
export async function createPlanWithRun(input: { projectId: string; purpose: string; inputs?: CopilotRunView['inputs']; budget?: Partial<CopilotBudget>; autoContinue?: boolean }) {
  const purpose = input.purpose.trim();
  if (purpose.length < 4) throw new Error('Write the research purpose first');
  if (purpose.length > 1500) throw new Error('The research purpose is too long (1500 characters at most)');
  const plan = await prisma.$transaction(async tx => {
    if (!await tx.project.findFirst({ where: { id: input.projectId, status: { not: 'archived' } }, select: { id: true } })) throw new Error('Choose a project for the plan');
    const code = await reserveRecordCode(tx, 'researchPlan');
    const created = await tx.researchPlan.create({ data: { projectId: input.projectId, code, title: planTitleFromPurpose(purpose), objective: purpose, status: 'draft' } });
    await tx.activityLog.create({ data: { action: 'create', targetType: 'research_plan', targetId: created.id, metadataJson: { code, via: 'copilot' } } });
    return created;
  });
  return { planId: plan.id, run: await createRun(plan.id, { ...input, inputs: { ...input.inputs, mode: 'new' } }) };
}

/**
 * One step of a run. The run is claimed first (a step already running, or a finished run, cannot be advanced), the step
 * runs outside any transaction because it waits on a model, and its result is saved only if the AI settings did not
 * change meanwhile. A failure leaves the state as it was and marks the run failed, so the same step can be tried again.
 */
export async function advanceRun(planId: string, runId: string, prepare: () => Promise<{ deps: EngineDeps; provider: string; assertAllowed: () => Promise<void> }>) {
  const claimed = await prisma.researchPlanCopilotRun.updateMany({
    where: { id: runId, researchPlanId: planId, OR: [{ status: { in: ['ready', 'paused', 'failed'] } }, { status: 'working', updatedAt: { lt: new Date(Date.now() - STALE_MS) } }] },
    data: { status: 'working' },
  });
  if (claimed.count !== 1) throw new Error('This step is already running, or the run has finished');
  const before = viewOf(await loadRow(planId, runId));
  try {
    const { deps, provider, assertAllowed } = await prepare();
    const after = await runUnit({ ...before, status: 'ready' }, deps);
    await assertAllowed();
    return viewOf(await prisma.researchPlanCopilotRun.update({ where: { id: runId }, data: {
      status: after.status, stage: after.stage, stateJson: json(after.state), logJson: json(after.log.slice(-MAX_LOG_EVENTS)), suggestionsJson: json(after.suggestions),
      provider, model: after.model ?? null, modelCalls: after.modelCalls, error: null,
    } }));
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 400) : 'The step failed';
    const log = [...before.log, { at: new Date().toISOString(), stage: before.stage, kind: 'error' as const, text: message }].slice(-MAX_LOG_EVENTS);
    return viewOf(await prisma.researchPlanCopilotRun.update({ where: { id: runId }, data: { status: 'failed', error: message, logJson: json(log) } }));
  }
}

/** What the author may change between steps: the questions, the papers to read, whether to stop between stages; and resuming. */
export async function editRun(planId: string, runId: string, patch: { subQuestions?: unknown; removePaperKeys?: string[]; autoContinue?: boolean; resume?: boolean }) {
  const row = await loadRow(planId, runId);
  if (row.status === 'working') throw new Error('A step is running; wait for it to finish');
  const view = viewOf(row);
  const state = view.state;
  if (patch.subQuestions !== undefined) {
    if (!state.subQuestions) throw new Error('The questions are not made yet');
    const questions = (subQuestionSchema.array().min(1).max(8)).parse(patch.subQuestions);
    if (new Set(questions.map(question => question.id)).size !== questions.length) throw new Error('Question ids must be different');
    state.subQuestions = questions;
  }
  if (patch.removePaperKeys?.length) {
    if (!state.papers) throw new Error('The papers are not chosen yet');
    if ((state.extractIndex ?? 0) > 0) throw new Error('Papers can only be removed before they are read');
    state.papers = state.papers.filter(paper => !patch.removePaperKeys!.includes(paper.key));
  }
  const status: RunStatus = patch.resume && (view.status === 'paused' || view.status === 'failed') ? 'ready' : view.status;
  return viewOf(await prisma.researchPlanCopilotRun.update({ where: { id: runId }, data: { stateJson: json(state), status, ...(patch.autoContinue !== undefined ? { autoContinue: patch.autoContinue } : {}), ...(patch.resume ? { error: null } : {}) } }));
}

export async function removeRun(planId: string, runId: string) {
  const row = await loadRow(planId, runId);
  if (row.status === 'working') throw new Error('A step is running; wait for it to finish');
  await prisma.researchPlanCopilotRun.delete({ where: { id: runId } });
}

/**
 * 采纳 or 忽略 one suggestion. Adopting writes into the plan inside the transaction that marks the suggestion done: the
 * design and the references go at the end of their sections, an experiment becomes a planned Experiment of the plan.
 */
export async function decideCopilotSuggestion(planId: string, runId: string, suggestionId: string, decision: 'adopt' | 'ignore') {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ResearchPlanCopilotRun" WHERE id=${runId} FOR UPDATE`;
    const row = await tx.researchPlanCopilotRun.findFirst({ where: { id: runId, researchPlanId: planId } });
    if (!row) throw new Error('Copilot run not found');
    const view = viewOf(row);
    const suggestion = view.suggestions.find(item => item.id === suggestionId);
    if (!suggestion) throw new Error('This suggestion does not exist');
    if (suggestion.status !== 'pending') throw new Error('This suggestion was already decided; refresh the page');
    let experimentId: string | undefined;
    if (decision === 'adopt') {
      await tx.$queryRaw`SELECT id FROM "ResearchPlan" WHERE id=${planId} FOR UPDATE`;
      const plan = await tx.researchPlan.findUniqueOrThrow({ where: { id: planId } });
      if (suggestion.kind === 'experiment') {
        const experiment = await tx.experiment.create({ data: { title: suggestion.experimentName, runCode: await reserveRecordCode(tx, 'experiment'), projectId: plan.projectId, researchPlanId: plan.id, status: 'planned', recordStatus: 'draft' } });
        experimentId = experiment.id;
        suggestion.adoptedExperimentId = experiment.id;
      } else {
        const document = appendBlocks(normalizeResearchPlanDocument(plan.contentJson, plan.design), suggestion.kind === 'design' ? 'design' : 'references', suggestion.blocks, runId);
        await tx.researchPlan.update({ where: { id: planId }, data: { contentJson: json(document) } });
      }
    }
    suggestion.status = decision === 'adopt' ? 'adopted' : 'ignored';
    await tx.researchPlanCopilotRun.update({ where: { id: runId }, data: { suggestionsJson: json(view.suggestions) } });
    // Activity entries print their fields as text: keep them flat.
    await tx.activityLog.create({ data: { action: decision === 'adopt' ? 'copilot_suggestion_adopted' : 'copilot_suggestion_ignored', targetType: 'research_plan', targetId: planId, metadataJson: { runId, suggestionId, kind: suggestion.kind, ...(experimentId ? { experimentId } : {}) } } });
    return { run: { ...view, suggestions: view.suggestions }, experimentId };
  });
}
