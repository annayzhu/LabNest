import { describe, expect, it } from "vitest";
import {
  calendarDateKey,
  calendarMonthKey,
  getCalendarGrid,
  groupCalendarActivities,
  parseCalendarMonth,
  type OverviewCalendarActivity,
} from "./overview-calendar";

describe("overview calendar", () => {
  it("parses a valid month and falls back for invalid input", () => {
    const fallback = new Date(2026, 7, 8, 12);

    expect(calendarMonthKey(parseCalendarMonth("2026-07", fallback))).toBe("2026-07");
    expect(calendarMonthKey(parseCalendarMonth("2026-13", fallback))).toBe("2026-08");
  });

  it("builds a stable six-week grid starting on Monday", () => {
    const days = getCalendarGrid(new Date(2026, 7, 1));

    expect(days).toHaveLength(42);
    expect(calendarDateKey(days[0])).toBe("2026-07-27");
    expect(calendarDateKey(days[41])).toBe("2026-09-06");
  });

  it("groups daily activities and sorts them chronologically", () => {
    const activities: OverviewCalendarActivity[] = [
      {
        id: "late",
        kind: "entry",
        title: "Late entry",
        dateKey: "2026-08-08",
        startsAt: "2026-08-08T12:00:00.000Z",
        href: "/entries/late",
        status: "recorded",
      },
      {
        id: "early",
        kind: "experiment",
        title: "Early experiment",
        dateKey: "2026-08-08",
        startsAt: "2026-08-08T02:00:00.000Z",
        href: "/experiments/early",
        status: "planned",
      },
    ];

    expect(groupCalendarActivities(activities).get("2026-08-08")?.map((item) => item.id)).toEqual([
      "early",
      "late",
    ]);
  });
});
