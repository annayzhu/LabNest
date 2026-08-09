import { ArrowRight, FlaskConical, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/ui/Badge";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";

export const dynamic = "force-dynamic";

const primaryButton = "focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm";

export default async function ProtocolRunIndex({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const selectedExperiment = firstSearchParam(params, "experiment");
  if (selectedExperiment) redirect(`/experiments/${selectedExperiment}/run`);

  const experiments = await prisma.experiment.findMany({
    where: { status: { in: ["planned", "running", "failed"] } },
    include: {
      researchPlan: true,
      primaryProtocolVersion: { include: { protocol: true } },
      steps: { select: { completed: true } },
      _count: { select: { results: true } },
    },
    orderBy: [{ status: "asc" }, { date: "desc" }],
    take: 50,
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Protocol Run"
          actions={<Link href="/experiments/new" className={primaryButton}><Plus className="h-4 w-4" aria-hidden />New Experiment</Link>}
        />
        {experiments.length ? (
          <div className="divide-y divide-hairline overflow-hidden rounded-[12px] border border-hairline bg-surface">
            {experiments.map((experiment) => {
              const completed = experiment.steps.filter((step) => step.completed).length;
              const total = experiment.steps.length;
              const progress = total ? Math.round((completed / total) * 100) : 0;
              return (
                <Link
                  key={experiment.id}
                  href={`/experiments/${experiment.id}/run`}
                  className="focus-ring group grid gap-3 px-4 py-4 transition hover:bg-warm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted">{experiment.runCode}</span>
                      <StatusPill status={experiment.status} />
                    </div>
                    <h2 className="mt-2 truncate font-serif text-lg font-medium text-ink">{experiment.title}</h2>
                    <p className="mt-1 text-xs text-muted">
                      {experiment.researchPlan?.code ?? "Unassigned plan"}
                      {experiment.primaryProtocolVersion ? ` · ${experiment.primaryProtocolVersion.protocol.humanCode ?? experiment.primaryProtocolVersion.protocol.title} · ${experiment.primaryProtocolVersion.displayVersion}` : ""}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-1.5 max-w-72 flex-1 overflow-hidden rounded-full bg-stone">
                        <div className="h-full rounded-full bg-moss" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="shrink-0 text-xs text-muted">{completed}/{total} steps · {experiment._count.results} results</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-moss">
                    <FlaskConical className="h-4 w-4" aria-hidden />Open run<ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[12px] border border-dashed border-hairline bg-surface px-5 py-12 text-center">
            <p className="text-sm text-muted">No planned or running Experiments are available.</p>
            <Link href="/experiments/new" className="mt-4 inline-flex text-sm font-medium text-moss hover:underline">Create an Experiment</Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
