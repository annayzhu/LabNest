import { addMonths } from "date-fns";
import { prisma } from "@/lib/db";
import { buildCalendar, exportableExperimentWhere, type CalendarEvent } from "@/lib/calendar-export";
import { daysBetween, labDayKey, localizeBlockTitle } from "@/lib/experiment-schedule";
import { scheduledBlocks } from "@/lib/experiment-schedule.server";
import { parseCalendarMonth } from "@/lib/overview-calendar";

/**
 * One-click export of planned experiments as an .ics file for a phone or desktop calendar.
 * Scope: `experiment=<id>`, `plan=<id>` or `month=YYYY-MM`; `remind=0` leaves the evening reminders out, `start=1`
 * adds one 15 minutes before a timed block, `lang=en` writes block names in English, and `count=1` answers how many
 * experiments and events the file would hold, so the dialog can say so before downloading. An experiment with a
 * schedule gives one event per block (Q267); one without gives its single day.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams;
  const experimentId = search.get("experiment");
  const planId = search.get("plan");
  const month = search.get("month");
  const remind = search.get("remind") !== "0";
  const remindStart = search.get("start") === "1";
  const zh = search.get("lang") !== "en";

  let name = "LabNest";
  let scope;
  if (experimentId) {
    scope = { id: experimentId };
  } else if (planId) {
    const plan = await prisma.researchPlan.findUnique({ where: { id: planId }, select: { title: true } });
    if (!plan) return Response.json({ error: "Research plan not found." }, { status: 404 });
    name = plan.title;
    scope = { researchPlanId: planId };
  } else if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    const start = parseCalendarMonth(month);
    name = `LabNest ${month}`;
    // An experiment belongs to the month when its first day or any of its blocks falls in it.
    scope = { OR: [{ date: { gte: start, lt: addMonths(start, 1) } }, { scheduleBlocks: { some: { startAt: { gte: start, lt: addMonths(start, 1) } } } }] };
  } else {
    return Response.json({ error: "Choose an experiment, a research plan or a month." }, { status: 400 });
  }

  const experiments = await prisma.experiment.findMany({
    where: { ...scope, ...exportableExperimentWhere },
    orderBy: { date: "asc" },
    take: 500,
    select: { id: true, title: true, date: true, runCode: true, researchPlan: { select: { title: true } } },
  });
  const blocks = experiments.length ? await scheduledBlocks({ experimentIds: experiments.map((experiment) => experiment.id) }) : [];
  const scheduled = new Set(blocks.map((block) => block.experimentId));
  const plain = experiments.filter((experiment) => !scheduled.has(experiment.id));
  if (search.get("count") === "1") return Response.json({ count: experiments.length, events: plain.length + blocks.length });
  if (!experiments.length) return Response.json({ error: "No planned experiments to export." }, { status: 404 });

  // Links follow the address the browser used, so a phone on the lab network gets a LAN link back.
  const origin = `${url.protocol}//${request.headers.get("host") ?? url.host}`;
  const firstDay = new Map<string, string>();
  for (const block of blocks) if (!firstDay.has(block.experimentId)) firstDay.set(block.experimentId, labDayKey(block.startAt));
  const byId = new Map(experiments.map((experiment) => [experiment.id, experiment]));
  const events: CalendarEvent[] = [
    ...plain.map((experiment) => ({
      id: experiment.id,
      title: experiment.title,
      date: experiment.date,
      runCode: experiment.runCode,
      planTitle: experiment.researchPlan?.title,
      url: `${origin}/experiments/${experiment.id}`,
    })),
    ...blocks.map((block) => {
      const experiment = byId.get(block.experimentId)!;
      const day = daysBetween(firstDay.get(block.experimentId)!, labDayKey(block.startAt)) + 1;
      const title = `${block.runCode} ${zh ? `第${day}天` : `Day ${day}`} ${localizeBlockTitle(block.title, zh)}`;
      const target = block.kind === "steps" && block.firstOpenStepId ? `/experiments/${block.experimentId}/run#step-${block.firstOpenStepId}` : `/experiments/${block.experimentId}/schedule`;
      return {
        id: block.experimentId, uid: `block-${block.id}`, title, date: new Date(block.startAt), runCode: block.runCode, planTitle: experiment.researchPlan?.title,
        ...(block.allDay ? {} : { startAt: new Date(block.startAt), minutes: block.estimatedMinutes ?? 30 }),
        // A later save raises the revision, so calendars that honour UIDs replace the old event.
        sequence: Math.floor(Date.parse(block.updatedAt) / 1000), details: [experiment.title, ...block.stepTitles.slice(0, 15), ...(block.note ? [block.note] : [])], url: `${origin}${target}`,
      } satisfies CalendarEvent;
    }),
  ];

  const body = buildCalendar(events, { name, remind, remindStart });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="LabNest-experiments.ics"; filename*=UTF-8''${encodeURIComponent(`${name}.ics`)}`,
      "Cache-Control": "no-store",
    },
  });
}
