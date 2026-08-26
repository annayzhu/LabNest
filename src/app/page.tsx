import Link from "next/link";
import { addMonths, format, startOfMonth } from "date-fns";
import { ArrowUpRight, Beaker, BookOpen, Calculator, Database, FlaskConical } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { OverviewCalendar } from "@/components/OverviewCalendar";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/lib/db";
import {
  calendarDateKey,
  calendarMonthKey,
  parseCalendarMonth,
  type OverviewCalendarActivity,
} from "@/lib/overview-calendar";

export const dynamic = "force-dynamic";

const quickActions = [
  {
    label: "Quick entry",
    href: "/entries/new?source=text",
    icon: BookOpen,
    iconClass: "bg-info-surface text-info",
  },
  {
    label: "Experiment run mode",
    href: "/protocol-run",
    icon: FlaskConical,
    iconClass: "bg-sage-surface text-moss",
  },
  {
    label: "New experiment result",
    href: "/results/new",
    icon: Database,
    iconClass: "bg-stone text-graphite",
  },
  {
    label: "Calculator",
    href: "/tools/calculator",
    icon: Calculator,
    iconClass: "bg-sage-surface text-moss",
  },
] as const;

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
    activeResearchPlans,
    calendarEntries,
    calendarExperiments,
  ] = await Promise.all([
    prisma.researchPlan.findMany({
      where: { status: "active" },
      take: 4,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        code: true,
        title: true,
        project: { select: { name: true } },
        _count: { select: { experiments: true } },
      },
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

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Lab workspace"
          title="Overview"
          description="A compact operational view of what needs attention now. Detailed work stays in the corresponding module."
        />

        <div className="grid items-start gap-5 xl:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[250px_minmax(0,1fr)]">
          <aside aria-label="Start here" className="min-w-0 space-y-3">
            <Card className="overflow-hidden">
              <CardHeader title="Start here" />
              <CardBody className="grid gap-1.5 p-2.5 md:grid-cols-2 xl:grid-cols-1">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="focus-ring group flex h-14 items-center gap-2.5 rounded-[8px] border border-hairline bg-warm/45 px-2.5 transition hover:border-sage hover:bg-sage-surface/35"
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] ${action.iconClass}`}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{action.label}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-moss" aria-hidden />
                    </Link>
                  );
                })}
              </CardBody>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader
                title="Active plans"
                action={<Link href="/research-plans?status=active" className="text-xs font-medium text-moss hover:underline">View all</Link>}
              />
              <CardBody className="p-0">
                {activeResearchPlans.length ? (
                  <div className="divide-y divide-hairline">
                    {activeResearchPlans.map((plan) => (
                      <Link
                        key={plan.id}
                        href={`/research-plans/${plan.id}`}
                        className="focus-ring group block px-3 py-2.5 transition hover:bg-warm/60"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-[10px] text-muted">{plan.code}</span>
                          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted" aria-label={`${plan._count.experiments} experiments`}>
                            <Beaker className="h-3 w-3" aria-hidden />
                            <span data-i18n-ignore>{plan._count.experiments}</span>
                          </span>
                        </span>
                        <span className="mt-1 line-clamp-2 block text-xs font-semibold leading-4 text-ink group-hover:text-moss">{plan.title}</span>
                        <span className="mt-1 block truncate text-[10px] text-muted">{plan.project.name}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="px-3 py-4 text-xs leading-5 text-muted">No active research plans.</p>
                )}
              </CardBody>
            </Card>
          </aside>

          <div className="min-w-0">
            <OverviewCalendar
              key={viewMonthKey}
              monthKey={viewMonthKey}
              todayKey={todayKey}
              initialSelectedDateKey={initialSelectedDateKey}
              activities={calendarActivities}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
