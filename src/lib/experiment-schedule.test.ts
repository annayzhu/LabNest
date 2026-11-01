import { describe, expect, it } from "vitest";
import {
  addDays, blockEnd, blockState, blockTitle, defaultWorkHours, dependents, draftSchedule, formatWait, labClock, labDayKey, labInstant,
  moveBlock, nextWorkMoment, overnightWindow, saysOvernight, scheduleMarks, scheduleProblems, shiftSchedule, textTimes, weekday,
  type ScheduleBlock, type ScheduleStep,
} from "./experiment-schedule";

const ids = () => { let next = 0; return () => `b${++next}`; };
const step = (ref: string, groupKey: string, position: number, wait?: ScheduleStep["wait"], groupTitle = groupKey): ScheduleStep =>
  ({ ref, stepIds: [ref], title: `step ${ref}`, groupKey, groupTitle, position, completed: false, ...(wait ? { wait } : {}) });
const hours = (h: number, min = h, max = h) => ({ seconds: h * 3600, minSeconds: min * 3600, maxSeconds: max * 3600 });
// Monday 2026-11-02, 09:30 in Beijing.
const monday0930 = labInstant("2026-11-02", 9 * 60 + 30);

describe("Beijing clock", () => {
  it("reads days and clock times in Beijing whatever the instant", () => {
    expect(labDayKey("2026-11-02T16:30:00.000Z")).toBe("2026-11-03");
    expect(labClock("2026-11-02T01:30:00.000Z")).toBe("09:30");
    expect(labInstant("2026-11-03", 9 * 60)).toBe("2026-11-03T01:00:00.000Z");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekday("2026-11-02")).toBe(1);
    expect(weekday("2026-11-08")).toBe(7);
  });

  it("moves an after-hours moment to the next working morning, over a weekend", () => {
    expect(nextWorkMoment(labInstant("2026-11-02", 7 * 60))).toBe(labInstant("2026-11-02", 9 * 60));
    expect(nextWorkMoment(labInstant("2026-11-02", 10 * 60))).toBe(labInstant("2026-11-02", 10 * 60));
    expect(nextWorkMoment(labInstant("2026-11-06", 19 * 60))).toBe(labInstant("2026-11-09", 9 * 60));
    expect(nextWorkMoment(labInstant("2026-11-07", 10 * 60))).toBe(labInstant("2026-11-09", 9 * 60));
  });

  it("reads waits written as text in older Protocols, but not lists of time points", () => {
    const times = (text: string) => textTimes(text).map(time => time.range ? `${time.range.min.value}–${time.range.max.value} ${time.unit}` : `${time.values.join("/")} ${time.unit}`);
    expect(times("37°C、5% CO₂培养12–24 h使细胞贴壁。")).toEqual(["12–24 h"]);
    expect(times("加样后轻柔混匀；37°C避光孵育1–4 h。")).toEqual(["1–4 h"]);
    expect(times("按设计培养，例如0、24、48、72、96 h；记录实际时间。")).toEqual([]);
    expect(times("首次实验测试0.5、1、2、4 h。")).toEqual([]);
    expect(times("室温放置5 min，12,000 × g离心15 min")).toEqual(["5 min", "15 min"]);
    expect(times("每孔加入500 μL细胞悬液")).toEqual([]);
  });

  it("knows overnight words", () => {
    expect(saysOvernight("37 °C 过夜培养")).toBe(true);
    expect(saysOvernight("Incubate overnight at 4 °C")).toBe(true);
    expect(saysOvernight("Shake O/N")).toBe(true);
    expect(saysOvernight("孵育 10 min")).toBe(false);
  });
});

describe("draftSchedule", () => {
  // Seeding (overnight), transfection (48 h, 24–72 h), RNA extraction, then qPCR.
  const steps = [
    step("seed:1", "seed", 1), step("seed:2", "seed", 2, { ...overnightWindow, seconds: 16 * 3600, overnight: true }),
    step("tx:1", "tx", 1), step("tx:2", "tx", 2), step("tx:3", "tx", 3, hours(48, 24, 72)),
    step("rna:1", "rna", 1, { seconds: 300, minSeconds: 300, maxSeconds: 300 }), step("rna:2", "rna", 2),
    step("qpcr:1", "qpcr", 1),
  ];

  it("breaks at long waits and overnight steps, and starts a block per Protocol", () => {
    const blocks = draftSchedule(steps, monday0930, { newId: ids() });
    expect(blocks.map(block => block.stepRefs)).toEqual([["seed:1", "seed:2"], ["tx:1", "tx:2", "tx:3"], ["rna:1", "rna:2"], ["qpcr:1"]]);
    expect(blocks.map(block => [labDayKey(block.startAt), labClock(block.startAt)])).toEqual([
      ["2026-11-02", "09:30"], ["2026-11-03", "09:00"], ["2026-11-05", "09:15"], ["2026-11-05", "09:30"],
    ]);
    // Seeded in the morning, "overnight" runs to the next morning: 23 h 20 min, which the window allows.
    expect(blocks[1]).toMatchObject({ afterBlockId: "b1", minGapMinutes: 720, maxGapMinutes: 1400, gapSource: "overnight:seed:2" });
    expect(blocks[2]).toMatchObject({ afterBlockId: "b2", minGapMinutes: 1440, maxGapMinutes: 4320, gapSource: "step:tx:3" });
    // A new Protocol with no wait between follows at once.
    expect(blocks[3]).toMatchObject({ afterBlockId: "b3", minGapMinutes: 0, maxGapMinutes: null, gapSource: null });
    // 5 min per step plus the 5 min wait inside the block.
    expect(blocks[2].estimatedMinutes).toBe(15);
  });

  it("produces a draft without marks when the waits fit", () => {
    const blocks = draftSchedule(steps, monday0930, { newId: ids() });
    expect(scheduleMarks(blocks)).toEqual({});
  });

  it("moves a block whose wait ends after hours to the next working morning and marks the window it misses", () => {
    const late = [step("a:1", "a", 1, hours(3)), step("a:2", "a", 2)];
    const blocks = draftSchedule(late, labInstant("2026-11-06", 16 * 60), { newId: ids() });
    expect(blocks).toHaveLength(2);
    expect(labDayKey(blocks[1].startAt)).toBe("2026-11-09");
    expect(scheduleMarks(blocks)[blocks[1].id]).toEqual([expect.objectContaining({ kind: "window", minGapMinutes: 180, maxGapMinutes: 180 })]);
  });

  it("marks an overnight step carried over a weekend, and one begun too late at night", () => {
    const overnight = [step("a:1", "a", 1, { ...overnightWindow, seconds: 16 * 3600, overnight: true }), step("b:1", "b", 1)];
    const friday = draftSchedule(overnight, labInstant("2026-11-06", 16 * 60), { newId: ids() });
    expect(labDayKey(friday[1].startAt)).toBe("2026-11-09");
    expect(scheduleMarks(friday)[friday[1].id]?.[0]).toMatchObject({ kind: "window" });
    const lateNight = draftSchedule(overnight, labInstant("2026-11-02", 23 * 60), { newId: ids() });
    expect(scheduleMarks(lateNight)[lateNight[1].id]?.some(mark => mark.kind === "window")).toBe(true);
  });

  it("drafts a running experiment from its first open step", () => {
    const blocks = draftSchedule([{ ...steps[0], completed: true }, ...steps.slice(1)], monday0930, { newId: ids() });
    expect(blocks[0].stepRefs).toEqual(["seed:2"]);
  });
});

describe("moving", () => {
  const blocks = draftSchedule([step("a:1", "a", 1, hours(48, 24, 72)), step("b:1", "b", 1, hours(24)), step("c:1", "c", 1)], monday0930, { newId: ids() });

  it("moves the blocks that wait for it along, keeping every gap", () => {
    expect([...dependents(blocks, "b1")]).toEqual(["b2", "b3"]);
    const moved = moveBlock(blocks, "b2", new Date(Date.parse(blocks[1].startAt) + 3_600_000).toISOString());
    expect(moved.map(block => Date.parse(block.startAt) - Date.parse(blocks.find(item => item.id === block.id)!.startAt))).toEqual([0, 3_600_000, 3_600_000]);
  });

  it("moves only the block when asked, and the window shows", () => {
    const later = new Date(Date.parse(blocks[1].startAt) + 2 * 86_400_000).toISOString();
    const moved = moveBlock(blocks, "b2", later, { chain: false });
    expect(moved[2].startAt).toBe(blocks[2].startAt);
    const marks = scheduleMarks(moved);
    expect(marks.b2?.[0]).toMatchObject({ kind: "window" });
    expect(marks.b3?.[0]).toMatchObject({ kind: "order" });
  });

  it("never moves a done block", () => {
    expect(() => moveBlock(blocks, "b1", monday0930, { locked: new Set(["b1"]) })).toThrow("A done block stays where it is");
    expect(() => moveBlock(blocks, "b2", monday0930, { locked: new Set(["b3"]) })).toThrow();
  });

  it("shifts the whole schedule when the first day changes", () => {
    const shifted = shiftSchedule(blocks, 86_400_000);
    expect(shifted.map(block => labDayKey(block.startAt))).toEqual(blocks.map(block => addDays(labDayKey(block.startAt), 1)));
  });
});

describe("marks", () => {
  const base: ScheduleBlock = { id: "x", kind: "steps", title: null, stepRefs: ["a"], startAt: labInstant("2026-11-07", 10 * 60), allDay: false, estimatedMinutes: 60, afterBlockId: null, minGapMinutes: null, maxGapMinutes: null, gapSource: null, note: null, doneAt: null };

  it("marks weekends, after hours and overlaps with other experiments", () => {
    const late = { ...base, id: "y", startAt: labInstant("2026-11-02", 17 * 60 + 30) };
    const marks = scheduleMarks([base, late], { others: [{ id: "o", label: "EXP-002 · qPCR", startAt: labInstant("2026-11-02", 18 * 60), estimatedMinutes: 30, allDay: false }] });
    expect(marks.x).toEqual([{ kind: "weekend" }]);
    expect(marks.y).toEqual([{ kind: "hours" }, { kind: "overlap", with: "EXP-002 · qPCR" }]);
  });

  it("does not mark an all-day item for hours or overlaps", () => {
    expect(scheduleMarks([{ ...base, kind: "task", allDay: true, startAt: labInstant("2026-11-02", 0) }])).toEqual({});
  });

  it("gives a block without an estimate half an hour", () => {
    expect(blockEnd({ ...base, estimatedMinutes: null })).toBe(labInstant("2026-11-07", 10 * 60 + 30));
  });
});

describe("titles, states and checks", () => {
  const steps = new Map([["a", { groupTitle: "转染", position: 1, completed: true }], ["b", { groupTitle: "转染", position: 6, completed: false }]]);

  it("names a block after its Protocol and steps unless it has its own name", () => {
    expect(blockTitle({ title: null, stepRefs: ["a", "b"], kind: "steps" }, steps)).toBe("转染 · steps 1–6");
    expect(blockTitle({ title: null, stepRefs: ["b"], kind: "steps" }, steps)).toBe("转染 · step 6");
    expect(blockTitle({ title: " 换液 ", stepRefs: [], kind: "task" }, steps)).toBe("换液");
  });

  it("is done when every step is, under way when some are", () => {
    expect(blockState({ kind: "steps", stepRefs: ["a"], doneAt: null }, steps)).toBe("done");
    expect(blockState({ kind: "steps", stepRefs: ["a", "b"], doneAt: null }, steps)).toBe("active");
    expect(blockState({ kind: "task", stepRefs: [], doneAt: "2026-11-02T01:00:00.000Z" }, steps)).toBe("done");
  });

  it("reads waits in minutes or hours", () => {
    expect(formatWait(300)).toBe("5 min");
    expect(formatWait(48 * 3600)).toBe("48 h");
    expect(formatWait(5400)).toBe("1.5 h");
  });

  it("refuses unknown steps, a step in two blocks, loops and empty items", () => {
    const block = (id: string, extra: Partial<ScheduleBlock> = {}): ScheduleBlock => ({ id, kind: "steps", title: null, stepRefs: [], startAt: monday0930, allDay: false, estimatedMinutes: 30, afterBlockId: null, minGapMinutes: null, maxGapMinutes: null, gapSource: null, note: null, doneAt: null, ...extra });
    const known = new Set(["a", "b"]);
    expect(scheduleProblems([block("1", { stepRefs: ["a"] }), block("2", { stepRefs: ["b"], afterBlockId: "1" })], known)).toEqual([]);
    expect(scheduleProblems([block("1", { stepRefs: ["a", "z"] })], known)).toContain("A block names a step this experiment does not have");
    expect(scheduleProblems([block("1", { stepRefs: ["a"] }), block("2", { stepRefs: ["a"] })], known)).toContain("A step is in two blocks");
    expect(scheduleProblems([block("1", { stepRefs: ["a"], afterBlockId: "2" }), block("2", { stepRefs: ["b"], afterBlockId: "1" })], known)).toContain("The waits between blocks go in a circle");
    expect(scheduleProblems([block("1", { kind: "task", title: " " })], known)).toContain("An item needs a name");
    expect(scheduleProblems([block("1", { stepRefs: ["a"], minGapMinutes: 60, maxGapMinutes: 30 })], known)).toContain("A time window ends before it starts");
  });

  it("uses working hours 09:00–18:00 on weekdays by default", () => {
    expect(defaultWorkHours).toEqual({ start: 540, end: 1080, workdays: [1, 2, 3, 4, 5] });
  });
});
