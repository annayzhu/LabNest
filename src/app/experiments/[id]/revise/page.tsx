import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ReviseForm } from "@/components/ReviseForm";
import { buttonStyles } from "@/components/ui/Button";
import { prisma } from "@/lib/db";
import { revisionCandidates } from "@/lib/protocol-revision";
import { structuredRunView } from "@/lib/structured-run";

export const dynamic = "force-dynamic";

/** Revise protocol from this run (整理成规程修订): choose which of this run's actual values and deviation notes go into a new draft version. */
export default async function ReviseFromExperimentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const experiment = await prisma.experiment.findUnique({ where: { id }, include: { protocolRun: true, steps: true } });
  if (!experiment) notFound();
  const view = structuredRunView(experiment.protocolSnapshotJson, experiment.protocolRun?.executionPlanJson, experiment.steps);
  const candidates = revisionCandidates(view, experiment.steps);
  const sourceIds = [...new Set(candidates.map(candidate => candidate.sourceVersionId))];
  const sources = await prisma.protocolVersion.findMany({ where: { id: { in: sourceIds } }, include: { protocol: { select: { id: true, humanCode: true, canonicalTitle: true, title: true, versions: { orderBy: { revision: "desc" }, take: 1, select: { id: true, displayVersion: true } } } } } });
  const groups = sourceIds.flatMap(sourceId => {
    const source = sources.find(version => version.id === sourceId);
    if (!source) return [];
    const latest = source.protocol.versions[0];
    return [{ sourceVersionId: sourceId, protocolId: source.protocol.id, humanCode: source.protocol.humanCode, title: source.protocol.canonicalTitle ?? source.protocol.title, displayVersion: source.displayVersion,
      newerVersion: latest && latest.id !== sourceId ? latest.displayVersion : undefined, candidates: candidates.filter(candidate => candidate.sourceVersionId === sourceId) }];
  });
  return <AppShell>
    <div className="space-y-5">
      <PageHeader identifier={experiment.runCode} title="Revise protocol from this run"
        actions={<Link href={`/experiments/${experiment.id}`} className={buttonStyles({ size: "md", className: "bg-surface font-medium text-moss hover:bg-warm" })}><ArrowLeft className="h-4 w-4" aria-hidden />Back to experiment record</Link>} />
      {groups.length ? <ReviseForm experimentId={experiment.id} groups={groups} /> : <p className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface px-4 py-3 text-sm text-graphite">Every actual value recorded in this run matches the Protocol and there are no deviation notes, so there is nothing to revise.</p>}
    </div>
  </AppShell>;
}
