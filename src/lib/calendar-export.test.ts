import { describe, expect, it } from "vitest";
import { buildCalendar, isExportableExperiment, type CalendarEvent } from "./calendar-export";

const event: CalendarEvent = {
  id: "exp1",
  title: "KYSE150 转染, RNA; 提取",
  date: new Date(2026, 9, 31, 0, 0),
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

  it("keeps the planned day even when the stored value carries a creation time", () => {
    const ics = buildCalendar([{ ...event, date: new Date(2026, 9, 31, 23, 40) }], { name: "LabNest", remind: false, now });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261031");
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
