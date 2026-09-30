import { stepsWithExecutionEvidence } from "@/lib/run-evidence.server";
import { ExperimentBrief } from "@/components/ExperimentBrief";
import { experimentExecutionDocument } from "@/lib/experiment-document";
import { CopyExperimentButton } from "@/components/CopyExperimentButton";
import { Lock, Play } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityHistory } from "@/components/ActivityHistory";
import { AppShell } from "@/components/AppShell";
import { AttachmentUploadForm } from "@/components/AttachmentUploadForm";
import { AttachmentDeleteButton } from "@/components/AttachmentDeleteButton";
import { ExperimentResultRecordingCard } from "@/components/ExperimentResultRecording";
import { DocumentPrintButton } from "@/components/DocumentPrintButton";
import { PageActionsMenu } from "@/components/PageActionsMenu";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolIdentity } from "@/components/ProtocolIdentity";
import { RecordLifecycleControl } from "@/components/RecordLifecycleControl";
import { RecordStatusControl } from "@/components/RecordStatusControl";
import { RecycleBinWarning } from "@/components/RecycleBinWarning";
import { ScientificDocumentView } from "@/components/ScientificDocumentView";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/lib/db";
import { buildExperimentResultRecording, preferredResultRecordingHref } from "@/lib/experiment-results";
import { experimentDeleteBlockers, isRecordLocked } from "@/lib/record-lifecycle";
import { archiveExperiment, deleteExperiment } from "../actions";

export const dynamic = "force-dynamic";
const primaryButton = buttonStyles({ variant: "primary", size: "md" });
const secondaryButton = buttonStyles({ size: "md", className: "bg-surface font-medium text-moss hover:bg-warm" });

export default async function ExperimentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [experiment, attachmentLinks] = await Promise.all([
    prisma.experiment.findUnique({ where: { id }, include: {
      project: true, researchPlan: true, primaryProtocolVersion: { include: { protocol: true } },
      protocolVersions: { orderBy: { order: "asc" }, include: { protocolVersion: { include: { protocol: true } } } },
      protocolRun: true, steps: { orderBy: [{ groupOrder: "asc" }, { order: "asc" }] }, results: { orderBy: { updatedAt: "desc" }, include: { _count: { select: { datasets: true } } } },
      _count: { select: { results: true, inventoryTransactions: true, sampleEvents: true } },
    } }),
    prisma.attachmentLink.findMany({ where: { targetType: "experiment", targetId: id }, include: { attachment: true }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!experiment) notFound();
  const document = experimentExecutionDocument(experiment.contentJson, await stepsWithExecutionEvidence(experiment.steps), experiment.protocolRun?.parametersJson,experiment.protocolSnapshotJson);
  const completed = experiment.steps.filter((step) => step.completed).length;
  const resultRecording = buildExperimentResultRecording(experiment.protocolVersions.map((link) => ({
    protocolVersionId: link.protocolVersionId,
    protocolCode: link.protocolVersion.protocol.humanCode,
    protocolTitle: link.protocolVersion.protocol.canonicalTitle ?? link.protocolVersion.protocol.title,
    displayVersion: link.protocolVersion.displayVersion,
    resultTemplatesJson: link.protocolVersion.resultTemplatesJson,
  })), experiment.results);
  const resultRecordingHref = preferredResultRecordingHref(experiment.id, resultRecording);
  const recycleConditions = [
    ...(experiment.researchPlanId ? [{ targetType: "research_plan", targetId: experiment.researchPlanId }] : []),
    ...experiment.protocolVersions.map((row) => ({ targetType: "protocol", targetId: row.protocolVersion.protocolId })),
    ...experiment.results.map((row) => ({ targetType: "result", targetId: row.id })),
  ];
  const [reportSourceReferences, entryReferences, proposedActions, recycledAssociations, activityLogs] = await Promise.all([
    prisma.reportSource.count({ where: { sourceType: "experiment", sourceId: experiment.id } }),
    prisma.itemLink.count({ where: { sourceType: "entry", targetType: "experiment", targetId: experiment.id } }),
    experiment.protocolRun ? prisma.proposedAction.count({ where: { sourceType: "protocol", sourceId: experiment.protocolRun.id } }) : Promise.resolve(0),
    recycleConditions.length ? prisma.deletedRecord.findMany({ where: { restoredAt: null, OR: recycleConditions }, select: { targetType: true, targetId: true } }) : Promise.resolve([]),
    prisma.activityLog.findMany({ where: { targetType: "experiment", targetId: experiment.id }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const locked = isRecordLocked(experiment.recordStatus);
  const recycledKeys = new Set(recycledAssociations.map((row) => `${row.targetType}:${row.targetId}`));
  const deletionBlockers = experimentDeleteBlockers(experiment.status, experiment.recordStatus, {
    ...experiment._count,
    completedSteps: completed,
    deviations: experiment.steps.filter((step) => Boolean(step.deviationNote)).length,
    attachments: attachmentLinks.length,
    reportSourceReferences,
    entryReferences,
    proposedActions,
  });
  return <AppShell><div className="space-y-6">
    <PageHeader className="experiment-page-header" identifier={experiment.runCode} eyebrow={experiment.researchPlan?.code ?? "Unassigned plan"} title={experiment.title} description={experiment.purpose ?? "Purpose not recorded."} actions={<>{experiment.status !== "archived" ? <Link href={`/experiments/${experiment.id}/run`} className={primaryButton}><Play className="h-4 w-4" aria-hidden />Run</Link> : null}{locked ? null : <Link href={`/experiments/${experiment.id}/edit`} className={secondaryButton}>Edit experiment</Link>}<PageActionsMenu><Link href={resultRecordingHref}>Record results</Link><CopyExperimentButton id={experiment.id} /><DocumentPrintButton showLabel /><RecordLifecycleControl menuItem id={experiment.id} identifier={experiment.runCode} title={experiment.title} recordLabel="Experiment" recordLabelZh="实验" blockers={deletionBlockers} archived={experiment.status === "archived"} deleteAction={deleteExperiment} archiveAction={archiveExperiment} editHref={`/experiments/${experiment.id}/edit`} /></PageActionsMenu></>} />
    {recycledAssociations.some((row) => row.targetType === "research_plan") ? <RecycleBinWarning label="Research Plan" labelZh="研究方案" /> : null}
    {recycledAssociations.some((row) => row.targetType === "protocol") ? <RecycleBinWarning label="Protocol" labelZh="实验规程" /> : null}
    {recycledAssociations.some((row) => row.targetType === "result") ? <RecycleBinWarning label="Result" labelZh="结果" /> : null}
    <div className="document-preview-layout">
      <main className="document-preview-main space-y-6">
        <ScientificDocumentView document={document} title={experiment.title} identifier={experiment.runCode} subtitle={experiment.purpose} leadingContent={<ExperimentBrief id={experiment.runCode} plan={experiment.researchPlan?.title ?? null} snapshot={experiment.protocolSnapshotJson} />} />

      </main>

      <aside className="document-preview-sidebar" aria-label="Experiment controls and result recording">
        <Card><CardHeader className="min-h-10 px-3 py-2" title="Execution control" eyebrow="Plan and exact method provenance" action={<div className="flex gap-1"><StatusPill status={experiment.status} />{locked ? <Badge tone="neutral"><Lock className="mr-1 h-3 w-3" aria-hidden />Locked</Badge> : null}</div>} /><CardBody className="space-y-2.5 p-3">
          <div className="grid grid-cols-2 gap-x-3"><Control label="Research Plan">{experiment.researchPlan ? <span className="flex flex-wrap items-center gap-1"><Link href={`/research-plans/${experiment.researchPlan.id}`} className="text-moss hover:underline">{experiment.researchPlan.code ?? experiment.researchPlan.title}</Link>{recycledKeys.has(`research_plan:${experiment.researchPlan.id}`) ? <Badge tone="warning" className="min-h-5 px-1.5 py-0 text-xs leading-4">In Recycle Bin</Badge> : null}</span> : <span className="text-warning">Unassigned</span>}</Control><Control label="Project">{experiment.project?.name ?? "—"}</Control></div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-hairline pt-2"><CompactStat label="Date" value={experiment.date.toLocaleDateString()} /><CompactStat label="Steps" value={`${completed}/${experiment.steps.length}`} /><CompactStat label="Results" value={experiment.results.length} /><CompactStat label="Attachments" value={attachmentLinks.length} /></div>
          {experiment.primaryProtocolVersion ? <Link aria-label={`Primary protocol: ${experiment.primaryProtocolVersion.protocol.canonicalTitle ?? experiment.primaryProtocolVersion.protocol.title}`} href={`/protocols/${experiment.primaryProtocolVersion.protocolId}?version=${experiment.primaryProtocolVersion.id}`} className="block border-t border-hairline pt-2 text-moss hover:underline"><ProtocolIdentity compact title={experiment.primaryProtocolVersion.protocol.canonicalTitle ?? experiment.primaryProtocolVersion.protocol.title} code={experiment.primaryProtocolVersion.protocol.humanCode} version={experiment.primaryProtocolVersion.displayVersion} meta={experiment.tags.join(" · ") || undefined} /></Link> : experiment.tags.length ? <p className="border-t border-hairline pt-2 text-xs text-muted">{experiment.tags.join(" · ")}</p> : null}
          <div className="border-t border-hairline pt-2"><RecordStatusControl targetType="experiment" id={experiment.id} recordStatus={experiment.recordStatus} /></div>
        </CardBody></Card>

        <ExperimentResultRecordingCard experimentId={experiment.id} recording={resultRecording} />

        <Card><CardHeader title="Protocol versions" eyebrow="Fixed at creation · badge shows review stage" /><CardBody className="py-1"><ul className="divide-y divide-hairline">{experiment.protocolVersions.map((row) => <li key={row.protocolVersionId} className="py-2.5"><div className="flex min-w-0 items-start justify-between gap-2"><Link href={`/protocols/${row.protocolVersion.protocolId}?version=${row.protocolVersionId}`} className="min-w-0 flex-1 text-moss hover:underline"><ProtocolIdentity compact title={row.protocolVersion.protocol.canonicalTitle ?? row.protocolVersion.protocol.title} code={row.protocolVersion.protocol.humanCode} version={row.protocolVersion.displayVersion} /></Link><div className="flex shrink-0 flex-wrap justify-end gap-1"><Badge tone={row.role === "primary" ? "sage" : "neutral"}>{row.role}</Badge><StatusPill status={row.protocolVersion.reviewStage} />{recycledKeys.has(`protocol:${row.protocolVersion.protocolId}`) ? <Badge tone="warning">In Recycle Bin</Badge> : null}</div></div></li>)}</ul></CardBody></Card>

        <Card><CardHeader title="Attachments" eyebrow="Images, videos and instrument files" /><CardBody className="space-y-4"><AttachmentUploadForm targetType="experiment" targetId={experiment.id} hideTargetFields />{attachmentLinks.length ? <ul className="space-y-2 border-t border-hairline pt-4">{attachmentLinks.map((link) => <li key={link.id} className="flex items-center gap-2"><Link href={`/api/attachments/${link.attachment.id}`} className="min-w-0 flex-1 break-all text-sm font-medium text-moss hover:underline">{link.attachment.originalFilename}</Link><span className="text-xs text-muted">{(link.attachment.size / 1024).toFixed(1)} KB</span><AttachmentDeleteButton attachmentId={link.attachment.id} linkId={link.id} filename={link.attachment.originalFilename} /></li>)}</ul> : null}</CardBody></Card>

        <ActivityHistory logs={activityLogs} />
      </aside>
    </div>
  </div></AppShell>;
}

function Control({ label, children }: { label: string; children: React.ReactNode }) { return <div className="min-w-0"><p className="text-xs font-semibold uppercase leading-3 tracking-[0.07em] text-muted">{label}</p><div className="mt-0.5 min-w-0 break-words text-xs font-medium leading-4 text-ink">{children}</div></div>; }

function CompactStat({ label, value }: { label: string; value: React.ReactNode }) { return <span className="whitespace-nowrap text-xs leading-4 text-muted"><span className="font-semibold uppercase tracking-[0.04em]">{label}</span><strong className="ml-1 font-medium text-ink">{value}</strong></span>; }
