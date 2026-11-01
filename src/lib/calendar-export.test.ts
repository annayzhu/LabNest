import { describe, expect, it } from "vitest";
import { buildCalendar, isExportableExperiment, type CalendarEvent } from "./calendar-export";
import { labInstant } from "./experiment-schedule";

const event: CalendarEvent = {
  id: "exp1",
  title: "KYSE150 转染, RNA; 提取",
  // As the experiment form stores a date: UTC midnight of the day.
  date: new Date("2026-10-31T00:00:00.000Z"),
  runCode: "EXP-2026-031",
  planTitle: "JAK/STAT 通路验证",
  url: "http://192.168.0.102:3001/experiments/exp1",
};
const now = new Date(Date.UTC(2026, 9, 29, 8, 30, 5));

describe("buildCalendar", () => {
  it("writes one all-day event with an evening-before reminder", () => {
    const ics = buildCalendar([event], { name: "LabNest", remind: true, now });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("UID:experiment-exp1@labnest");
    expect(ics).toContain("DTSTAMP:20261029T083005Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261031");
    expect(ics).toContain("DTEND;VALUE=DATE:20261101");
    expect(ics).toContain("SUMMARY:KYSE150 转染\\, RNA\\; 提取");
    expect(ics).toContain("TRIGGER:-PT4H");
  });

  it("leaves the reminder out when asked", () => {
    expect(buildCalendar([event], { name: "LabNest", remind: false, now })).not.toContain("VALARM");
  });

  it("keeps the planned day even when the stored value carries a creation time, read on the lab clock", () => {
    const ics = buildCalendar([{ ...event, date: new Date(labInstant("2026-10-31", 23 * 60 + 40)) }], { name: "LabNest", remind: false, now });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261031");
  });

  it("writes a timed block in UTC with its own UID, revision and reminders", () => {
    const block: CalendarEvent = { ...event, title: "EXP-2026-031 第2天 转染（第 1–6 步）", uid: "block-b1", startAt: new Date(labInstant("2026-11-03", 9 * 60 + 30)), minutes: 45, sequence: 1761000000, details: ["1. 铺板", "2. 转染"] };
    const ics = buildCalendar([block], { name: "LabNest", remind: true, remindStart: true, now }).replaceAll("\r\n ", "");
    expect(ics).toContain("UID:block-b1@labnest");
    expect(ics).toContain("SEQUENCE:1761000000");
    expect(ics).toContain("DTSTART:20261103T013000Z");
    expect(ics).toContain("DTEND:20261103T021500Z");
    // 20:00 in Beijing the evening before, and 15 minutes before the start.
    expect(ics).toContain("TRIGGER;VALUE=DATE-TIME:20261102T120000Z");
    expect(ics).toContain("TRIGGER:-PT15M");
    expect(ics).toContain("1. 铺板\\n2. 转染");
  });

  it("writes an all-day block on its lab day", () => {
    const ics = buildCalendar([{ ...event, uid: "block-b2", date: new Date(labInstant("2026-11-04", 0)) }], { name: "LabNest", remind: false, now });
    expect(ics).toContain("UID:block-b2@labnest");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261104");
    expect(ics).toContain("DTEND;VALUE=DATE:20261105");
  });

  it("folds lines at 75 octets without splitting a character", () => {
    const ics = buildCalendar([{ ...event, title: "长".repeat(60) }], { name: "LabNest", remind: false, now });
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.replaceAll("\r\n ", "")).toContain(`SUMMARY:${"长".repeat(60)}\r\n`);
  });
});

describe("isExportableExperiment", () => {
  it("exports planned and running work that is not yet submitted", () => {
    expect(isExportableExperiment({ status: "planned", recordStatus: "draft" })).toBe(true);
    expect(isExportableExperiment({ status: "running", recordStatus: "recorded" })).toBe(true);
    expect(isExportableExperiment({ status: "completed", recordStatus: "draft" })).toBe(false);
    expect(isExportableExperiment({ status: "planned", recordStatus: "submitted" })).toBe(false);
  });
});
