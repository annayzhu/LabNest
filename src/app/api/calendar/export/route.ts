import { addMonths } from "date-fns";
import { prisma } from "@/lib/db";
import { buildCalendar, exportableExperimentWhere } from "@/lib/calendar-export";
import { parseCalendarMonth } from "@/lib/overview-calendar";

/**
 * One-click export of planned experiments as an .ics file for a phone or desktop calendar.
 * Scope: `experiment=<id>`, `plan=<id>` or `month=YYYY-MM`; `remind=0` leaves the reminders out, and
 * `count=1` answers how many experiments the file would hold, so the dialog can say so before downloading.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams;
  const experimentId = search.get("experiment");
  const planId = search.get("plan");
  const month = search.get("month");
  const remind = search.get("remind") !== "0";

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
    scope = { date: { gte: start, lt: addMonths(start, 1) } };
  } else {
    return Response.json({ error: "Choose an experiment, a research plan or a month." }, { status: 400 });
  }

  const experiments = await prisma.experiment.findMany({
    where: { ...scope, ...exportableExperimentWhere },
    orderBy: { date: "asc" },
    take: 500,
    select: { id: true, title: true, date: true, runCode: true, researchPlan: { select: { title: true } } },
  });
  if (search.get("count") === "1") return Response.json({ count: experiments.length });
  if (!experiments.length) return Response.json({ error: "No planned experiments to export." }, { status: 404 });

  // Links follow the address the browser used, so a phone on the lab network gets a LAN link back.
  const origin = `${url.protocol}//${request.headers.get("host") ?? url.host}`;
  const body = buildCalendar(experiments.map((experiment) => ({
    id: experiment.id,
    title: experiment.title,
    date: experiment.date,
    runCode: experiment.runCode,
    planTitle: experiment.researchPlan?.title,
    url: `${origin}/experiments/${experiment.id}`,
  })), { name, remind });

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="LabNest-experiments.ics"; filename*=UTF-8''${encodeURIComponent(`${name}.ics`)}`,
      "Cache-Control": "no-store",
    },
  });
}
