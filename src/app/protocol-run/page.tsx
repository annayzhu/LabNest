import { Plus, TabletSmartphone } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { FieldDevices } from "@/components/FieldDevices";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { ExperimentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { normalizeProtocolDocument } from "@/lib/protocol-document";
import { isRecordLocked } from "@/lib/record-lifecycle";
import { runProgressFromSource } from "@/lib/structured-run";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";

export const dynamic = "force-dynamic";

const primaryButton = buttonStyles({ variant: "primary", size: "md" });
const secondaryButton = buttonStyles({ variant: "secondary", size: "md" });

/** The watch follows runs whose Protocol is in step blocks (a document with systems), the same test the run page uses. */
function watchCanFollow(snapshot: unknown) {
  const versions = (snapshot as { versions?: Array<{ contentJson?: unknown }> } | null)?.versions;
  return Array.isArray(versions) && versions.some((version) => Boolean(normalizeProtocolDocument(version.contentJson)?.systems));
}

export default async function ProtocolRunIndex({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const selectedExperiment = firstSearchParam(params, "experiment");
  if (selectedExperiment) redirect(`/experiments/${selectedExperiment}/run`);

  const experiments = await prisma.experiment.findMany({
    where: { status: { in: [ExperimentStatus.planned, ExperimentStatus.running, ExperimentStatus.failed] } },
    include: {
      researchPlan: true,
      primaryProtocolVersion: { include: { protocol: true } },
      steps: { select: { id: true, protocolStepRef: true, groupKey: true, completed: true } },
      protocolRun: { select: { executionPlanJson: true } },
      _count: { select: { results: true } },
    },
    orderBy: [{ status: "asc" }, { date: "desc" }],
    take: 50,
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Run mode"
          description="Run experiments at the bench on a tablet, phone or Apple Watch: choose an experiment, open it on this device, or scan to send it to another device."
          actions={<Link href="/experiments/new" className={secondaryButton}><Plus className="h-4 w-4" aria-hidden />New Experiment</Link>}
        />
        {experiments.length ? (
          <div className="divide-y divide-hairline overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
            {experiments.map((experiment) => {
              const { done, total } = runProgressFromSource(experiment.protocolSnapshotJson, experiment.protocolRun?.executionPlanJson, experiment.steps);
              const progress = total ? Math.round((done / total) * 100) : 0;
              return (
                <div key={experiment.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="record-identifier text-xs text-muted">{experiment.runCode}</span>
                      <StatusPill status={experiment.status} />
                    </div>
                    <h2 className="mt-2 truncate text-lg font-semibold text-ink"><Link href={`/experiments/${experiment.id}/run`} className="focus-ring hover:text-moss">{experiment.title}</Link></h2>
                    <p className="mt-1 text-xs text-muted">
                      {experiment.researchPlan?.code ?? "Unassigned plan"}
                      {experiment.primaryProtocolVersion ? ` · ${experiment.primaryProtocolVersion.protocol.canonicalTitle ?? experiment.primaryProtocolVersion.protocol.title} · ${experiment.primaryProtocolVersion.protocol.humanCode ?? "Uncoded"} · ${experiment.primaryProtocolVersion.displayVersion}` : ""}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-1.5 max-w-72 flex-1 overflow-hidden rounded-full bg-stone">
                        <div className="h-full rounded-full bg-moss" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="shrink-0 text-xs text-muted">{done}/{total} steps · {experiment._count.results} results</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Link href={`/experiments/${experiment.id}/run?view=bench`} className={primaryButton}><TabletSmartphone className="h-4 w-4" aria-hidden />Open on this device</Link>
                    <FieldDevices experimentId={experiment.id} title={experiment.title} watch={!watchCanFollow(experiment.protocolSnapshotJson) ? "legacy" : isRecordLocked(experiment.recordStatus) ? "locked" : "ready"} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[var(--ln-radius-panel)] border border-dashed border-hairline bg-surface px-5 py-12 text-center">
            <p className="text-sm text-muted">No planned or running Experiments are available.</p>
            <Link href="/experiments/new" className="mt-4 inline-flex text-sm font-medium text-moss hover:underline">Create an Experiment</Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
