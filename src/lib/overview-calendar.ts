import {
  addDays,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export type OverviewCalendarActivity = {
  id: string;
  kind: "entry" | "experiment";
  title: string;
  dateKey: string;
  startsAt: string;
  href: string;
  status: string;
  context?: string;
  summary?: string;
};

const calendarMonthPattern = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function calendarMonthKey(date: Date) {
  return format(date, "yyyy-MM");
}

export function calendarDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function parseCalendarMonth(value: string | undefined, fallback = new Date()) {
  const match = value?.match(calendarMonthPattern);
  if (!match) return startOfMonth(fallback);

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const parsed = new Date(year, monthIndex, 1);

  // Guard against dates outside JavaScript's practical range silently rolling over.
  if (parsed.getFullYear() !== year || parsed.getMonth() !== monthIndex) {
    return startOfMonth(fallback);
  }

  return parsed;
}

export function getCalendarGrid(viewMonth: Date) {
  const gridStart = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

export function groupCalendarActivities(activities: OverviewCalendarActivity[]) {
  const groups = new Map<string, OverviewCalendarActivity[]>();

  for (const activity of activities) {
    const current = groups.get(activity.dateKey) ?? [];
    current.push(activity);
    groups.set(activity.dateKey, current);
  }

  for (const items of groups.values()) {
    items.sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  }

  return groups;
}
