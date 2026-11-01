import { ExperimentStatus, RecordLifecycleStatus } from "@/generated/prisma/enums";
import { addDays, labDayKey, labInstant } from "@/lib/experiment-schedule";

export type CalendarEvent = {
  id: string;
  title: string;
  /** The day of an all-day event. */
  date: Date;
  runCode: string;
  planTitle?: string;
  url: string;
  /** A 日程段 (Q267): its own UID, a start time when it has one (else all day on `date`), its length and revision. */
  uid?: string;
  startAt?: Date;
  minutes?: number;
  sequence?: number;
  details?: string[];
};

const openStatuses = [ExperimentStatus.planned, ExperimentStatus.running];
const closedRecordStatuses = [RecordLifecycleStatus.submitted, RecordLifecycleStatus.reviewed];

/** Experiments still to be done: planned or running, and not yet submitted or reviewed. */
export const exportableExperimentWhere = { status: { in: openStatuses }, recordStatus: { notIn: closedRecordStatuses } };

export function isExportableExperiment(experiment: { status: string; recordStatus: string }) {
  return (openStatuses as string[]).includes(experiment.status) && !(closedRecordStatuses as string[]).includes(experiment.recordStatus);
}

/**
 * An iCalendar file (RFC 5545): one all-day event per experiment without a schedule, and one event per 日程段 of an
 * experiment with one (Q267) — timed when the block has a start time. Days are read on the lab clock, so a phone in
 * another timezone keeps them; timed events are written in UTC. Each event keeps a stable UID (the experiment's or the
 * block's), so calendars that honour UIDs update instead of adding. `remindStart` adds a reminder 15 minutes before a
 * timed block.
 */
export function buildCalendar(events: CalendarEvent[], { name, remind, remindStart = false, now = new Date() }: { name: string; remind: boolean; remindStart?: boolean; now?: Date }) {
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
    const notes = [event.runCode, event.planTitle, ...(event.details ?? []), event.url].filter(Boolean).join("\n");
    const day = labDayKey(event.startAt ?? event.date);
    lines.push("BEGIN:VEVENT", `UID:${event.uid ?? `experiment-${event.id}`}@labnest`, `DTSTAMP:${stamp}`);
    if (event.sequence !== undefined) lines.push(`SEQUENCE:${event.sequence}`);
    if (event.startAt) {
      const end = new Date(event.startAt.getTime() + (event.minutes ?? 30) * 60_000);
      lines.push(`DTSTART:${utcStamp(event.startAt)}`, `DTEND:${utcStamp(end)}`);
    } else lines.push(`DTSTART;VALUE=DATE:${compactDay(day)}`, `DTEND;VALUE=DATE:${compactDay(addDays(day, 1))}`);
    lines.push(`SUMMARY:${escapeText(event.title)}`, `DESCRIPTION:${escapeText(notes)}`, `URL:${event.url}`, `TRANSP:${event.startAt ? "OPAQUE" : "TRANSPARENT"}`);
    // An all-day event starts at local midnight, so four hours before is 20:00 the evening before; a timed one is
    // reminded at 20:00 the evening before on the lab clock.
    const evening = event.startAt ? `TRIGGER;VALUE=DATE-TIME:${utcStamp(new Date(labInstant(addDays(day, -1), 20 * 60)))}` : "TRIGGER:-PT4H";
    if (remind) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(event.title)}`, evening, "END:VALARM");
    if (remindStart && event.startAt) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(event.title)}`, "TRIGGER:-PT15M", "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

const compactDay = (dayKey: string) => dayKey.replace(/-/g, "");

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
