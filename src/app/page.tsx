import Link from "next/link";
import { addMonths, format, startOfMonth } from "date-fns";
import { ArrowRight, ArrowUpRight, Beaker, BookOpen, Calculator, Camera, Database, FlaskConical } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { OverviewCalendar } from "@/components/OverviewCalendar";
import { PageHeader } from "@/components/PageHeader";
import { StaggeredText } from "@/components/StaggeredText";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/lib/db";
import { ExperimentStatus } from "@/generated/prisma/enums";
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
  },
  {
    label: "Experiment run mode",
    href: "/protocol-run",
    icon: FlaskConical,
  },
  {
    label: "New experiment result",
    href: "/results/new",
    icon: Database,
  },
  {
    label: "Calculator",
    href: "/tools/calculator",
    icon: Calculator,
  },
] as const;

export default async function OverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string | string[]; view?: string | string[] }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const requestedMonth = typeof params?.month === "string" ? params.month : undefined;
  const mobileCalendarOpen = params?.view === "calendar";
  const today = new Date();
  const viewMonth = parseCalendarMonth(requestedMonth, today);
  const nextMonth = startOfMonth(addMonths(viewMonth, 1));
  const [
    activeResearchPlans,
    calendarEntries,
    calendarExperiments,
    activeExperiments,
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
    prisma.experiment.findMany({
      where: { status: { in: [ExperimentStatus.running, ExperimentStatus.planned] } },
      orderBy: [{ status: "desc" }, { date: "asc" }],
      take: 6,
      select: {
        id: true,
        runCode: true,
        title: true,
        status: true,
        date: true,
        researchPlan: { select: { code: true, title: true } },
        steps: {
          orderBy: [{ groupOrder: "asc" }, { order: "asc" }],
          select: { id: true, title: true, completed: true },
        },
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
  const activeRun = activeExperiments.find((experiment) => experiment.status === ExperimentStatus.running);
  const todayExperiments = activeExperiments.filter((experiment) => calendarDateKey(experiment.date) === todayKey);

  return (
    <AppShell>
      {!mobileCalendarOpen ? <section className="bench-mobile space-y-5 lg:hidden">
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-[-0.02em] text-ink">Today at the bench</h1>
          <p className="mt-1 text-sm text-muted" data-i18n-ignore>{format(today, "EEEE, MMMM d")}</p>
        </div>

        <section aria-labelledby="active-run-title" className="overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
          <div className="border-b border-hairline/70 px-4 py-3">
            <h2 id="active-run-title" className="text-sm font-semibold text-ink">Active run</h2>
          </div>
          {activeRun ? (() => {
            const completedSteps = activeRun.steps.filter((step) => step.completed).length;
            const currentStep = activeRun.steps.find((step) => !step.completed);
            const progress = activeRun.steps.length ? Math.round((completedSteps / activeRun.steps.length) * 100) : 0;
            return (
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="record-identifier text-[11px] text-muted">{activeRun.runCode}</p>
                    <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-6 text-ink">{activeRun.title}</h3>
                  </div>
                  <span className="shrink-0 rounded-full border border-action-border bg-action-surface px-2 py-1 text-[11px] font-semibold text-moss">Running</span>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-stone" aria-label={`${progress}% complete`}>
                  <div className="h-full rounded-full bg-moss" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Current step</p>
                  <p className="mt-1 text-sm leading-5 text-graphite">{currentStep?.title ?? "All steps completed"}</p>
                </div>
                <Link href={`/experiments/${activeRun.id}/run`} className="focus-ring mt-4 flex min-h-11 items-center justify-between rounded-[var(--ln-radius-control-lg)] bg-action px-4 text-sm font-semibold text-white">
                  Continue run <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            );
          })() : (
            <div className="px-4 py-5">
              <p className="text-sm leading-6 text-muted">No experiment is running. Start from today’s plan when you reach the bench.</p>
              <Link href="/protocol-run" className="focus-ring mt-3 flex min-h-11 items-center justify-between rounded-[var(--ln-radius-control-lg)] border border-hairline px-4 text-sm font-semibold text-moss">
                View runs <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          )}
        </section>

        <Link href="/entries/new?mode=capture" className="focus-ring flex min-h-14 items-center gap-3 rounded-[var(--ln-radius-panel)] border border-action-border bg-action-surface px-4 text-moss">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface"><Camera className="h-4 w-4" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Quick capture</span>
            <span className="mt-0.5 block text-xs text-muted">Photo, observation, or measurement</span>
          </span>
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>

        <section aria-labelledby="today-plan-title">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="today-plan-title" className="text-base font-semibold text-ink">Today’s plan</h2>
            <Link href="/protocol-run" className="focus-ring flex min-h-11 items-center px-2 text-xs font-semibold text-moss">All runs</Link>
          </div>
          <div className="divide-y divide-hairline overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
            {todayExperiments.length ? todayExperiments.map((experiment) => (
              <Link key={experiment.id} href={`/experiments/${experiment.id}/run`} className="focus-ring flex min-h-14 items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warm text-moss"><FlaskConical className="h-4 w-4" aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-sm font-semibold leading-5 text-ink">{experiment.title}</span>
                  <span className="mt-1 block text-xs text-muted">{experiment.researchPlan?.code ?? experiment.runCode}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              </Link>
            )) : (
              <p className="px-4 py-5 text-sm leading-6 text-muted">Nothing is scheduled for today.</p>
            )}
          </div>
        </section>

        <Link href={`/?month=${viewMonthKey}&view=calendar`} className="focus-ring flex min-h-11 items-center justify-between rounded-[var(--ln-radius-control-lg)] px-2 text-sm font-semibold text-moss">
          Open monthly calendar <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </section> : <section className="bench-mobile space-y-3 lg:hidden">
        <Link href="/" className="focus-ring inline-flex min-h-11 items-center gap-2 px-2 text-sm font-semibold text-moss">
          <ArrowRight className="h-4 w-4 rotate-180" aria-hidden />Back to Today
        </Link>
        <OverviewCalendar
          key={`mobile-${viewMonthKey}`}
          monthKey={viewMonthKey}
          todayKey={todayKey}
          initialSelectedDateKey={initialSelectedDateKey}
          activities={calendarActivities}
        />
      </section>}

      <div id="calendar" className="overview-desktop hidden space-y-5 lg:block">
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
                      className="ln-quick-action focus-ring group flex h-10 items-center gap-2 rounded-[var(--ln-radius-control-md)] border px-2"
                    >
                      <span className="ln-quick-action-icon flex h-5 w-5 shrink-0 items-center justify-center text-action">
                        <Icon className="h-[15px] w-[15px]" strokeWidth={1.7} aria-hidden />
                      </span>
                      <StaggeredText text={action.label} trigger="hover" className="min-w-0 flex-1 truncate text-xs font-semibold text-ink" />
                      <ArrowUpRight className="h-3 w-3 shrink-0 text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-action" aria-hidden />
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
                          <span className="record-identifier truncate text-[10px] text-muted">{plan.code}</span>
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
