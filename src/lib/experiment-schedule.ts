/**
 * 多日排程 (Q259–Q270): an experiment's steps placed on days. Pure: the first draft from the Protocol's own waits, moving a
 * block (and what waits for it), and the marks a block carries (outside its time window, weekend, after hours, overlap).
 * Instants are ISO strings; days and clock times are read in Beijing time, which has no daylight saving, so a fixed
 * +8 h offset is exact (the same clock as lab-time.ts).
 */
import { normalizeUnit, units } from "./calculators/quantities";
import { recognizeQuantity, type RecognizedQuantity } from "./protocol-chips";

const LAB_OFFSET_MS = 8 * 3_600_000;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** How long a step makes the next one wait, in seconds: its adopted time, and the window the source allows. */
export type ScheduleWait = { seconds: number; minSeconds: number; maxSeconds: number; overnight?: boolean };
/** A step as the schedule sees it: one per stable reference, however many groups copied it. */
export type ScheduleStep = {
  ref: string; stepIds: string[]; title: string; groupKey: string; groupTitle: string;
  /** 1-based, within its Protocol. */
  position: number;
  completed: boolean;
  wait?: ScheduleWait;
};
export type ScheduleBlockKind = "steps" | "task";
export type ScheduleBlock = {
  id: string; kind: ScheduleBlockKind;
  /** Null: shown as "<Protocol> · steps a–b". */
  title: string | null;
  stepRefs: string[]; startAt: string; allDay: boolean; estimatedMinutes: number | null;
  afterBlockId: string | null; minGapMinutes: number | null; maxGapMinutes: number | null;
  /** "step:<ref>", "overnight:<ref>" or "manual". */
  gapSource: string | null;
  note: string | null;
  /** Items only. */
  doneAt: string | null;
};
/** Minutes from midnight; weekdays 1 (Monday) to 7. */
export type WorkHours = { start: number; end: number; workdays: number[] };
export const defaultWorkHours: WorkHours = { start: 9 * 60, end: 18 * 60, workdays: [1, 2, 3, 4, 5] };
/** 过夜 (Q261): until the next working morning, within 12–20 h. */
export const overnightWindow = { minSeconds: 12 * 3600, maxSeconds: 20 * 3600 };
const overnightText = /过夜|overnight|\bO\/N\b/i;

const iso = (ms: number) => new Date(ms).toISOString();
const labShift = (at: string | Date) => new Date(new Date(at).getTime() + LAB_OFFSET_MS);
const pad = (value: number) => String(value).padStart(2, "0");

/** "2026-11-03": the Beijing day of an instant. */
export function labDayKey(at: string | Date) {
  const shifted = labShift(at);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}
/** Minutes since Beijing midnight. */
export function labMinuteOfDay(at: string | Date) {
  const shifted = labShift(at);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}
/** The instant of a Beijing day and clock time. */
export function labInstant(dayKey: string, minutes: number) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return iso(Date.UTC(year, month - 1, day) - LAB_OFFSET_MS + minutes * MINUTE_MS);
}
export function addDays(dayKey: string, days: number) {
  return labDayKey(new Date(Date.parse(labInstant(dayKey, 12 * 60)) + days * DAY_MS));
}
/** 1 (Monday) to 7 (Sunday). */
export function weekday(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() || 7;
}
export function daysBetween(fromDay: string, toDay: string) {
  return Math.round((Date.parse(labInstant(toDay, 0)) - Date.parse(labInstant(fromDay, 0))) / DAY_MS);
}
/** "09:30" in Beijing time. */
export function labClock(at: string | Date) {
  const minutes = labMinuteOfDay(at);
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** The moment work can go on: itself during working hours, else the start of the next working period. */
export function nextWorkMoment(at: string, hours: WorkHours = defaultWorkHours) {
  let day = labDayKey(at);
  const minute = labMinuteOfDay(at);
  if (hours.workdays.includes(weekday(day))) {
    if (minute < hours.start) return labInstant(day, hours.start);
    if (minute <= hours.end) return at;
  }
  for (let guard = 0; guard < 14; guard += 1) {
    day = addDays(day, 1);
    if (hours.workdays.includes(weekday(day))) return labInstant(day, hours.start);
  }
  return at;
}

/** Whether a step's own words say it runs overnight (过夜, overnight, O/N): the schedule reads it, no countdown needed. */
export const saysOvernight = (text: string) => overnightText.test(text);

/**
 * Times written in text, for Protocols written before time chips, read the way typing them in the editor would make
 * chips. A time that ends a list of time points ("0、24、48、72、96 h", "测试0.5、1、2、4 h") is when to measure, not a wait.
 */
export function textTimes(text: string) {
  const padded = `${text} `;
  const found = new Map<number, RecognizedQuantity>();
  for (let end = 1; end <= padded.length; end += 1) {
    const quantity = recognizeQuantity(padded.slice(0, end));
    // "20 min" is recognized before "20 min - 30 min" grows from the same start; the longer reading wins.
    if (quantity && (found.get(quantity.index)?.source.length ?? 0) < quantity.source.length) found.set(quantity.index, quantity);
  }
  return [...found.values()].filter(quantity => units[normalizeUnit(quantity.unit)]?.dimension === "time" && !/[、,，]\s*$/.test(text.slice(Math.max(0, quantity.index - 2), quantity.index)));
}

/** When a block ends: its start plus its estimate (half an hour when there is none; an all-day item has no length). */
export function blockEnd(block: Pick<ScheduleBlock, "startAt" | "estimatedMinutes" | "allDay">) {
  const minutes = block.estimatedMinutes ?? (block.allDay ? 0 : 30);
  return iso(Date.parse(block.startAt) + minutes * MINUTE_MS);
}

export type DraftOptions = { hours?: WorkHours; perStepMinutes?: number; breakMinutes?: number; newId: () => string };

/**
 * The first draft (Q260): the steps in run order; a wait of 4 h or more, an overnight step, or one that would run past
 * the end of the working day ends the block, and the next block starts when the wait is over (moved to the next working
 * morning when that is after hours). A new Protocol starts a new block at once. Each block counts 5 min per step plus
 * the short waits inside it. Completed steps are left out: a running experiment is drafted from where it stands.
 */
export function draftSchedule(steps: ScheduleStep[], startAt: string, { hours = defaultWorkHours, perStepMinutes = 5, breakMinutes = 240, newId }: DraftOptions): ScheduleBlock[] {
  const blocks: ScheduleBlock[] = [];
  let cursor = Date.parse(startAt);
  let open: { block: ScheduleBlock; start: number; groupKey: string } | null = null;
  let gap: { after: string; min: number | null; max: number | null; source: string | null } | null = null;
  const close = () => {
    if (!open) return;
    open.block.estimatedMinutes = Math.max(perStepMinutes, Math.round((cursor - open.start) / MINUTE_MS));
    gap = { after: open.block.id, min: 0, max: null, source: null };
    open = null;
  };
  for (const step of steps.filter(item => !item.completed)) {
    if (open && open.groupKey !== step.groupKey) close();
    if (!open) {
      const block: ScheduleBlock = { id: newId(), kind: "steps", title: null, stepRefs: [], startAt: iso(cursor), allDay: false, estimatedMinutes: null,
        afterBlockId: gap?.after ?? null, minGapMinutes: gap?.min ?? null, maxGapMinutes: gap?.max ?? null, gapSource: gap?.source ?? null, note: null, doneAt: null };
      blocks.push(block);
      open = { block, start: cursor, groupKey: step.groupKey };
      gap = null;
    }
    open.block.stepRefs.push(step.ref);
    cursor += perStepMinutes * MINUTE_MS;
    const wait = step.wait;
    if (!wait) continue;
    const endOfDay = Date.parse(labInstant(labDayKey(iso(cursor)), hours.end));
    const waitMs = wait.seconds * 1000;
    if (wait.overnight || waitMs >= breakMinutes * MINUTE_MS || cursor + waitMs > endOfDay) {
      const before: ScheduleBlock = open.block;
      close();
      const nextMorning = labInstant(addDays(labDayKey(iso(cursor)), 1), hours.start);
      const target = wait.overnight ? nextMorning : iso(cursor + waitMs);
      // Overnight means "until tomorrow morning": begun in the morning it runs nearer a day, so the window reaches the next
      // morning; carried over a weekend it still shows as outside the window.
      const maxGap = wait.overnight ? Math.max(wait.maxSeconds / 60, (Date.parse(nextMorning) - cursor) / MINUTE_MS) : wait.maxSeconds / 60;
      cursor = Date.parse(nextWorkMoment(target, hours));
      gap = { after: before.id, min: Math.round(wait.minSeconds / 60), max: Math.round(maxGap), source: `${wait.overnight ? "overnight" : "step"}:${step.ref}` };
    } else cursor += waitMs;
  }
  close();
  return blocks;
}

/** Done when every step in it is (an item when ticked off), under way when some are. A done block stays where it is. */
export function blockState(block: Pick<ScheduleBlock, "kind" | "stepRefs" | "doneAt">, steps: ReadonlyMap<string, Pick<ScheduleStep, "completed">>): "done" | "active" | "todo" {
  if (block.kind === "task") return block.doneAt ? "done" : "todo";
  const states = block.stepRefs.map(ref => steps.get(ref)?.completed ?? false);
  if (states.length && states.every(Boolean)) return "done";
  return states.some(Boolean) ? "active" : "todo";
}

/** The blocks that wait for this one, directly or through others. */
export function dependents(blocks: readonly ScheduleBlock[], id: string) {
  const found = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const current = queue.shift()!;
    for (const block of blocks) if (block.afterBlockId === current && !found.has(block.id) && block.id !== id) { found.add(block.id); queue.push(block.id); }
  }
  return found;
}

/**
 * Moving a block (Q263): by default the blocks that wait for it move with it, so every gap stays; `chain: false` moves
 * only this block. A done block cannot move, and nothing moves a done block along.
 */
export function moveBlock(blocks: readonly ScheduleBlock[], id: string, startAt: string, { chain = true, locked = new Set<string>() }: { chain?: boolean; locked?: ReadonlySet<string> } = {}) {
  const block = blocks.find(item => item.id === id);
  if (!block) throw new Error("This block is not in the schedule");
  const delta = Date.parse(startAt) - Date.parse(block.startAt);
  const moving = new Set([id, ...(chain ? dependents(blocks, id) : [])]);
  if ([...moving].some(item => locked.has(item))) throw new Error("A done block stays where it is");
  return blocks.map(item => moving.has(item.id) ? { ...item, startAt: iso(Date.parse(item.startAt) + delta) } : item);
}

/** Every block moved by the same amount: what changing the first day does (Q263). */
export function shiftSchedule(blocks: readonly ScheduleBlock[], deltaMs: number) {
  return blocks.map(block => ({ ...block, startAt: iso(Date.parse(block.startAt) + deltaMs) }));
}

export type BlockMark =
  | { kind: "window"; gapMinutes: number; minGapMinutes: number | null; maxGapMinutes: number | null }
  | { kind: "order"; gapMinutes: number }
  | { kind: "weekend" }
  | { kind: "hours" }
  | { kind: "overlap"; with: string };
export type OtherBlock = { id: string; label: string; startAt: string; estimatedMinutes: number | null; allDay: boolean };

/**
 * What a block should show (Q268): it starts before the block it waits for has ended, or outside the window that wait
 * allows; it falls on a weekend or outside working hours; or it overlaps another timed block, of this experiment or
 * another. Marks never block saving. A minute either way is not a mark.
 */
export function scheduleMarks(blocks: readonly ScheduleBlock[], { hours = defaultWorkHours, others = [] }: { hours?: WorkHours; others?: readonly OtherBlock[] } = {}) {
  const byId = new Map(blocks.map(block => [block.id, block]));
  const marks: Record<string, BlockMark[]> = {};
  const timed = [...blocks.filter(block => !block.allDay).map(block => ({ id: block.id, label: "", start: Date.parse(block.startAt), end: Date.parse(blockEnd(block)) })),
    ...others.filter(other => !other.allDay).map(other => ({ id: other.id, label: other.label, start: Date.parse(other.startAt), end: Date.parse(blockEnd(other)) }))];
  for (const block of blocks) {
    const list: BlockMark[] = [];
    const previous = block.afterBlockId ? byId.get(block.afterBlockId) : undefined;
    if (previous) {
      const gapMinutes = Math.round((Date.parse(block.startAt) - Date.parse(blockEnd(previous))) / MINUTE_MS);
      if (gapMinutes < -1) list.push({ kind: "order", gapMinutes });
      else if ((block.minGapMinutes !== null && gapMinutes < block.minGapMinutes - 1) || (block.maxGapMinutes !== null && gapMinutes > block.maxGapMinutes + 1)) list.push({ kind: "window", gapMinutes, minGapMinutes: block.minGapMinutes, maxGapMinutes: block.maxGapMinutes });
    }
    const day = labDayKey(block.startAt);
    if (!hours.workdays.includes(weekday(day))) list.push({ kind: "weekend" });
    if (!block.allDay) {
      const end = blockEnd(block);
      if (labMinuteOfDay(block.startAt) < hours.start || labDayKey(end) !== day || labMinuteOfDay(end) > hours.end) list.push({ kind: "hours" });
      const self = timed.find(item => item.id === block.id)!;
      const clash = timed.find(item => item.id !== block.id && item.start < self.end && self.start < item.end);
      if (clash) list.push({ kind: "overlap", with: clash.label || clash.id });
    }
    if (list.length) marks[block.id] = list;
  }
  return marks;
}

/** "Transfection · steps 1–6" (the interface translates it); a block given its own name keeps that name. */
export function blockTitle(block: Pick<ScheduleBlock, "title" | "stepRefs" | "kind">, steps: ReadonlyMap<string, Pick<ScheduleStep, "groupTitle" | "position">>) {
  if (block.title?.trim()) return block.title.trim();
  const members = block.stepRefs.map(ref => steps.get(ref)).filter((step): step is Pick<ScheduleStep, "groupTitle" | "position"> => Boolean(step));
  if (!members.length) return block.kind === "task" ? "Item" : "Steps";
  const first = members[0], last = members[members.length - 1];
  const range = members.length === 1 ? `step ${first.position}` : `steps ${first.position}–${last.position}`;
  return `${first.groupTitle} · ${range}`;
}

/** A block name from `blockTitle` in the interface's language. */
export function localizeBlockTitle(title: string, zh: boolean) {
  return zh ? title.replace(/ · steps (\d+)–(\d+)$/, " · 第 $1–$2 步").replace(/ · step (\d+)$/, " · 第 $1 步").replace(/^Steps$/, "步骤").replace(/^Item$/, "事项") : title;
}

/** "48 h", "30 min", "1.5 h": how a wait reads on the schedule. */
export function formatWait(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hoursValue = Math.round((minutes / 60) * 10) / 10;
  return `${hoursValue} h`;
}

/** "12–24 h", "20–30 min", "30 min–2 h": a time window, the unit written once when both ends share it. */
export function formatWindow(minMinutes: number, maxMinutes: number) {
  if (minMinutes >= 60 && maxMinutes >= 60) return `${formatWait(minMinutes * 60).replace(/ h$/, "")}–${formatWait(maxMinutes * 60)}`;
  if (maxMinutes < 60) return `${Math.round(minMinutes)}–${Math.round(maxMinutes)} min`;
  return `${formatWait(minMinutes * 60)}–${formatWait(maxMinutes * 60)}`;
}

/** "1 h 25 min", "35 min": how long a block takes. */
export function formatDuration(minutes: number) {
  const whole = Math.round(minutes);
  if (whole < 60) return `${whole} min`;
  const rest = whole % 60;
  return `${Math.floor(whole / 60)} h${rest ? ` ${rest} min` : ""}`;
}

const weekdaysZh = "一二三四五六日";
const weekdaysEn = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** "第 2 天 · 11/04 周二" or "Day 2 · Tue 11/04": the day of a block, counted from the schedule's first day. */
export function scheduleDayLabel(dayIndex: number, dayKey: string, zh: boolean) {
  const [, month, day] = dayKey.split("-");
  const index = weekday(dayKey) - 1;
  return zh ? `第 ${dayIndex} 天 · ${month}/${day} 周${weekdaysZh[index]}` : `Day ${dayIndex} · ${weekdaysEn[index]} ${month}/${day}`;
}

/** The blocks in time order; ties keep the order they were given. */
export const sortBlocks = (blocks: readonly ScheduleBlock[]) => [...blocks].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));

/**
 * A saved schedule must be whole and tidy: known step references, each in at most one block, waits pointing at a block
 * of the same schedule and never in a loop, sensible lengths and windows.
 */
export function scheduleProblems(blocks: readonly ScheduleBlock[], knownRefs: ReadonlySet<string>) {
  const problems: string[] = [];
  const ids = new Set(blocks.map(block => block.id));
  if (ids.size !== blocks.length) problems.push("Two blocks have the same id");
  const seen = new Set<string>();
  for (const block of blocks) {
    if (block.kind === "steps" && !block.stepRefs.length) problems.push("A block of steps has no steps");
    if (block.kind === "task" && !block.title?.trim()) problems.push("An item needs a name");
    for (const ref of block.stepRefs) {
      if (!knownRefs.has(ref)) problems.push("A block names a step this experiment does not have");
      if (seen.has(ref)) problems.push("A step is in two blocks");
      seen.add(ref);
    }
    if (block.afterBlockId && !ids.has(block.afterBlockId)) problems.push("A block waits for a block that is not in this schedule");
    if (block.afterBlockId === block.id) problems.push("A block cannot wait for itself");
    if (block.minGapMinutes !== null && block.maxGapMinutes !== null && block.minGapMinutes > block.maxGapMinutes) problems.push("A time window ends before it starts");
    if (block.estimatedMinutes !== null && (block.estimatedMinutes < 0 || block.estimatedMinutes > 24 * 60)) problems.push("A block is longer than a day");
    if (Number.isNaN(Date.parse(block.startAt))) problems.push("A block has no valid start");
  }
  for (const block of blocks) {
    const visited = new Set<string>();
    let current: ScheduleBlock | undefined = block;
    while (current?.afterBlockId) {
      if (visited.has(current.id)) { problems.push("The waits between blocks go in a circle"); break; }
      visited.add(current.id);
      current = blocks.find(item => item.id === current!.afterBlockId);
    }
  }
  return [...new Set(problems)];
}
