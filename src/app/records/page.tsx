import { format } from "date-fns";
import { Beaker, BookOpen, Database } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type RecordEvent = {
  id: string;
  kind: "Entry" | "Experiment" | "Result";
  title: string;
  href: string;
  occurredAt: Date;
  context?: string;
};

export default async function RecordsPage() {
  const [entries, experiments, results] = await Promise.all([
    prisma.entry.findMany({ orderBy: { occurredAt: "desc" }, take: 40, select: { id: true, title: true, occurredAt: true, researchPlan: { select: { code: true } }, project: { select: { name: true } } } }),
    prisma.experiment.findMany({ orderBy: { date: "desc" }, take: 40, select: { id: true, title: true, date: true, runCode: true } }),
    prisma.result.findMany({ orderBy: { updatedAt: "desc" }, take: 40, select: { id: true, title: true, updatedAt: true, resultType: true } }),
  ]);
  const events: RecordEvent[] = [
    ...entries.map((entry) => ({ id: `entry-${entry.id}`, kind: "Entry" as const, title: entry.title, href: `/entries/${entry.id}`, occurredAt: entry.occurredAt, context: entry.researchPlan?.code ?? entry.project?.name })),
    ...experiments.map((experiment) => ({ id: `experiment-${experiment.id}`, kind: "Experiment" as const, title: experiment.title, href: `/experiments/${experiment.id}`, occurredAt: experiment.date, context: experiment.runCode })),
    ...results.map((result) => ({ id: `result-${result.id}`, kind: "Result" as const, title: result.title, href: `/results/${result.id}`, occurredAt: result.updatedAt, context: result.resultType })),
  ].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime()).slice(0, 80);
  const icons = { Entry: BookOpen, Experiment: Beaker, Result: Database };

  return <AppShell><div className="space-y-4">
    <PageHeader title="Records" description="Entries, experiments, and results in one chronological view." />
    <div className="divide-y divide-hairline overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
      {events.length ? events.map((event) => {
        const Icon = icons[event.kind];
        return <Link key={event.id} href={event.href} className="focus-ring flex min-h-14 items-center gap-3 px-4 py-3 transition hover:bg-warm/60">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warm text-moss"><Icon className="h-4 w-4" aria-hidden /></span>
          <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{event.kind}</span><span className="mt-0.5 line-clamp-2 block text-sm font-semibold leading-5 text-ink">{event.title}</span>{event.context ? <span className="mt-1 block truncate text-xs text-muted">{event.context}</span> : null}</span>
          <time className="shrink-0 text-right text-[11px] leading-4 text-muted" dateTime={event.occurredAt.toISOString()}>{format(event.occurredAt, "MMM d")}<br />{format(event.occurredAt, "HH:mm")}</time>
        </Link>;
      }) : <p className="px-4 py-10 text-center text-sm text-muted">No records yet.</p>}
    </div>
  </div></AppShell>;
}
