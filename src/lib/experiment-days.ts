/**
 * 按天的实验记录 (Q426–Q434): an experiment's schedule read as days for the record. Pure, so the record page, the edit form,
 * print and export all derive the same days from the same blocks.
 *
 * - Days run from the schedule's first day (the experiment's date, or an earlier block) for as many days as the author set,
 *   never fewer than the blocks reach.
 * - A day holds the steps of its blocks, in time order, and its items. A day with no blocks is "unplanned".
 * - Without any block of steps, every step belongs to day 1 (an experiment without blocks is one block on its date).
 *   Once steps are placed, those placed nowhere are "unscheduled".
 * - Without blocks and with a single day there are no days: the record stays as it always was.
 */
import { experimentSections, normalizeScientificDocument, type ScientificDocument } from "./scientific-document";
import { addDays, blockTitle, daysBetween, formatWait, formatWindow, labClock, labDayKey, localizeBlockTitle, scheduleDayLabel, scheduleSpan, sortBlocks, type ScheduleBlock, type ScheduleStep } from "./experiment-schedule";

export type DayStatus = "unplanned" | "todo" | "active" | "done";
export type DayItem = { id: string; title: string; clock: string | null; done: boolean; note: string | null };
/** How long the day waits after an earlier day's block: overnight, or a minimum (and maximum) in minutes. */
export type DayWait = { overnight: boolean; minMinutes: number | null; maxMinutes: number | null };
export type ExperimentDay = {
  index: number; dayKey: string;
  /** Run steps (row ids) of this day, in the order they are done. */
  stepIds: string[];
  items: DayItem[];
  /** What the day is about: its blocks' names, in time order (steps blocks read "<Protocol> · steps a–b"). */
  titles: string[];
  status: DayStatus;
  wait?: DayWait;
  /** Something is written under this day in 执行记录 (Q427): it keeps its own heading even when nothing is planned. */
  written?: boolean;
};
export type ExperimentDayPlan = { days: ExperimentDay[]; unscheduledStepIds: string[] };

export function experimentDayPlan(input: { date: Date | string; scheduleDays: number | null; blocks: readonly ScheduleBlock[]; steps: readonly ScheduleStep[]; written?: readonly string[] }): ExperimentDayPlan | undefined {
  const blocks = sortBlocks(input.blocks);
  if (!blocks.length && (input.scheduleDays ?? 1) < 2) return undefined;
  const dateKey = labDayKey(input.date);
  const first = blocks.length && labDayKey(blocks[0].startAt) < dateKey ? labDayKey(blocks[0].startAt) : dateKey;
  const count = Math.max(input.scheduleDays ?? 1, scheduleSpan(first, blocks));
  const steps = new Map(input.steps.map(step => [step.ref, step]));
  const completedRow = new Map(input.steps.flatMap(step => step.stepIds.map(id => [id, step.completed] as const)));
  const placesSteps = blocks.some(block => block.kind === "steps" && block.stepRefs.some(ref => steps.has(ref)));
  const dayOf = new Map(blocks.map(block => [block.id, daysBetween(first, labDayKey(block.startAt))]));
  const placed = new Set<string>();
  const days: ExperimentDay[] = Array.from({ length: count }, (_, offset) => {
    const dayKey = addDays(first, offset);
    const own = blocks.filter(block => dayOf.get(block.id) === offset);
    const stepIds: string[] = [];
    for (const block of own) if (block.kind === "steps") for (const ref of block.stepRefs) {
      const step = steps.get(ref);
      if (!step || placed.has(ref)) continue;
      placed.add(ref);
      stepIds.push(...step.stepIds);
    }
    const items = own.filter(block => block.kind === "task").map(block => ({ id: block.id, title: blockTitle(block, steps), clock: block.allDay ? null : labClock(block.startAt), done: Boolean(block.doneAt), note: block.note?.trim() || null }));
    const titles = own.filter(block => block.kind === "task" || block.stepRefs.some(ref => steps.has(ref)) || block.title?.trim()).map(block => blockTitle(block, steps));
    const earlier = own.find(block => block.afterBlockId && (dayOf.get(block.afterBlockId) ?? offset) < offset);
    const wait = earlier ? { overnight: Boolean(earlier.gapSource?.startsWith("overnight:")), minMinutes: earlier.minGapMinutes, maxMinutes: earlier.maxGapMinutes } : undefined;
    return { index: offset + 1, dayKey, stepIds, items, titles, status: "unplanned" as DayStatus, ...(wait && (wait.overnight || wait.minMinutes !== null) ? { wait } : {}) };
  });
  const unplaced = input.steps.filter(step => !placed.has(step.ref)).flatMap(step => step.stepIds);
  if (!placesSteps && days[0]) {
    days[0].stepIds.unshift(...unplaced);
    if (!days[0].titles.length && unplaced.length) days[0].titles.push(...new Set(input.steps.map(step => step.groupTitle)));
  }
  const written = new Set(input.written ?? []);
  for (const day of days) { day.status = dayStatus(day, completedRow); if (written.has(day.dayKey)) day.written = true; }
  return { days, unscheduledStepIds: placesSteps ? unplaced : [] };
}

/** Done when every step and item of the day is, under way when some are; a day with nothing on it is unplanned. */
function dayStatus(day: Pick<ExperimentDay, "stepIds" | "items">, completed: ReadonlyMap<string, boolean>): DayStatus {
  const states = [...day.stepIds.map(id => completed.get(id) ?? false), ...day.items.map(item => item.done)];
  if (!states.length) return "unplanned";
  if (states.every(Boolean)) return "done";
  return states.some(Boolean) ? "active" : "todo";
}

const statusZh: Record<DayStatus, string> = { unplanned: "未安排", todo: "未开始", active: "进行中", done: "已完成" };
const statusEn: Record<DayStatus, string> = { unplanned: "Nothing planned", todo: "Not started", active: "In progress", done: "Done" };
export const dayStatusLabel = (status: DayStatus, zh: boolean) => (zh ? statusZh : statusEn)[status];

/** "过夜", "48 h", "24–72 h": the wait before a day, as the summary and the record write it. */
export function dayWaitLabel(wait: DayWait, zh: boolean) {
  if (wait.overnight) return zh ? "过夜" : "Overnight";
  if (wait.minMinutes === null) return "";
  return wait.maxMinutes !== null && wait.maxMinutes !== wait.minMinutes ? formatWindow(wait.minMinutes, wait.maxMinutes) : formatWait(wait.minMinutes * 60);
}

/** The day's heading: "第 2 天 · 11/10 周二". */
export const dayLabel = (day: Pick<ExperimentDay, "index" | "dayKey">, zh: boolean) => scheduleDayLabel(day.index, day.dayKey, zh);
/** The days to show: two or more empty days in a row read as one run ("第 5–7 天 · 未安排"), so a long schedule stays short. */
export function dayRuns<T extends Pick<ExperimentDay, "index" | "dayKey" | "status" | "written">>(days: readonly T[]): Array<{ first: T; last: T }> {
  const runs: Array<{ first: T; last: T }> = [];
  const empty = (day: T) => day.status === "unplanned" && !day.written;
  for (const day of days) {
    const run = runs.at(-1);
    if (run && empty(day) && empty(run.last) && run.last.index === day.index - 1) run.last = day;
    else runs.push({ first: day, last: day });
  }
  return runs;
}

/** "第 5–7 天 · 11/06–11/08" or "Days 5–7 · 11/06–11/08"; a single day reads as `dayLabel`. */
export function dayRunLabel(first: Pick<ExperimentDay, "index" | "dayKey">, last: Pick<ExperimentDay, "index" | "dayKey">, zh: boolean) {
  if (first.index === last.index) return dayLabel(first, zh);
  const date = (key: string) => key.slice(5).replace("-", "/");
  return zh ? `第 ${first.index}–${last.index} 天 · ${date(first.dayKey)}–${date(last.dayKey)}` : `Days ${first.index}–${last.index} · ${date(first.dayKey)}–${date(last.dayKey)}`;
}

/** What a day holds, in one line: its blocks' names. */
export const dayContent = (day: Pick<ExperimentDay, "titles">, zh: boolean) => day.titles.map(title => localizeBlockTitle(title, zh)).join(zh ? "；" : "; ");

/** The schedule as a small table at the head of 实验设置与样本, for print and export (Q432). Only experiments of two days or more. */
export function dayPlanTable(plan: ExperimentDayPlan | undefined) {
  if (!plan || plan.days.length < 2) return [];
  return [
    { id: "run-derived:days:title", type: "text" as const, text: "日程" },
    { id: "run-derived:days", type: "table" as const, rows: [["天", "日期", "内容", "状态"], ...dayRuns(plan.days).map(({ first: day, last }) => {
      const [label, date] = dayRunLabel(day, last, true).split(" · ");
      return [label, date, [day.wait ? `（${dayWaitLabel(day.wait, true)}${day.wait.overnight ? "" : " "}后）` : "", dayContent(day, true) || "—"].join(""), dayStatusLabel(day.status, true)];
    })] },
  ];
}

/** The schedule table at the head of 实验设置与样本 in an exported document (Q432); the record page draws it live instead. */
export function withExperimentDays<T extends { sections: Array<{ key: string; blocks: unknown[] }> }>(document: T, plan: ExperimentDayPlan | undefined): T {
  const table = dayPlanTable(plan);
  if (!table.length) return document;
  return { ...document, sections: document.sections.map(section => section.key === "setup" ? { ...section, blocks: [...table, ...section.blocks] } : section) };
}

/** The days written under in 执行记录 (Q427), for `experimentDayPlan`'s `written`. */
export function writtenDays(blocks: ReadonlyArray<{ day?: string }>) {
  return [...new Set(blocks.flatMap(block => block.day ? [block.day] : []))];
}

/** The run a block written under `dayKey` reads under, by its first day's key; undefined when that day is not in the schedule (未分天的记录). */
export function writingRunKey(dayKey: string | undefined, runs: ReadonlyArray<{ first: Pick<ExperimentDay, "dayKey">; last: Pick<ExperimentDay, "dayKey"> }>) {
  if (!dayKey) return undefined;
  return runs.find(run => run.first.dayKey <= dayKey && dayKey <= run.last.dayKey)?.first.dayKey;
}

/**
 * A schedule change that moves days (Q427): a day put in before `insert` pushes what is written from that day on one day later; a day taken
 * out at `remove` leaves its writing on no day (未分天的记录) and pulls what follows one day earlier; `shift` moves all of it, as the
 * experiment's date moves the whole schedule. Only authored blocks of 执行记录 carry a day.
 */
export type DayEdit = { insert: string } | { remove: string } | { shift: number };
export function moveWrittenDays<T extends { id: string; day?: string }>(blocks: readonly T[], edits: readonly DayEdit[]): T[] {
  return blocks.map(block => {
    let day = block.day;
    for (const edit of edits) {
      if (!day) break;
      if ("shift" in edit) day = addDays(day, edit.shift);
      else if ("insert" in edit) { if (day >= edit.insert) day = addDays(day, 1); }
      else if (day === edit.remove) day = undefined;
      else if (day > edit.remove) day = addDays(day, -1);
    }
    if (day === block.day) return block;
    const { day: _removed, ...rest } = block;
    void _removed;
    return (day ? { ...rest, day } : rest) as T;
  });
}

/** A one-day record turning into days: what is written in 执行记录 so far belongs to day 1. Undefined when nothing is written. */
export function writingOnFirstDay(contentJson: unknown, dayKey: string): ScientificDocument | undefined {
  const document = normalizeScientificDocument(contentJson, experimentSections);
  const section = document.sections.find(item => item.key === "execution");
  if (!section?.blocks.some(block => !block.day)) return undefined;
  return { ...document, sections: document.sections.map(item => item === section ? { ...item, blocks: item.blocks.map(block => block.day ? block : { ...block, day: dayKey }) } : item) };
}

/** The record with its writing moved by `edits`; undefined when nothing written moves. */
export function movedWriting(contentJson: unknown, edits: readonly DayEdit[]): ScientificDocument | undefined {
  if (!edits.length) return undefined;
  const document = normalizeScientificDocument(contentJson, experimentSections);
  const section = document.sections.find(item => item.key === "execution");
  if (!section?.blocks.some(block => block.day)) return undefined;
  return { ...document, sections: document.sections.map(item => item === section ? { ...item, blocks: moveWrittenDays(item.blocks, edits) } : item) };
}
