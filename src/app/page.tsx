import Link from "next/link";
import { addMonths, format, startOfMonth } from "date-fns";
import { AppShell } from "@/components/AppShell";
import { OverviewCalendar } from "@/components/OverviewCalendar";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/lib/db";
import {
  calendarDateKey,
  calendarMonthKey,
  parseCalendarMonth,
  type OverviewCalendarActivity,
} from "@/lib/overview-calendar";

export const dynamic = "force-dynamic";

const createLinkClass =
  "focus-ring inline-flex h-9 items-center rounded-[8px] border border-moss bg-moss px-3 text-sm font-medium text-warm transition hover:brightness-95";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string | string[] }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const requestedMonth = typeof params?.month === "string" ? params.month : undefined;
  const today = new Date();
  const viewMonth = parseCalendarMonth(requestedMonth, today);
  const nextMonth = startOfMonth(addMonths(viewMonth, 1));
  const [
    projectCount,
    planCount,
    runningExperimentCount,
    pendingResultCount,
    activeProtocolCount,
    recentEntries,
    recentExperiments,
    calendarEntries,
    calendarExperiments,
  ] = await Promise.all([
    prisma.project.count({ where: { status: "active" } }),
    prisma.researchPlan.count({ where: { status: { in: ["draft", "active"] } } }),
    prisma.experiment.count({ where: { status: "running" } }),
    prisma.result.count({ where: { textValue: null, numericValue: null } }),
    prisma.protocol.count({ where: { availability: "active" } }),
    prisma.entry.findMany({
      take: 5,
      orderBy: { occurredAt: "desc" },
      include: { project: true, researchPlan: true },
    }),
    prisma.experiment.findMany({
      take: 5,
      orderBy: { date: "desc" },
      include: { project: true, researchPlan: true },
    }),
    prisma.entry.findMany({
      where: { occurredAt: { gte: viewMonth, lt: nextMonth } },
      orderBy: { occurredAt: "asc" },
      select: {
        id: true,
        title: true,
        body: true,
        occurredAt: true,
        recordStatus: true,
        project: { select: { name: true } },
        researchPlan: { select: { title: true } },
      },
    }),
    prisma.experiment.findMany({
      where: { date: { gte: viewMonth, lt: nextMonth } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        title: true,
        date: true,
        purpose: true,
        status: true,
        project: { select: { name: true } },
        researchPlan: { select: { title: true } },
      },
    }),
  ]);

  const calendarActivities: OverviewCalendarActivity[] = [
    ...calendarEntries.map((entry) => ({
      id: `entry-${entry.id}`,
      kind: "entry" as const,
      title: entry.title,
      dateKey: calendarDateKey(entry.occurredAt),
      startsAt: entry.occurredAt.toISOString(),
      href: `/entries/${entry.id}`,
      status: entry.recordStatus,
      context: entry.researchPlan?.title ?? entry.project?.name ?? undefined,
      summary: entry.body || undefined,
    })),
    ...calendarExperiments.map((experiment) => ({
      id: `experiment-${experiment.id}`,
      kind: "experiment" as const,
      title: experiment.title,
      dateKey: calendarDateKey(experiment.date),
      startsAt: experiment.date.toISOString(),
      href: `/experiments/${experiment.id}`,
      status: experiment.status,
      context: experiment.researchPlan?.title ?? experiment.project?.name ?? undefined,
      summary: experiment.purpose ?? undefined,
    })),
  ].sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  const viewMonthKey = calendarMonthKey(viewMonth);
  const todayKey = calendarDateKey(today);
  const initialSelectedDateKey = viewMonthKey === calendarMonthKey(today)
    ? todayKey
    : calendarActivities[0]?.dateKey ?? format(viewMonth, "yyyy-MM-dd");

  const metrics = [
    ["Active projects", projectCount, "/projects?status=active"],
    ["Open research plans", planCount, "/research-plans"],
    ["Running experiments", runningExperimentCount, "/experiments?status=running"],
    ["Active protocols", activeProtocolCount, "/protocols?availability=active"],
    ["Results awaiting data", pendingResultCount, "/results"],
  ] as const;

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Lab workspace"
          title="Overview"
          description="A compact operational view of what needs attention now. Detailed work stays in the corresponding module."
          actions={
            <Link href="/entries/new" className={createLinkClass}>
              Quick entry
            </Link>
          }
        />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <OverviewCalendar
              key={viewMonthKey}
              monthKey={viewMonthKey}
              todayKey={todayKey}
              initialSelectedDateKey={initialSelectedDateKey}
              activities={calendarActivities}
            />
          </div>

          <aside aria-label="Workspace dashboard" className="min-w-0 xl:sticky xl:top-20">
            <Card className="overflow-hidden">
              <CardHeader title="Workspace dashboard" />
              <CardBody className="p-0">
                <section aria-label="Workspace metrics" className="grid grid-cols-2 gap-px bg-hairline">
                  {metrics.map(([label, value, href], index) => (
                    <Link
                      key={label}
                      href={href}
                      className={`focus-ring min-w-0 bg-surface px-3 py-3 transition hover:bg-warm ${index === metrics.length - 1 ? "col-span-2" : ""}`}
                    >
                      <span className="block font-mono text-xl font-medium text-ink">{value}</span>
                      <span className="mt-1 block text-[11px] leading-4 text-muted">{label}</span>
                    </Link>
                  ))}
                </section>

                <section className="border-t border-hairline">
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <h3 className="text-xs font-semibold text-ink">Recent entries</h3>
                    <Link href="/entries" className="text-xs text-moss hover:underline">View all</Link>
                  </div>
                  <div className="divide-y divide-hairline border-t border-hairline">
                    {recentEntries.length ? recentEntries.map((entry) => (
                      <Link key={entry.id} href={`/entries/${entry.id}`} className="focus-ring block px-4 py-2.5 transition hover:bg-warm/60">
                        <span className="flex items-start justify-between gap-2">
                          <span className="line-clamp-2 text-xs font-semibold leading-4 text-ink">{entry.title}</span>
                          <StatusPill status={entry.recordStatus} />
                        </span>
                        <span className="mt-1 block truncate text-[11px] text-muted">
                          {entry.researchPlan?.title ?? entry.project?.name ?? "Unassigned"}
                        </span>
                      </Link>
                    )) : <p className="px-4 py-4 text-xs text-muted">No entries yet.</p>}
                  </div>
                </section>

                <section className="border-t border-hairline">
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <h3 className="text-xs font-semibold text-ink">Recent experiments</h3>
                    <Link href="/experiments" className="text-xs text-moss hover:underline">View all</Link>
                  </div>
                  <div className="divide-y divide-hairline border-t border-hairline">
                    {recentExperiments.length ? recentExperiments.map((experiment) => (
                      <Link key={experiment.id} href={`/experiments/${experiment.id}`} className="focus-ring block px-4 py-2.5 transition hover:bg-warm/60">
                        <span className="flex items-start justify-between gap-2">
                          <span className="line-clamp-2 text-xs font-semibold leading-4 text-ink">{experiment.title}</span>
                          <StatusPill status={experiment.status} />
                        </span>
                        <span className="mt-1 block truncate text-[11px] text-muted">
                          {experiment.researchPlan?.title ?? experiment.project?.name ?? "Unassigned"}
                        </span>
                      </Link>
                    )) : <p className="px-4 py-4 text-xs text-muted">No experiments yet.</p>}
                  </div>
                </section>
              </CardBody>
            </Card>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
