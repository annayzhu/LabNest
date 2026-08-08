import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const createLinkClass =
  "focus-ring inline-flex h-9 items-center rounded-[8px] border border-moss bg-moss px-3 text-sm font-medium text-warm transition hover:brightness-95";

export default async function OverviewPage() {
  const [
    projectCount,
    planCount,
    runningExperimentCount,
    pendingResultCount,
    activeProtocolCount,
    recentEntries,
    recentExperiments,
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
  ]);

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

        <section aria-label="Workspace metrics" className="grid gap-px overflow-hidden rounded-[10px] border border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map(([label, value, href]) => (
            <Link key={label} href={href} className="focus-ring bg-surface px-4 py-3 transition hover:bg-warm">
              <span className="block font-mono text-2xl font-medium text-ink">{value}</span>
              <span className="mt-1 block text-xs text-muted">{label}</span>
            </Link>
          ))}
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader
              title="Recent entries"
              eyebrow="Fast capture"
              action={<Link href="/entries" className="text-sm font-medium text-moss hover:underline">View all</Link>}
            />
            <CardBody className="divide-y divide-hairline p-0">
              {recentEntries.length ? recentEntries.map((entry) => (
                <article key={entry.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-ink">{entry.title}</h3>
                      <p className="mt-1 truncate text-xs text-muted">
                        {entry.researchPlan?.title ?? entry.project?.name ?? "Unassigned"}
                      </p>
                    </div>
                    <StatusPill status={entry.recordStatus} />
                  </div>
                </article>
              )) : <p className="px-5 py-6 text-sm text-muted">No entries yet.</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Recent experiments"
              eyebrow="Execution"
              action={<Link href="/experiments" className="text-sm font-medium text-moss hover:underline">View all</Link>}
            />
            <CardBody className="divide-y divide-hairline p-0">
              {recentExperiments.length ? recentExperiments.map((experiment) => (
                <article key={experiment.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-ink">{experiment.title}</h3>
                      <p className="mt-1 truncate text-xs text-muted">
                        {experiment.researchPlan?.title ?? experiment.project?.name ?? "Unassigned"}
                      </p>
                    </div>
                    <StatusPill status={experiment.status} />
                  </div>
                </article>
              )) : <p className="px-5 py-6 text-sm text-muted">No experiments yet.</p>}
            </CardBody>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
