import { addDays, format } from "date-fns";
import { ExperimentStatus, RecordLifecycleStatus } from "@/generated/prisma/enums";
import { calendarDateKey } from "@/lib/overview-calendar";

export type CalendarEvent = {
  id: string;
  title: string;
  date: Date;
  runCode: string;
  planTitle?: string;
  url: string;
};

const openStatuses = [ExperimentStatus.planned, ExperimentStatus.running];
const closedRecordStatuses = [RecordLifecycleStatus.submitted, RecordLifecycleStatus.reviewed];

/** Experiments still to be done: planned or running, and not yet submitted or reviewed. */
export const exportableExperimentWhere = { status: { in: openStatuses }, recordStatus: { notIn: closedRecordStatuses } };

export function isExportableExperiment(experiment: { status: string; recordStatus: string }) {
  return (openStatuses as string[]).includes(experiment.status) && !(closedRecordStatuses as string[]).includes(experiment.recordStatus);
}

/**
 * An iCalendar file (RFC 5545) with one all-day event per experiment: the planned-date form takes a
 * day, not a time. The day is read on the lab clock, so a phone in another timezone keeps it. Each
 * event keeps the experiment's id as its UID, so calendars that honour UIDs update instead of adding.
 */
export function buildCalendar(events: CalendarEvent[], { name, remind, now = new Date() }: { name: string; remind: boolean; now?: Date }) {
  const stamp = utcStamp(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LabNest//Experiment plan//ZH",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
  ];
  for (const event of events) {
    const day = dayStart(event.date);
    const notes = [event.runCode, event.planTitle, event.url].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:experiment-${event.id}@labnest`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${format(day, "yyyyMMdd")}`,
      `DTEND;VALUE=DATE:${format(addDays(day, 1), "yyyyMMdd")}`,
      `SUMMARY:${escapeText(event.title)}`,
      `DESCRIPTION:${escapeText(notes)}`,
      `URL:${event.url}`,
      "TRANSP:TRANSPARENT",
    );
    // An all-day event starts at local midnight, so four hours before is 20:00 the evening before.
    if (remind) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(event.title)}`, "TRIGGER:-PT4H", "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

function dayStart(date: Date) {
  const [year, month, day] = calendarDateKey(date).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function utcStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines may be at most 75 octets; longer ones continue on lines that start with a space. Never split a character. */
function fold(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const charSize = encoder.encode(char).length;
    const limit = parts.length ? 74 : 75;
    if (size + charSize > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += charSize;
  }
  parts.push(current);
  return parts.join("\r\n ");
}
