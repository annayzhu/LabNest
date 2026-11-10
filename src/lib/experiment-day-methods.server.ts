/**
 * 每天的方法 (Q428, Q431, Q433): what a day of a multi-day experiment is done by, chosen on that day.
 *
 * - A day gets a Protocol (its version fixed when added, as at creation) or custom steps; a day may hold several. Each becomes a part of
 *   the experiment's one run: its steps, snapshot and schedule block; the experiment keeps one code, one status and one record.
 * - A part on a day can move to another day (from a chosen step on), change version or be rewritten, or be removed. Steps that already
 *   carry a record (a tick, deviation, timer, measured value, mix card, file, result, entry, stock use) do not move off their day and are
 *   never removed, nor is a Protocol whose systems or calculations were confirmed; the refusal says which step and where.
 * - "＋ 加一天" is the schedule's own "加一天": one more day after the last.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { captureProtocolVersions, linkProtocolsToPlan } from "./experiments";
import { buildProtocolExperimentSteps, experimentStepGroupHeading, parseCustomExperimentSteps } from "./experiment-planning";
import { assertRecordEditable } from "./record-lifecycle";
import { parseExecutionPlan, structuredRunView, type ExecutionPlan } from "./structured-run";
import { blockEnd, blockState, defaultWorkHours, labDayKey, labInstant, MAX_SCHEDULE_DAYS, scheduleDayLabel, sortBlocks } from "./experiment-schedule";
import { blockView, experimentDayPlanOf, scheduleSteps } from "./experiment-schedule.server";
import { writingOnFirstDay } from "./experiment-days";
import type { DayControlsData } from "@/components/ExperimentDayControls";

type Tx = Prisma.TransactionClient;
const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const methodSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("protocol"), protocolVersionIds: z.array(z.string().min(1).max(64)).min(1).max(12) }),
  z.object({ kind: z.literal("custom"), title: z.string().trim().max(120).optional(), steps: z.string().max(20_000) }),
]);
export const addDayMethodInput = z.object({ experimentId: z.string().min(1), dayKey, method: methodSchema });
export const moveDayPartInput = z.object({ experimentId: z.string().min(1), groupKey: z.string().min(1), fromDayKey: dayKey.nullable(), toDayKey: dayKey, fromStepRef: z.string().min(1).optional() });
export const dayPartInput = z.object({ experimentId: z.string().min(1), groupKey: z.string().min(1) });
export const replaceDayPartInput = dayPartInput.extend({ method: methodSchema });

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
/** A part is a Protocol when the experiment's snapshot holds its version; every other part is custom steps. */
const protocolKeys = (snapshot: unknown) => new Set(((snapshot ?? {}) as { versions?: Array<{ protocolVersionId: string }> }).versions?.map(version => version.protocolVersionId) ?? []);

async function locked(tx: Tx, experimentId: string) {
  await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${experimentId} FOR UPDATE`;
  const experiment = await tx.experiment.findUnique({ where: { id: experimentId }, include: {
    protocolRun: true, scheduleBlocks: true, protocolVersions: { orderBy: { order: "asc" } }, researchPlan: { select: { id: true, projectId: true } },
    steps: { orderBy: [{ groupOrder: "asc" }, { order: "asc" }], include: { _count: { select: { events: true, results: true, entries: true, inventoryTransactions: true } } } },
  } });
  if (!experiment) throw new Error("Experiment not found.");
  if (experiment.status === "archived") throw new Error("实验已归档，不能再改各天的方法。");
  if (experiment.status === "completed") throw new Error("实验已完成，不能再改各天的方法。");
  assertRecordEditable(experiment.recordStatus);
  return experiment;
}
type Locked = Awaited<ReturnType<typeof locked>>;

/** The experiment's days by key, with their labels; a one-day experiment without a schedule has day 1 only. */
function daysOf(experiment: Locked) {
  const plan = experimentDayPlanOf(experiment);
  return plan ? plan.days.map(day => ({ index: day.index, dayKey: day.dayKey })) : [{ index: 1, dayKey: labDayKey(experiment.date) }];
}
const dayName = (experiment: Locked, key: string | null) => {
  if (!key) return "未安排的步骤";
  const day = daysOf(experiment).find(item => item.dayKey === key);
  return day ? scheduleDayLabel(day.index, day.dayKey, true).split(" · ")[0] : key;
};

/**
 * Without a block of steps every step belongs to day 1. Before a part is placed on another day, day 1 gets its own block, so its steps stay
 * on day 1 rather than becoming unscheduled.
 */
async function keepDayOne(tx: Tx, experiment: Locked) {
  const refs = scheduleSteps(experiment).map(step => step.ref);
  if (!refs.length || experiment.scheduleBlocks.some(block => block.kind === "steps" && block.stepRefs.some(ref => refs.includes(ref)))) return;
  const day = daysOf(experiment)[0].dayKey;
  await tx.experimentScheduleBlock.create({ data: { id: randomUUID(), experimentId: experiment.id, kind: "steps", stepRefs: refs, startAt: new Date(labInstant(day, defaultWorkHours.start)) } });
}

/** A new block on `day` for `refs`, after what the day already holds (or at the start of the working day). */
async function placeOnDay(tx: Tx, experimentId: string, day: string, refs: string[]) {
  if (!refs.length) return;
  const rows = await tx.experimentScheduleBlock.findMany({ where: { experimentId } });
  const own = sortBlocks(rows.map(blockView)).filter(block => labDayKey(block.startAt) === day);
  const after = own.length ? Math.max(...own.map(block => Date.parse(blockEnd(block)))) : NaN;
  const startAt = Number.isFinite(after) && labDayKey(new Date(after).toISOString()) === day ? new Date(after) : new Date(labInstant(day, defaultWorkHours.start));
  await tx.experimentScheduleBlock.create({ data: { id: randomUUID(), experimentId, kind: "steps", stepRefs: refs, startAt } });
}

/** Takes `refs` out of the blocks that hold them; a block left with nothing goes, and what waited for it waits for what it waited for. */
async function unplace(tx: Tx, experimentId: string, refs: ReadonlySet<string>, onDay?: string) {
  const rows = await tx.experimentScheduleBlock.findMany({ where: { experimentId } });
  const gone = new Map<string, string | null>();
  for (const row of rows) {
    if (row.kind !== "steps" || (onDay && labDayKey(row.startAt) !== onDay) || !row.stepRefs.some(ref => refs.has(ref))) continue;
    const kept = row.stepRefs.filter(ref => !refs.has(ref));
    if (kept.length || row.title?.trim()) await tx.experimentScheduleBlock.update({ where: { id: row.id }, data: { stepRefs: kept } });
    else { gone.set(row.id, row.afterBlockId); await tx.experimentScheduleBlock.delete({ where: { id: row.id } }); }
  }
  const before = (id: string | null): string | null => id && gone.has(id) ? before(gone.get(id)!) : id;
  for (const row of rows) if (!gone.has(row.id) && row.afterBlockId && gone.has(row.afterBlockId)) await tx.experimentScheduleBlock.update({ where: { id: row.id }, data: { afterBlockId: before(row.afterBlockId) } });
}

/** The day must be one of the experiment's days, so a part never lands outside the schedule. */
function assertDay(experiment: Locked, day: string) {
  if (!daysOf(experiment).some(item => item.dayKey === day)) throw new Error("这一天不在本实验的日程里；先在执行记录末尾“＋ 加一天”。");
}

/** What a step has on record, in the record's words; empty when nothing. */
async function recordsOf(tx: Tx, experiment: Locked, stepIds: readonly string[]) {
  const plan = safePlan(experiment.protocolRun?.executionPlanJson);
  const files = new Set((await tx.attachmentLink.findMany({ where: { targetType: "experiment_step", targetId: { in: [...stepIds] } }, select: { targetId: true } })).map(link => link.targetId));
  return new Map(experiment.steps.filter(step => stepIds.includes(step.id)).map(step => {
    const what = [
      step.completed || step.completedAt ? "已勾选完成" : "", step.deviationNote ? "记了偏差" : "", step.timerStartedAt || step.timerPausedAt ? "计过时" : "",
      plan?.actualValues[step.id] ? "填了实测值" : "", plan?.skips[step.id] ? "已跳过" : "", plan && Object.keys(plan.mixes).some(key => key.startsWith(`${step.id}:`)) ? "确认过配液" : "",
      plan?.runMixes[step.id]?.length ? "加了配液卡" : "", files.has(step.id) ? "有照片或文件" : "", step._count.results ? "有结果" : "", step._count.entries ? "有记录条目" : "", step._count.inventoryTransactions ? "有库存记录" : "",
      step._count.events && !(step.completed || step.timerStartedAt || step.timerPausedAt) ? "有执行事件" : "",
    ].filter(Boolean);
    return [step.id, what] as const;
  }).filter(([, what]) => what.length));
}
function safePlan(value: unknown): ExecutionPlan | undefined {
  try { return parseExecutionPlan(value); } catch { return undefined; }
}

/** The part as the record names it: "质粒转染" or the custom steps' title. */
const partTitle = (step: { groupTitle: string }) => step.groupTitle === "Custom experiment steps" ? "自定义步骤" : experimentStepGroupHeading(step.groupTitle).title;

/** The day each step of a part is on, by run step id; unplaced steps are absent. */
function stepDays(experiment: Locked) {
  const plan = experimentDayPlanOf(experiment);
  const days = new Map<string, string>();
  if (!plan) { for (const step of experiment.steps) days.set(step.id, labDayKey(experiment.date)); return days; }
  for (const day of plan.days) for (const id of day.stepIds) days.set(id, day.dayKey);
  return days;
}

async function addMethod(tx: Tx, experiment: Locked, day: string, method: z.infer<typeof methodSchema>) {
  await keepDayOne(tx, experiment);
  const groupOrder = experiment.steps.reduce((max, step) => Math.max(max, step.groupOrder + 1), 0);
  if (method.kind === "custom") {
    const lines = parseCustomExperimentSteps(method.steps);
    if (!lines.length) throw new Error("写下至少一步：每行一步。");
    const groupKey = `manual:${randomUUID().slice(0, 8)}`;
    const refs = lines.map((_, index) => `${groupKey}:${index + 1}`);
    await tx.experimentStep.createMany({ data: lines.map((line, index) => ({
      experimentId: experiment.id, protocolStepRef: refs[index], groupKey, groupTitle: method.title?.trim() || "自定义步骤", groupOrder,
      order: index + 1, title: line.title, description: line.description ?? "", requiresConfirmation: true, allowsDeviation: true,
    })) });
    await placeOnDay(tx, experiment.id, day, refs);
    return { groupKeys: [groupKey], steps: lines.length };
  }
  const snapshot = (experiment.protocolSnapshotJson ?? {}) as { versions?: Array<{ protocolVersionId: string; humanCode?: string; displayVersion?: string }>; methodMode?: string };
  const present = new Map((snapshot.versions ?? []).map(version => [version.protocolVersionId, version]));
  const ids = [...new Set(method.protocolVersionIds)];
  const repeated = ids.find(id => present.has(id));
  if (repeated) {
    const version = present.get(repeated)!;
    const where = experiment.steps.find(step => step.groupKey === repeated);
    throw new Error(`${version.humanCode ?? "这份规程"} v${version.displayVersion ?? ""} 已在本实验中（${dayName(experiment, where ? stepDays(experiment).get(where.id) ?? null : null)}）。同一版本在一个实验里只加入一次。`);
  }
  const { orderedVersions, contracts, snapshotVersions, stepSources } = await captureProtocolVersions(tx, ids);
  if ([...contracts.values()].every(contract => !contract.steps.length)) throw new Error("所选规程没有确认的执行步骤；先在规程里整理步骤。");
  const plan = safePlan(experiment.protocolRun?.executionPlanJson);
  const groups = plan?.groups ?? [];
  const stepGroups: Record<string, string> = {};
  const refs: string[] = [];
  for (const draft of buildProtocolExperimentSteps(stepSources).map(draft => ({ ...draft, groupOrder: groupOrder + draft.groupOrder }))) {
    const created = await tx.experimentStep.create({ data: { experimentId: experiment.id, ...draft } });
    if (!refs.includes(draft.protocolStepRef)) refs.push(draft.protocolStepRef);
    const systems = contracts.get(draft.groupKey)?.systems;
    if (!groups.length || !systems) continue;
    // An experiment run in groups: each group gets its own copy of the step, as when the groups were set (configureRunGroups).
    const sourceRef = draft.protocolStepRef.slice(draft.groupKey.length + 1);
    if (systems.rules.some(rule => rule.target === "step" && rule.targetId === sourceRef && rule.scope === "experiment")) { stepGroups[created.id] = "shared"; continue; }
    stepGroups[created.id] = groups[0].id;
    for (const group of groups.slice(1)) {
      const copy = await tx.experimentStep.create({ data: { experimentId: experiment.id, ...draft } });
      stepGroups[copy.id] = group.id;
    }
  }
  const order = experiment.protocolVersions.reduce((max, link) => Math.max(max, link.order + 1), 0);
  const primary = experiment.primaryProtocolVersionId ?? orderedVersions[0].id;
  await tx.experimentProtocolVersion.createMany({ data: orderedVersions.map((version, index) => ({ experimentId: experiment.id, protocolVersionId: version.id, role: version.id === primary && !experiment.primaryProtocolVersionId ? "primary" : "supporting", order: order + index })) });
  await tx.itemLink.createMany({ data: orderedVersions.map(version => ({ sourceType: "experiment", sourceId: experiment.id, targetType: "protocol_version", targetId: version.id, linkType: "executed_from", createdBy: "system", note: `Added to ${day}; exact version fixed when added.` })) });
  await tx.experiment.update({ where: { id: experiment.id }, data: { primaryProtocolVersionId: primary, protocolSnapshotJson: json({ ...snapshot, methodMode: "protocol", versions: [...(snapshot.versions ?? []), ...snapshotVersions] }) } });
  if (experiment.researchPlan) await linkProtocolsToPlan(tx, experiment.researchPlan, orderedVersions.map(version => version.protocolId));
  if (!experiment.protocolRun) await tx.protocolRun.create({ data: { protocolVersionId: primary, experimentId: experiment.id, status: experiment.status, parametersJson: {}, calculatedConsumptionJson: [] } });
  // Pages holding the run's revision reload before their next write; a run left pointing at a removed Protocol follows the first one again.
  else await tx.protocolRun.update({ where: { experimentId: experiment.id }, data: {
    ...(present.has(experiment.protocolRun.protocolVersionId) ? {} : { protocolVersionId: primary }),
    ...(plan ? { executionPlanJson: json({ ...plan, stepGroups: { ...plan.stepGroups, ...stepGroups }, revision: plan.revision + 1 }) } : {}),
  } });
  await placeOnDay(tx, experiment.id, day, refs);
  return { groupKeys: orderedVersions.map(version => version.id), steps: refs.length };
}

/** Why a part cannot be removed or rewritten: its first step with a record, and where. */
async function removalBlocker(tx: Tx, experiment: Locked, groupKey: string) {
  const steps = experiment.steps.filter(step => step.groupKey === groupKey);
  if (!steps.length) return "这一部分已不在本实验中；请刷新。";
  const records = await recordsOf(tx, experiment, steps.map(step => step.id));
  const first = steps.find(step => records.has(step.id));
  if (first) return `${partTitle(first)} 第 ${first.order} 步${records.get(first.id)!.join("、")}（${dayName(experiment, stepDays(experiment).get(first.id) ?? null)}）。有记录的步骤不能移除。`;
  // A Protocol's confirmed systems, measured inputs and calculations belong to the run as a whole, not to one step.
  const plan = safePlan(experiment.protocolRun?.executionPlanJson);
  if (plan && Object.keys(plan.versions).some(id => id.split("@")[0] === groupKey)) return `${partTitle(steps[0])} 已确认体系或计算。确认过的部分不能移除。`;
  return null;
}

async function removePart(tx: Tx, experiment: Locked, groupKey: string) {
  const blocker = await removalBlocker(tx, experiment, groupKey);
  if (blocker) throw new Error(blocker);
  const steps = experiment.steps.filter(step => step.groupKey === groupKey);
  const refs = new Set(steps.map(step => step.protocolStepRef ?? step.id));
  await unplace(tx, experiment.id, refs);
  await tx.experimentStep.deleteMany({ where: { experimentId: experiment.id, groupKey } });
  if (!protocolKeys(experiment.protocolSnapshotJson).has(groupKey)) return partTitle(steps[0]);
  const snapshot = (experiment.protocolSnapshotJson ?? {}) as { versions?: Array<{ protocolVersionId: string }>; methodMode?: string };
  const versions = (snapshot.versions ?? []).filter(version => version.protocolVersionId !== groupKey);
  const links = experiment.protocolVersions.filter(link => link.protocolVersionId !== groupKey);
  const primary = experiment.primaryProtocolVersionId === groupKey ? links[0]?.protocolVersionId ?? null : experiment.primaryProtocolVersionId;
  // An older record may list a version in its snapshot without a link row.
  await tx.experimentProtocolVersion.deleteMany({ where: { experimentId: experiment.id, protocolVersionId: groupKey } });
  if (primary && primary !== experiment.primaryProtocolVersionId) await tx.experimentProtocolVersion.update({ where: { experimentId_protocolVersionId: { experimentId: experiment.id, protocolVersionId: primary } }, data: { role: "primary" } });
  await tx.itemLink.deleteMany({ where: { sourceType: "experiment", sourceId: experiment.id, targetType: "protocol_version", targetId: groupKey, linkType: "executed_from" } });
  await tx.experiment.update({ where: { id: experiment.id }, data: { primaryProtocolVersionId: primary, protocolSnapshotJson: json({ ...snapshot, methodMode: versions.length ? "protocol" : "custom", versions }) } });
  const plan = safePlan(experiment.protocolRun?.executionPlanJson);
  if (experiment.protocolRun) {
    const gone = new Set(steps.map(step => step.id));
    // The run keeps its row (its history points at it); it follows the remaining first Protocol.
    await tx.protocolRun.update({ where: { experimentId: experiment.id }, data: {
      ...(primary ? { protocolVersionId: primary } : {}),
      ...(plan ? { executionPlanJson: json({ ...plan, revision: plan.revision + 1,
        versions: Object.fromEntries(Object.entries(plan.versions).filter(([id]) => id.split("@")[0] !== groupKey)),
        stepGroups: Object.fromEntries(Object.entries(plan.stepGroups).filter(([id]) => !gone.has(id))) }) } : {}),
    } });
  }
  return partTitle(steps[0]);
}

const reload = (tx: Tx, experiment: Locked) => locked(tx, experiment.id);

export async function addDayMethod(raw: z.input<typeof addDayMethodInput>) {
  const input = addDayMethodInput.parse(raw);
  return prisma.$transaction(async tx => {
    const experiment = await locked(tx, input.experimentId);
    assertDay(experiment, input.dayKey);
    const added = await addMethod(tx, experiment, input.dayKey, input.method);
    assertRunReadable(await reload(tx, experiment));
    await tx.activityLog.create({ data: { action: "experiment_day_method_added", targetType: "experiment", targetId: experiment.id, metadataJson: { day: input.dayKey, kind: input.method.kind, steps: added.steps, protocolVersionIds: input.method.kind === "protocol" ? input.method.protocolVersionIds : [] } } });
    return added;
  });
}

/** A part's steps on one day (from a chosen step on) go to another day; unscheduled ones are placed. Done steps stay on their day. */
export async function moveDayPart(raw: z.input<typeof moveDayPartInput>) {
  const input = moveDayPartInput.parse(raw);
  return prisma.$transaction(async tx => {
    let experiment = await locked(tx, input.experimentId);
    assertDay(experiment, input.toDayKey);
    if (input.fromDayKey === input.toDayKey) throw new Error("已在这一天。");
    await keepDayOne(tx, experiment);
    experiment = await reload(tx, experiment);
    const steps = scheduleSteps(experiment).filter(step => step.groupKey === input.groupKey);
    if (!steps.length) throw new Error("这一部分已不在本实验中；请刷新。");
    const rows = experiment.scheduleBlocks.map(blockView);
    const placedOn = new Map<string, string>();
    for (const block of sortBlocks(rows)) if (block.kind === "steps") for (const ref of block.stepRefs) if (!placedOn.has(ref)) placedOn.set(ref, labDayKey(block.startAt));
    let chunk = steps.filter(step => (placedOn.get(step.ref) ?? null) === input.fromDayKey);
    if (input.fromStepRef) { const at = chunk.findIndex(step => step.ref === input.fromStepRef); if (at < 0) throw new Error("这一步不在这一天。"); chunk = chunk.slice(at); }
    if (!chunk.length) throw new Error("这一天没有这部分的步骤；请刷新。");
    // A step with anything on record (in any sample group) stays on the day it happened.
    const records = await recordsOf(tx, experiment, chunk.flatMap(step => step.stepIds));
    const kept = chunk.find(step => step.completed || step.stepIds.some(id => records.has(id)));
    if (kept) throw new Error(`第 ${kept.position} 步${kept.stepIds.map(id => records.get(id)).find(Boolean)?.join("、") ?? "已完成"}，留在这一天；从后面没有记录的一步起移动。`);
    const stepMap = new Map(steps.map(step => [step.ref, step]));
    if (rows.some(block => block.stepRefs.some(ref => chunk.some(step => step.ref === ref)) && blockState(block, stepMap) === "done")) throw new Error("所在的段已完成，不能移动。");
    const refs = chunk.map(step => step.ref);
    if (input.fromDayKey) await unplace(tx, experiment.id, new Set(refs), input.fromDayKey);
    await placeOnDay(tx, experiment.id, input.toDayKey, refs);
    await tx.activityLog.create({ data: { action: "experiment_day_part_moved", targetType: "experiment", targetId: experiment.id, metadataJson: { groupKey: input.groupKey, from: input.fromDayKey, to: input.toDayKey, steps: refs.length } } });
    return { steps: refs.length };
  });
}

export async function removeDayPart(raw: z.input<typeof dayPartInput>) {
  const input = dayPartInput.parse(raw);
  return prisma.$transaction(async tx => {
    const experiment = await locked(tx, input.experimentId);
    const title = await removePart(tx, experiment, input.groupKey);
    assertRunReadable(await reload(tx, experiment));
    await tx.activityLog.create({ data: { action: "experiment_day_part_removed", targetType: "experiment", targetId: experiment.id, metadataJson: { groupKey: input.groupKey, title } } });
    return { title };
  });
}

/** 换版本 / 编辑步骤: the part is removed and its replacement added on the day it started, in one step; only while nothing is recorded. */
export async function replaceDayPart(raw: z.input<typeof replaceDayPartInput>) {
  const input = replaceDayPartInput.parse(raw);
  return prisma.$transaction(async tx => {
    const experiment = await locked(tx, input.experimentId);
    const days = stepDays(experiment);
    const first = experiment.steps.find(step => step.groupKey === input.groupKey && days.has(step.id));
    const day = first ? days.get(first.id)! : daysOf(experiment)[0].dayKey;
    if (input.method.kind === "protocol" && input.method.protocolVersionIds.includes(input.groupKey)) throw new Error("已是这一版。");
    const title = await removePart(tx, experiment, input.groupKey);
    const added = await addMethod(tx, await reload(tx, experiment), day, input.method);
    assertRunReadable(await reload(tx, experiment));
    await tx.activityLog.create({ data: { action: "experiment_day_part_replaced", targetType: "experiment", targetId: experiment.id, metadataJson: { groupKey: input.groupKey, title, day, kind: input.method.kind, protocolVersionIds: input.method.kind === "protocol" ? input.method.protocolVersionIds : [] } } });
    return added;
  });
}

/** One more day after the last, as the schedule's "加一天" (Q433). An experiment without days becomes two days: day 1 holds what it has. */
export async function addScheduleDay(experimentId: string) {
  return prisma.$transaction(async tx => {
    const experiment = await locked(tx, experimentId);
    const count = daysOf(experiment).length;
    if (count >= MAX_SCHEDULE_DAYS) throw new Error(`日程最长 ${MAX_SCHEDULE_DAYS} 天。`);
    // A one-day record without a schedule: what is already written stays with day 1 rather than falling under 未分天的记录.
    const written = experimentDayPlanOf(experiment) ? undefined : writingOnFirstDay(experiment.contentJson, labDayKey(experiment.date));
    await tx.experiment.update({ where: { id: experiment.id }, data: { scheduleDays: count + 1, ...(written ? { contentJson: json(written) } : {}) } });
    await tx.activityLog.create({ data: { action: "experiment_schedule_day_added", targetType: "experiment", targetId: experiment.id, metadataJson: { days: count + 1 } } });
    return { days: count + 1 };
  });
}

/**
 * What the day menus of the record and edit pages need (Q428–Q433): the days, and each part with its steps' days and why it cannot be
 * removed now (null: it can). Read only.
 */
export async function loadDayControls(experimentId: string): Promise<DayControlsData | undefined> {
  return prisma.$transaction(async tx => {
    const experiment = await tx.experiment.findUnique({ where: { id: experimentId }, include: {
      protocolRun: true, scheduleBlocks: true, protocolVersions: { orderBy: { order: "asc" } }, researchPlan: { select: { id: true, projectId: true } },
      steps: { orderBy: [{ groupOrder: "asc" }, { order: "asc" }], include: { _count: { select: { events: true, results: true, entries: true, inventoryTransactions: true } } } },
    } });
    if (!experiment) return undefined;
    const days = daysOf(experiment);
    const onDay = stepDays(experiment);
    const plan = experimentDayPlanOf(experiment);
    const placed = (id: string) => plan ? onDay.get(id) ?? null : days[0].dayKey;
    const snapshot = (experiment.protocolSnapshotJson ?? {}) as { versions?: Array<{ protocolVersionId: string; protocolId?: string }> };
    const parts: DayControlsData["parts"] = {};
    const protocols = protocolKeys(experiment.protocolSnapshotJson);
    for (const key of [...new Set(experiment.steps.map(step => step.groupKey))]) {
      const steps = experiment.steps.filter(step => step.groupKey === key);
      const seen = new Set<string>();
      const custom = !protocols.has(key);
      parts[key] = {
        kind: custom ? "custom" : "protocol", title: partTitle(steps[0]), blocker: await removalBlocker(tx, experiment, key),
        ...(custom ? { lines: steps.map(step => step.description ? `${step.title} | ${step.description}` : step.title).join("\n") } : { versionId: key, protocolId: snapshot.versions?.find(version => version.protocolVersionId === key)?.protocolId }),
        // One entry per step reference: sample-group copies share it.
        steps: steps.flatMap(step => { const ref = step.protocolStepRef ?? step.id; if (seen.has(ref)) return []; seen.add(ref); return [{ ref, order: step.order, completed: step.completed, dayKey: placed(step.id) }]; }),
      };
    }
    return { experimentId, days, parts, canAddDay: days.length < MAX_SCHEDULE_DAYS };
  });
}

/** The run view stays readable after a change: a broken snapshot would stop the record page. */
export function assertRunReadable(experiment: { protocolSnapshotJson: unknown; protocolRun: { executionPlanJson: unknown } | null; steps: Array<{ id: string; protocolStepRef: string | null; groupKey: string; completed: boolean }> }) {
  structuredRunView(experiment.protocolSnapshotJson, experiment.protocolRun?.executionPlanJson, experiment.steps);
}
