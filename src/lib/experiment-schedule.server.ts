import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { convert, normalizeUnit, units } from "./calculators/quantities";
import { experimentStepGroupHeading } from "./experiment-planning";
import { assertRecordEditable } from "./record-lifecycle";
import { stepVersion, structuredRunView, type StructuredRunView } from "./structured-run";
import {
  blockState, blockTitle, daysBetween, labDayKey, overnightWindow, saysOvernight, scheduleProblems, sortBlocks, textTimes,
  type ScheduleBlock, type ScheduleStep, type ScheduleWait,
} from "./experiment-schedule";

type Tx = Prisma.TransactionClient;
type StepRow = {
  id: string; protocolStepRef: string | null; groupKey: string; groupTitle: string; groupOrder: number; order: number;
  title: string; description: string; completed: boolean; timerDurationSeconds: number | null;
};
type BlockRow = Prisma.ExperimentScheduleBlockGetPayload<Record<string, never>>;

/** A step's stable reference: the Protocol's step for a structured step, the row itself for a custom one. */
export const stepRef = (step: Pick<StepRow, "id" | "protocolStepRef">) => step.protocolStepRef ?? step.id;
const WAIT_BREAK_SECONDS = 4 * 3600;

/**
 * How long a step makes the next one wait: the longest time in it (a timer rule or a time chip). A chip still awaiting
 * its value counts from the start of the source's range; the range is the window (Q261). A step that says overnight and
 * has no long time of its own waits until the next morning.
 */
export function stepWait(view: StructuredRunView | undefined, step: StepRow): ScheduleWait | undefined {
  let best: ScheduleWait | undefined;
  const consider = (seconds: number | undefined, min = seconds, max = seconds) => {
    if (!seconds || !(seconds > 0) || min === undefined || max === undefined) return;
    if (!best || seconds > best.seconds) best = { seconds: Math.round(seconds), minSeconds: Math.round(Math.min(min, seconds)), maxSeconds: Math.round(Math.max(max, seconds)) };
  };
  const resolved = view?.steps[step.id];
  if (resolved && view) {
    consider(resolved.timerDurationSeconds);
    const version = stepVersion(view, step.id);
    const parameters = version?.document.systems?.parameters ?? [];
    for (const id of resolved.chipIds ?? []) {
      const parameter = parameters.find(item => item.id === id);
      if (!parameter || units[normalizeUnit(parameter.unit)]?.dimension !== "time") continue;
      try {
        const adopted = version?.parameters[id];
        const seconds = (value: number, unit: string) => convert(value, unit, "s");
        const nominal = adopted?.status === "resolved" && adopted.value !== undefined ? seconds(adopted.value, adopted.unit) : parameter.range ? seconds(parameter.range.min.value, parameter.range.min.unit) : undefined;
        consider(nominal, parameter.range ? seconds(parameter.range.min.value, parameter.range.min.unit) : nominal, parameter.range ? seconds(parameter.range.max.value, parameter.range.max.unit) : nominal);
      } catch { /* a time it cannot convert is no wait */ }
    }
  } else {
    consider(step.timerDurationSeconds ?? undefined);
    // A Protocol written before time chips: the times in the step's own words ("培养12–24 h", "孵育 1–4 h").
    for (const time of textTimes(`${step.title}\n${step.description}`)) {
      try {
        const seconds = (value: number, unit: string) => convert(value, unit, "s");
        if (time.range) consider(seconds(time.range.min.value, time.range.min.unit), seconds(time.range.min.value, time.range.min.unit), seconds(time.range.max.value, time.range.max.unit));
        else consider(seconds(Math.max(...time.values), time.unit));
      } catch { /* a time it cannot convert is no wait */ }
    }
  }
  if (saysOvernight(`${step.title}\n${step.description}`) && (!best || best.seconds < WAIT_BREAK_SECONDS)) return { seconds: 16 * 3600, ...overnightWindow, overnight: true };
  return best;
}

/** The experiment's steps as the schedule sees them, in run order, one per reference. */
export function scheduleSteps(experiment: { protocolSnapshotJson: unknown; protocolRun: { executionPlanJson: unknown } | null; steps: StepRow[] }): ScheduleStep[] {
  let view: StructuredRunView | undefined;
  try { view = structuredRunView(experiment.protocolSnapshotJson, experiment.protocolRun?.executionPlanJson, experiment.steps); } catch { view = undefined; }
  const groupRank = (id: string) => { const group = view?.plan.stepGroups[id]; return group === "shared" ? -1 : group ? view!.plan.groups.findIndex(item => item.id === group) : 0; };
  const ordered = [...experiment.steps].sort((a, b) => a.groupOrder - b.groupOrder || groupRank(a.id) - groupRank(b.id) || a.order - b.order);
  const byRef = new Map<string, ScheduleStep>();
  for (const step of ordered) {
    if (view?.steps[step.id]?.applicability === "not-applicable") continue;
    const ref = stepRef(step);
    const known = byRef.get(ref);
    if (known) { known.stepIds.push(step.id); known.completed &&= step.completed; continue; }
    const wait = stepWait(view, step);
    byRef.set(ref, { ref, stepIds: [step.id], title: view?.steps[step.id]?.title ?? step.title, groupKey: step.groupKey, groupTitle: experimentStepGroupHeading(step.groupTitle).title,
      position: step.order, completed: step.completed, ...(wait ? { wait } : {}) });
  }
  return [...byRef.values()];
}

export const blockView = (row: BlockRow): ScheduleBlock => ({
  id: row.id, kind: row.kind === "task" ? "task" : "steps", title: row.title, stepRefs: row.stepRefs, startAt: row.startAt.toISOString(), allDay: row.allDay,
  estimatedMinutes: row.estimatedMinutes, afterBlockId: row.afterBlockId, minGapMinutes: row.minGapMinutes, maxGapMinutes: row.maxGapMinutes,
  gapSource: row.gapSource, note: row.note, doneAt: row.doneAt?.toISOString() ?? null,
});

/** What the page sends back to say which saved schedule it changed: a later save by anyone else makes it stale. */
export function scheduleToken(rows: ReadonlyArray<Pick<BlockRow, "id" | "updatedAt">>) {
  return createHash("sha1").update([...rows].sort((a, b) => a.id.localeCompare(b.id)).map(row => `${row.id}:${row.updatedAt.toISOString()}`).join("|")).digest("hex");
}

/** A Beijing day as `Experiment.date` stores it: UTC midnight, the way the experiment form saves a date. */
export const experimentDateOf = (dayKey: string) => new Date(`${dayKey}T00:00:00.000Z`);

const blockInput = z.object({
  id: z.string().regex(/^[\w-]{1,64}$/),
  kind: z.enum(["steps", "task"]),
  title: z.string().trim().max(120).nullable(),
  stepRefs: z.array(z.string().min(1).max(200)).max(500),
  startAt: z.string().datetime(),
  allDay: z.boolean(),
  estimatedMinutes: z.number().int().min(0).max(1440).nullable(),
  afterBlockId: z.string().regex(/^[\w-]{1,64}$/).nullable(),
  minGapMinutes: z.number().int().min(0).max(60 * 24 * 60).nullable(),
  maxGapMinutes: z.number().int().min(0).max(60 * 24 * 60).nullable(),
  gapSource: z.string().max(240).nullable(),
  note: z.string().trim().max(1000).nullable(),
  doneAt: z.string().datetime().nullable(),
});
export const saveScheduleInput = z.object({
  experimentId: z.string().min(1),
  token: z.string().min(1),
  blocks: z.array(blockInput).max(200),
  reason: z.string().trim().max(500).optional(),
});

async function lockedExperiment(tx: Tx, experimentId: string) {
  // Every execution write holds this parent lock; the schedule takes it too.
  await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${experimentId} FOR UPDATE`;
  const experiment = await tx.experiment.findUnique({ where: { id: experimentId }, include: { steps: true, protocolRun: true, scheduleBlocks: true } });
  if (!experiment) throw new Error("Experiment not found.");
  if (experiment.status === "archived") throw new Error("An archived experiment cannot change its schedule.");
  assertRecordEditable(experiment.recordStatus);
  return experiment;
}

/**
 * Save a whole schedule (Q263, Q264). The page must have read the current one; a done block keeps its place and its
 * steps; moving blocks of a running experiment needs a reason, kept in the activity history. The experiment's date
 * follows its first block.
 */
export async function saveExperimentSchedule(raw: z.input<typeof saveScheduleInput>) {
  const input = saveScheduleInput.parse(raw);
  return prisma.$transaction(async tx => {
    const experiment = await lockedExperiment(tx, input.experimentId);
    if (scheduleToken(experiment.scheduleBlocks) !== input.token) throw new Error("The schedule was changed elsewhere; reload before changing it.");
    const blocks = input.blocks.map(block => ({ ...block, title: block.title?.trim() || null, note: block.note?.trim() || null, doneAt: block.kind === "task" ? block.doneAt : null }));
    const steps = scheduleSteps(experiment);
    const problems = scheduleProblems(blocks, new Set(steps.map(step => step.ref)));
    if (problems.length) throw new Error(problems[0]);
    const existing = new Map(experiment.scheduleBlocks.map(row => [row.id, row]));
    const strangers = blocks.filter(block => !existing.has(block.id)).map(block => block.id);
    if (strangers.length && await tx.experimentScheduleBlock.count({ where: { id: { in: strangers } } })) throw new Error("A block id is already in use.");
    const stepMap = new Map(steps.map(step => [step.ref, step]));
    for (const row of experiment.scheduleBlocks) {
      if (blockState(blockView(row), stepMap) !== "done") continue;
      const kept = blocks.find(block => block.id === row.id);
      if (!kept || Date.parse(kept.startAt) !== row.startAt.getTime() || kept.stepRefs.join("|") !== row.stepRefs.join("|")) throw new Error("A done block keeps its place and its steps.");
    }
    const moved = blocks.filter(block => { const row = existing.get(block.id); return row && Date.parse(block.startAt) !== row.startAt.getTime(); });
    if (experiment.status === "running" && moved.length && !input.reason) throw new Error("The experiment is under way: say why the schedule changes.");
    const removed = experiment.scheduleBlocks.filter(row => !blocks.some(block => block.id === row.id)).map(row => row.id);
    if (removed.length) await tx.experimentScheduleBlock.deleteMany({ where: { id: { in: removed }, experimentId: experiment.id } });
    for (const block of blocks) {
      const data = { kind: block.kind, title: block.title, stepRefs: block.stepRefs, startAt: new Date(block.startAt), allDay: block.allDay, estimatedMinutes: block.estimatedMinutes,
        afterBlockId: block.afterBlockId, minGapMinutes: block.minGapMinutes, maxGapMinutes: block.maxGapMinutes, gapSource: block.gapSource, note: block.note, doneAt: block.doneAt ? new Date(block.doneAt) : null };
      if (existing.has(block.id)) await tx.experimentScheduleBlock.update({ where: { id: block.id }, data });
      else await tx.experimentScheduleBlock.create({ data: { id: block.id, experimentId: experiment.id, ...data } });
    }
    const first = sortBlocks(blocks)[0];
    const firstDay = first ? labDayKey(first.startAt) : undefined;
    if (firstDay && labDayKey(experiment.date) !== firstDay) await tx.experiment.update({ where: { id: experiment.id }, data: { date: experimentDateOf(firstDay) } });
    // Activity entries print their fields as text: keep them flat.
    await tx.activityLog.create({ data: { action: "experiment_schedule_saved", targetType: "experiment", targetId: experiment.id, metadataJson: {
      blocks: blocks.length, created: strangers.length, removed: removed.length, moved: moved.length, firstDay: firstDay ?? null, reason: input.reason ?? null,
    } } });
    const rows = await tx.experimentScheduleBlock.findMany({ where: { experimentId: experiment.id } });
    return { token: scheduleToken(rows), blocks: sortBlocks(rows.map(blockView)) };
  });
}

/** Tick an item (复苏细胞、送测序…) done or not; items never go into the Protocol's steps. */
export async function setScheduleItemDone(experimentId: string, blockId: string, done: boolean) {
  return prisma.$transaction(async tx => {
    const experiment = await lockedExperiment(tx, experimentId);
    const row = experiment.scheduleBlocks.find(block => block.id === blockId);
    if (!row || row.kind !== "task") throw new Error("This item is not in the schedule.");
    await tx.experimentScheduleBlock.update({ where: { id: row.id }, data: { doneAt: done ? new Date() : null } });
    await tx.activityLog.create({ data: { action: done ? "experiment_schedule_item_done" : "experiment_schedule_item_reopened", targetType: "experiment", targetId: experiment.id, metadataJson: { blockId: row.id, title: row.title ?? "" } } });
    const rows = await tx.experimentScheduleBlock.findMany({ where: { experimentId: experiment.id } });
    return { token: scheduleToken(rows), blocks: sortBlocks(rows.map(blockView)) };
  });
}

/**
 * The experiment form's date is the first day (Q263): changing it moves the whole schedule by whole days. Once a block
 * is done the schedule cannot move that way; it is changed on the schedule itself.
 */
export async function shiftScheduleToDate(tx: Tx, experiment: { id: string; protocolSnapshotJson: unknown; protocolRun: { executionPlanJson: unknown } | null; steps: StepRow[] }, date: Date) {
  const rows = await tx.experimentScheduleBlock.findMany({ where: { experimentId: experiment.id }, orderBy: { startAt: "asc" } });
  if (!rows.length) return;
  const days = daysBetween(labDayKey(rows[0].startAt), labDayKey(date));
  if (!days) return;
  const steps = new Map(scheduleSteps(experiment).map(step => [step.ref, step]));
  if (rows.some(row => blockState(blockView(row), steps) === "done")) throw new Error("Part of the schedule is done: change the days on the schedule itself.");
  for (const row of rows) await tx.experimentScheduleBlock.update({ where: { id: row.id }, data: { startAt: new Date(row.startAt.getTime() + days * 86_400_000) } });
}

/** A block as other pages show it: its experiment, its name, and its first open step to go straight to. */
export type ScheduledBlockSummary = {
  id: string; experimentId: string; runCode: string; experimentTitle: string; experimentStatus: string;
  title: string; startAt: string; allDay: boolean; estimatedMinutes: number | null; kind: "steps" | "task"; state: "done" | "active" | "todo"; firstOpenStepId?: string;
  updatedAt: string; stepTitles: string[]; note: string | null;
};

/**
 * Blocks that start in a range, or all blocks of some experiments: for Today, the calendar and its export. Only planned
 * and running experiments unless `anyStatus` (the month calendar also shows finished work on its days).
 */
export async function scheduledBlocks(where: { from: Date; to: Date } | { experimentIds: string[] }, { anyStatus = false }: { anyStatus?: boolean } = {}): Promise<ScheduledBlockSummary[]> {
  const rows = await prisma.experimentScheduleBlock.findMany({
    where: { ...("from" in where ? { startAt: { gte: where.from, lt: where.to } } : { experimentId: { in: where.experimentIds } }), ...(anyStatus ? {} : { experiment: { status: { in: ["planned", "running"] } } }) },
    orderBy: { startAt: "asc" },
    include: { experiment: { select: { id: true, runCode: true, title: true, status: true, protocolSnapshotJson: true, protocolRun: { select: { executionPlanJson: true } },
      steps: { select: { id: true, protocolStepRef: true, groupKey: true, groupTitle: true, groupOrder: true, order: true, title: true, description: true, completed: true, timerDurationSeconds: true } } } } },
    take: 500,
  });
  const stepsOf = new Map<string, Map<string, ScheduleStep>>();
  return rows.map(row => {
    let steps = stepsOf.get(row.experimentId);
    if (!steps) { steps = new Map(scheduleSteps(row.experiment).map(step => [step.ref, step])); stepsOf.set(row.experimentId, steps); }
    const block = blockView(row);
    const firstOpen = block.stepRefs.map(ref => steps!.get(ref)).find(step => step && !step.completed);
    return { id: row.id, experimentId: row.experimentId, runCode: row.experiment.runCode, experimentTitle: row.experiment.title, experimentStatus: row.experiment.status,
      title: blockTitle(block, steps), startAt: block.startAt, allDay: block.allDay, estimatedMinutes: block.estimatedMinutes, kind: block.kind, state: blockState(block, steps),
      ...(firstOpen ? { firstOpenStepId: firstOpen.stepIds[0] } : {}), updatedAt: row.updatedAt.toISOString(), note: row.note,
      stepTitles: block.stepRefs.flatMap(ref => { const step = steps!.get(ref); return step ? [`${step.position}. ${step.title}`] : []; }) };
  });
}
