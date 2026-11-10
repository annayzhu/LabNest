import { describe, expect, it } from "vitest";
import { dayPlanTable, dayRunLabel, dayRuns, dayWaitLabel, experimentDayPlan, moveWrittenDays, withExperimentDays, writingOnFirstDay } from "./experiment-days";
import { scientificDocumentToTiptap, tiptapToScientificDocument } from "./scientific-tiptap";
import { mergeToolOutput } from "./tool-workflow";
import { experimentExecutionDocument } from "./experiment-document";
import { createScientificDocument, experimentSections } from "./scientific-document";
import type { ScheduleBlock, ScheduleStep } from "./experiment-schedule";

// Synthetic: two Protocols written as plain text steps (no snapshot), the second spread over two days by a 48 h wait.
const step = (ref: string, groupKey: string, groupTitle: string, position: number, completed = false): ScheduleStep => ({ ref, stepIds: [ref], title: `Step ${ref}`, groupKey, groupTitle, position, completed });
const steps = [step("a1", "pa", "Seeding", 1, true), step("a2", "pa", "Seeding", 2, true), step("b1", "pb", "Transfection", 1, true), step("b2", "pb", "Transfection", 2), step("b3", "pb", "Transfection", 3), step("b4", "pb", "Transfection", 4)];
const block = (id: string, startAt: string, stepRefs: string[], extra: Partial<ScheduleBlock> = {}): ScheduleBlock => ({
  id, kind: "steps", title: null, stepRefs, startAt, allDay: false, estimatedMinutes: 30, afterBlockId: null, minGapMinutes: null, maxGapMinutes: null, gapSource: null, note: null, doneAt: null, ...extra,
});
// Beijing 09:30 on 11/09 (Mon), 11/10, and 11/12.
const blocks = [
  block("seed", "2026-11-09T01:30:00.000Z", ["a1", "a2"]),
  block("tf", "2026-11-10T01:30:00.000Z", ["b1", "b2"], { afterBlockId: "seed", minGapMinutes: 720, maxGapMinutes: 1200, gapSource: "overnight:a2" }),
  block("harvest", "2026-11-12T01:30:00.000Z", ["b3"], { afterBlockId: "tf", minGapMinutes: 2880, maxGapMinutes: 2880, gapSource: "step:b2" }),
  block("item", "2026-11-11T02:00:00.000Z", [], { kind: "task", title: "Thaw cells", allDay: true, doneAt: "2026-11-11T08:00:00.000Z" }),
];
const date = new Date("2026-11-09T00:00:00.000Z");

describe("experiment days (Q426, Q434)", () => {
  it("cuts the steps by day, keeps empty days, and leaves unplaced steps for last", () => {
    const plan = experimentDayPlan({ date, scheduleDays: 4, blocks, steps })!;
    expect(plan.days.map(day => [day.index, day.dayKey, day.stepIds, day.status])).toEqual([
      [1, "2026-11-09", ["a1", "a2"], "done"],
      [2, "2026-11-10", ["b1", "b2"], "active"],
      [3, "2026-11-11", [], "done"],
      [4, "2026-11-12", ["b3"], "todo"],
    ]);
    expect(plan.unscheduledStepIds).toEqual(["b4"]);
    const longer = experimentDayPlan({ date, scheduleDays: 5, blocks, steps })!;
    expect(longer.days[4]).toMatchObject({ dayKey: "2026-11-13", stepIds: [], items: [], titles: [], status: "unplanned" });
    expect(plan.days[1].wait).toEqual({ overnight: true, minMinutes: 720, maxMinutes: 1200 });
    expect(plan.days[3].wait).toEqual({ overnight: false, minMinutes: 2880, maxMinutes: 2880 });
    expect(plan.days[1].titles).toEqual(["Transfection · steps 1–2"]);
  });

  it("puts an item on the Beijing day it falls on", () => {
    const plan = experimentDayPlan({ date, scheduleDays: null, blocks: [...blocks.slice(0, 3), block("item", "2026-11-10T16:30:00.000Z", [], { kind: "task", title: "Thaw cells", allDay: true, doneAt: "2026-11-11T08:00:00.000Z" })], steps })!;
    expect(plan.days[2].items).toEqual([{ id: "item", title: "Thaw cells", clock: null, done: true, note: null }]);
    expect(plan.days[2].status).toBe("done");
  });

  it("has no days for a one-day experiment without a schedule, and puts every step on day 1 when only the day count is set", () => {
    expect(experimentDayPlan({ date, scheduleDays: null, blocks: [], steps })).toBeUndefined();
    const plan = experimentDayPlan({ date, scheduleDays: 3, blocks: [], steps })!;
    expect(plan.days).toHaveLength(3);
    expect(plan.days[0].stepIds).toEqual(steps.map(item => item.ref));
    expect(plan.days[0].status).toBe("active");
    expect(plan.days[1].status).toBe("unplanned");
    expect(plan.unscheduledStepIds).toEqual([]);
  });

  it("starts at an item placed before the experiment's date", () => {
    const plan = experimentDayPlan({ date, scheduleDays: null, blocks: [block("prep", "2026-11-08T02:00:00.000Z", [], { kind: "task", title: "Order primers" }), ...blocks.slice(0, 1)], steps })!;
    expect(plan.days.map(day => day.dayKey)).toEqual(["2026-11-08", "2026-11-09"]);
    expect(plan.days[0].items[0].clock).toBe("10:00");
  });

  it("shows empty days in a row as one run, in the record and the table", () => {
    const plan = experimentDayPlan({ date, scheduleDays: 8, blocks: blocks.slice(0, 2), steps })!;
    expect(dayRuns(plan.days).map(run => [run.first.index, run.last.index])).toEqual([[1, 1], [2, 2], [3, 8]]);
    expect(dayRunLabel(plan.days[2], plan.days[7], true)).toBe("第 3–8 天 · 11/11–11/16");
    expect(dayRunLabel(plan.days[2], plan.days[7], false)).toBe("Days 3–8 · 11/11–11/16");
    expect((dayPlanTable(plan)[1] as { rows: string[][] }).rows.at(-1)).toEqual(["第 3–8 天", "11/11–11/16", "—", "未安排"]);
    const execution = experimentExecutionDocument(undefined, [], undefined, undefined, undefined, plan).sections.find(section => section.key === "execution")!.blocks;
    expect(execution.filter(item => item.execution?.role === "day").map(item => [item.execution!.index, item.execution!.number, item.execution!.meta])).toEqual([[1, undefined, "2026-11-09"], [2, undefined, "2026-11-10"], [3, 8, "2026-11-11/2026-11-16"]]);
  });

  it("writes the wait and the export table in the record's language", () => {
    expect(dayWaitLabel({ overnight: true, minMinutes: 720, maxMinutes: 1200 }, true)).toBe("过夜");
    expect(dayWaitLabel({ overnight: false, minMinutes: 2880, maxMinutes: 2880 }, true)).toBe("48 h");
    expect(dayWaitLabel({ overnight: false, minMinutes: 1440, maxMinutes: 4320 }, false)).toBe("24–72 h");
    const plan = experimentDayPlan({ date, scheduleDays: 4, blocks, steps })!;
    const [title, table] = dayPlanTable(plan);
    expect(title).toMatchObject({ type: "text", text: "日程" });
    expect(table).toMatchObject({ type: "table", rows: [["天", "日期", "内容", "状态"], ["第 1 天", "11/09 周一", "Seeding · 第 1–2 步", "已完成"], ["第 2 天", "11/10 周二", "（过夜后）Transfection · 第 1–2 步", "进行中"], ["第 3 天", "11/11 周三", "Thaw cells", "已完成"], ["第 4 天", "11/12 周四", "（48 h 后）Transfection · 第 3 步", "未开始"]] });
    const document = withExperimentDays(createScientificDocument(experimentSections), plan);
    expect(document.sections.find(section => section.key === "setup")!.blocks.map(item => item.id)).toEqual(["run-derived:days:title", "run-derived:days"]);
  });
});

describe("执行记录 by day", () => {
  const rows = steps.map((item, index) => ({ id: item.ref, groupKey: item.groupKey, groupOrder: item.groupKey === "pa" ? 0 : 1, order: item.position, groupTitle: item.groupTitle, title: item.title, completed: item.completed, ...(item.ref === "b2" ? { deviationNote: "Extended 5 min" } : {}), description: index === 0 ? "" : "" }));

  it("heads each day, shows a Protocol's steps on the days they fall on, and lists unplaced steps last", () => {
    const plan = experimentDayPlan({ date, scheduleDays: 4, blocks, steps })!;
    const document = experimentExecutionDocument(undefined, rows, undefined, undefined, undefined, plan);
    const execution = document.sections.find(section => section.key === "execution")!.blocks;
    const outline = execution.filter(item => item.execution && ["day", "group", "step"].includes(item.execution.role)).map(item => item.execution!.role === "step" ? `  ${item.execution!.stepId}` : item.execution!.role === "day" ? `${item.execution!.title} [${item.execution!.status}]` : ` ${(item as { text: string }).text}`);
    expect(outline).toEqual([
      "第 1 天 · 11/09 周一 [done]", " 1. Seeding", "  a1", "  a2",
      "第 2 天 · 11/10 周二 [active]", " 2. Transfection · 第 1–2 步", "  b1", "  b2",
      "第 3 天 · 11/11 周三 [done]",
      "第 4 天 · 11/12 周四 [todo]", " 2. Transfection · 第 3 步", "  b3",
      "未安排的步骤 [unscheduled]", " 2. Transfection · 第 4 步", "  b4",
      ]);
    expect(execution.find(item => item.id === "run-derived:item:item")).toMatchObject({ type: "text", text: "☑ 事项 · 全天 · Thaw cells" });
    expect(execution.find(item => item.id === "run-derived:group:1::d2")?.execution?.meta).toBe("已完成 1/2 步");
    expect(new Set(execution.map(item => item.id)).size).toBe(execution.length);
    const deviation = document.sections.find(section => section.key === "deviations")!.blocks[0];
    expect((deviation as { text: string }).text.startsWith("第 2 天 · 2. Transfection · 第 2 步")).toBe(true);
  });

  it("stays as it was without days", () => {
    const execution = experimentExecutionDocument(undefined, rows).sections.find(section => section.key === "execution")!.blocks;
    expect(execution.some(item => item.execution?.role === "day")).toBe(false);
    expect(execution.filter(item => item.execution?.role === "group").map(item => (item as { text: string }).text)).toEqual(["1. Seeding", "2. Transfection"]);
  });
});

describe("writing by day (Q427)", () => {
  const written = (id: string, day?: string) => ({ id, type: "text" as const, text: `note ${id}`, ...(day ? { day } : {}) });

  it("moves with the days a schedule change moves", () => {
    const blocks = [written("a", "2026-11-09"), written("b", "2026-11-10"), written("c", "2026-11-12"), written("d")];
    expect(moveWrittenDays(blocks, [{ insert: "2026-11-10" }]).map(block => block.day)).toEqual(["2026-11-09", "2026-11-11", "2026-11-13", undefined]);
    expect(moveWrittenDays(blocks, [{ remove: "2026-11-10" }]).map(block => block.day)).toEqual(["2026-11-09", undefined, "2026-11-11", undefined]);
    expect(moveWrittenDays(blocks, [{ shift: -2 }, { insert: "2026-11-09" }]).map(block => block.day)).toEqual(["2026-11-07", "2026-11-08", "2026-11-11", undefined]);
    expect(moveWrittenDays(blocks, [])[0]).toBe(blocks[0]);
  });

  it("reads under its day in 执行记录, and on no day last; an empty day with writing keeps its own heading", () => {
    const plan = experimentDayPlan({ date, scheduleDays: 6, blocks, steps, written: ["2026-11-14"] })!;
    expect(dayRuns(plan.days).map(run => [run.first.index, run.last.index])).toEqual([[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]]);
    const content = { schemaVersion: 1, sections: [{ key: "execution", title: "Execution notes", blocks: [written("x", "2026-11-10"), written("y"), written("z", "2026-11-14"), written("w", "2026-12-01")] }] };
    const execution = experimentExecutionDocument(content, [], undefined, undefined, undefined, plan).sections.find(section => section.key === "execution")!.blocks;
    const outline = execution.filter(block => block.execution?.role === "day" || !block.id.startsWith("run-derived:")).map(block => block.execution?.role === "day" ? block.execution.title : block.id);
    expect(outline).toEqual(["第 1 天 · 11/09 周一", "第 2 天 · 11/10 周二", "x", "第 3 天 · 11/11 周三", "第 4 天 · 11/12 周四", "第 5 天 · 11/13 周五", "第 6 天 · 11/14 周六", "z", "未分天的记录", "y", "w"]);
    expect(dayRunLabel(plan.days[0], plan.days[0], true)).toBe("第 1 天 · 11/09 周一");
  });

  it("keeps each block's day through the editor, and what is written under 未分天 loses it", () => {
    const document = createScientificDocument(experimentSections);
    document.sections.find(section => section.key === "execution")!.blocks = [written("x", "2026-11-10"), written("y"), written("z", "2026-11-12")];
    const days = { runs: [{ first: "2026-11-09", last: "2026-11-09" }, { first: "2026-11-10", last: "2026-11-11" }], tail: false };
    const json = scientificDocumentToTiptap(document, [], days);
    const execution = json.content!.find(node => node.attrs?.sectionKey === "execution")!.content!;
    expect(execution.map(node => node.type === "scientificDayBreak" ? `#${node.attrs!.dayKey}` : node.type)).toEqual(["#2026-11-09", "#2026-11-10", "paragraph", "#", "paragraph", "paragraph"]);
    const back = tiptapToScientificDocument(json, document).sections.find(section => section.key === "execution")!.blocks;
    expect(back.map(block => [block.id, block.day])).toEqual([["x", "2026-11-10"], ["y", undefined], ["z", undefined]]);
    // Without days the section is one writing area, as before.
    expect(scientificDocumentToTiptap(document).content!.find(node => node.attrs?.sectionKey === "execution")!.content!.some(node => node.type === "scientificDayBreak")).toBe(false);
  });

  it("puts a tool's output on the day it was opened from", () => {
    const document = createScientificDocument(experimentSections);
    document.sections.find(section => section.key === "execution")!.blocks = [written("x", "2026-11-10"), written("y", "2026-11-11")];
    const output = { id: "tool-1", type: "tool_output", toolId: "qpcr", label: "qPCR", revision: 1, submissionId: "s1", files: [], updatedAt: "2026-11-10T00:00:00.000Z" } as unknown as Parameters<typeof mergeToolOutput>[1];
    const after = (anchor: string) => mergeToolOutput(document, output, "execution", 0, anchor, "execution").sections.find(section => section.key === "execution")!.blocks.map(block => `${block.id}@${block.day ?? "-"}`);
    expect(after("x")).toEqual(["x@2026-11-10", "tool-1@2026-11-10", "y@2026-11-11"]);
    expect(after("day:2026-11-11")).toEqual(["x@2026-11-10", "tool-1@2026-11-11", "y@2026-11-11"]);
    expect(after("day:")).toEqual(["x@2026-11-10", "y@2026-11-11", "tool-1@-"]);
    // A day the document schema would refuse never reaches the record.
    expect(after("day:not-a-day")).toEqual(["x@2026-11-10", "y@2026-11-11", "tool-1@-"]);
  });

  it("keeps a one-day record's writing on day 1 when it gets a second day", () => {
    const document = createScientificDocument(experimentSections);
    document.sections.find(section => section.key === "execution")!.blocks = [written("x"), written("y", "2026-11-12")];
    const moved = writingOnFirstDay(document, "2026-11-09")!.sections.find(section => section.key === "execution")!.blocks;
    expect(moved.map(block => [block.id, block.day])).toEqual([["x", "2026-11-09"], ["y", "2026-11-12"]]);
    expect(writingOnFirstDay(createScientificDocument(experimentSections), "2026-11-09")).toBeUndefined();
  });
});
