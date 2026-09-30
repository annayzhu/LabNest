import Link from "next/link";
import { addDays, addMonths, format, startOfDay, startOfMonth } from "date-fns";
import { ArrowRight, ArrowUpRight, Beaker, BookOpen, Calculator, Camera, Database, FlaskConical, Timer } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { OverviewCalendar } from "@/components/OverviewCalendar";
import { PageHeader } from "@/components/PageHeader";
import { StaggeredText } from "@/components/StaggeredText";
import { StepTimerReadout } from "@/components/StepTimerReadout";
import { TodayCalculators } from "@/components/calculators/TodayCalculators";
import { MobileBenchStatus } from "@/components/MobileBenchStatus";
import { prisma } from "@/lib/db";
import { ExperimentStatus } from "@/generated/prisma/enums";
import { remainingStepTimerSeconds } from "@/lib/step-timer";
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
    activeRuns,
    todayExperiments,
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
      where: { status: ExperimentStatus.running },
      orderBy: { updatedAt: "desc" },
      take: 1,
      select: {
        id: true,
        runCode: true,
        title: true,
        status: true,
        date: true,
        researchPlan: { select: { code: true, title: true } },
        steps: {
          orderBy: [{ groupOrder: "asc" }, { order: "asc" }],
          select: { id: true, title: true, completed: true, timerStartedAt: true, timerRemainingSeconds: true },
        },
      },
    }),
    prisma.experiment.findMany({
      where: {
        status: { in: [ExperimentStatus.running, ExperimentStatus.planned] },
        date: { gte: startOfDay(today), lt: addDays(startOfDay(today), 1) },
      },
      orderBy: { date: "asc" },
      take: 50,
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
  const activeRun = activeRuns[0];
  // Shared by the mobile bench view and the desktop Today panel.
  const activeRunBody = activeRun ? (() => {
            const completedSteps = activeRun.steps.filter((step) => step.completed).length;
            const currentStep = activeRun.steps.find((step) => !step.completed);
            const activeTimer = activeRun.steps.find((step) => step.timerStartedAt && remainingStepTimerSeconds({ remainingSeconds: step.timerRemainingSeconds ?? 0, startedAt: step.timerStartedAt, now: today }) > 0);
            const progress = activeRun.steps.length ? Math.round((completedSteps / activeRun.steps.length) * 100) : 0;
            return (
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="record-identifier text-xs text-muted">{activeRun.runCode}</p>
                    <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-6 text-ink">{activeRun.title}</h3>
                  </div>
                  <span className="shrink-0 rounded-full border border-action-border bg-action-surface px-2 py-1 text-xs font-semibold text-moss">Running</span>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-stone" aria-label={`${progress}% complete`}>
                  <div className="h-full rounded-full bg-moss" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted">Current step</p>
                  <p className="mt-1 text-sm leading-5 text-graphite">{currentStep?.title ?? "All steps completed"}</p>
                </div>
                {activeTimer?.timerStartedAt && activeTimer.timerRemainingSeconds ? <div className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-[var(--ln-radius-control-lg)] border border-info/25 bg-info-surface px-3">
                  <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-graphite"><Timer className="h-4 w-4 shrink-0 text-info" aria-hidden /><span className="truncate">{activeTimer.title}</span></span>
                  <StepTimerReadout remainingSeconds={activeTimer.timerRemainingSeconds} startedAt={activeTimer.timerStartedAt.toISOString()} />
                </div> : null}
                <Link href={`/experiments/${activeRun.id}/run`} className="focus-ring mt-4 flex min-h-11 items-center justify-between rounded-[var(--ln-radius-control-lg)] bg-action px-4 text-sm font-semibold text-warm">
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
          );
  const todayPlanRows = todayExperiments.length ? todayExperiments.map((experiment) => (
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
            );

  return (
    <AppShell>
      {!mobileCalendarOpen ? <section className="bench-mobile space-y-5 lg:hidden">
        <div>
          <h1 className="page-header-title tracking-[-0.02em] text-ink">Today at the bench</h1>
          <p className="mt-1 text-sm text-muted" data-i18n-ignore>{format(today, "EEEE, MMMM d")}</p>
        </div>

        <section aria-labelledby="active-run-title" className="overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
          <div className="border-b border-hairline/70 px-4 py-3">
            <h2 id="active-run-title" className="text-sm font-semibold text-ink">Active run</h2>
          </div>
          {activeRunBody}
        </section>

        <Link href="/entries/new?mode=capture" className="focus-ring flex min-h-14 items-center gap-3 rounded-[var(--ln-radius-panel)] border border-action-border bg-action-surface px-4 text-moss">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface"><Camera className="h-4 w-4" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Quick capture</span>
            <span className="mt-0.5 block text-xs text-muted">Photo, observation, or measurement</span>
          </span>
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>

        <MobileBenchStatus />
        <TodayCalculators />

        <section aria-labelledby="today-plan-title">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="today-plan-title" className="text-base font-semibold text-ink">Today’s plan</h2>
            <Link href="/protocol-run" className="focus-ring flex min-h-11 items-center px-2 text-xs font-semibold text-moss">All runs</Link>
          </div>
          <div className="divide-y divide-hairline overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
            {todayPlanRows}
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
        <PageHeader title="Overview" />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0 space-y-5">
            {/* Today first: what is running and what is planned, then the month for context. */}
            <section aria-label="Today" className="grid overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface md:grid-cols-2 md:divide-x md:divide-hairline">
              <div className="min-w-0">
                <h2 className="border-b border-hairline px-4 py-3 text-base font-semibold text-ink">Active run</h2>
                {activeRunBody}
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
                  <h2 className="text-base font-semibold text-ink">Today’s plan <span className="ml-1 text-sm font-normal text-muted" data-i18n-ignore>{format(today, "MMM d")}</span></h2>
                  <Link href="/protocol-run" className="text-xs font-medium text-moss hover:underline">All runs</Link>
                </div>
                <div className="divide-y divide-hairline">{todayPlanRows}</div>
              </div>
            </section>

            <OverviewCalendar
              key={viewMonthKey}
              monthKey={viewMonthKey}
              todayKey={todayKey}
              initialSelectedDateKey={initialSelectedDateKey}
              activities={calendarActivities}
            />
          </div>

          <aside aria-label="Start here" className="min-w-0 divide-y divide-hairline rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
            <nav aria-label="Quick actions" className="p-1.5">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.href} href={action.href} className="ln-quick-action focus-ring group flex h-9 items-center gap-2.5 rounded-[var(--ln-radius-control-md)] px-2.5">
                    <Icon className="ln-quick-action-icon h-4 w-4 shrink-0 text-moss" strokeWidth={1.7} aria-hidden />
                    <StaggeredText text={action.label} trigger="hover" className="min-w-0 flex-1 truncate text-sm font-medium text-ink" />
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted opacity-0 transition group-hover:opacity-100" aria-hidden />
                  </Link>
                );
              })}
            </nav>
            <section aria-labelledby="active-plans-title">
              <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-3">
                <h2 id="active-plans-title" className="text-sm font-semibold text-ink">Active plans</h2>
                <Link href="/research-plans?status=active" className="text-xs font-medium text-moss hover:underline">View all</Link>
              </div>
              {activeResearchPlans.length ? activeResearchPlans.map((plan) => (
                <Link key={plan.id} href={`/research-plans/${plan.id}`} className="focus-ring group block px-4 py-2.5 hover:bg-warm/60">
                  <span className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span className="record-identifier truncate">{plan.code}</span>
                    <span className="inline-flex shrink-0 items-center gap-1" aria-label={`${plan._count.experiments} experiments`}><Beaker className="h-3 w-3" aria-hidden /><span data-i18n-ignore>{plan._count.experiments}</span></span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-sm font-medium leading-5 text-ink group-hover:text-moss">{plan.title}</span>
                </Link>
              )) : <p className="px-4 pb-4 text-xs leading-5 text-muted">No active research plans.</p>}
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
