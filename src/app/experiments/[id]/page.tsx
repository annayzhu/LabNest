import { Play } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AttachmentUploadForm } from "@/components/AttachmentUploadForm";
import { AttachmentDeleteButton } from "@/components/AttachmentDeleteButton";
import { ExperimentResultRecordingCard } from "@/components/ExperimentResultRecording";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolIdentity } from "@/components/ProtocolIdentity";
import { RecordLifecycleControl } from "@/components/RecordLifecycleControl";
import { RecycleBinWarning } from "@/components/RecycleBinWarning";
import { ScientificDocumentView } from "@/components/ScientificDocumentView";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/lib/db";
import { experimentStepGroupHeading } from "@/lib/experiment-planning";
import { buildExperimentResultRecording, preferredResultRecordingHref } from "@/lib/experiment-results";
import { experimentSections, normalizeScientificDocument } from "@/lib/scientific-document";
import { experimentDeleteBlockers } from "@/lib/record-lifecycle";
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
  const document = normalizeScientificDocument(experiment.contentJson, experimentSections);
  const completed = experiment.steps.filter((step) => step.completed).length;
  const resultRecording = buildExperimentResultRecording(experiment.protocolVersions.map((link) => ({
    protocolVersionId: link.protocolVersionId,
    protocolCode: link.protocolVersion.protocol.humanCode,
    protocolTitle: link.protocolVersion.protocol.canonicalTitle ?? link.protocolVersion.protocol.title,
    displayVersion: link.protocolVersion.displayVersion,
    resultTemplatesJson: link.protocolVersion.resultTemplatesJson,
  })), experiment.results);
  const resultRecordingHref = preferredResultRecordingHref(experiment.id, resultRecording);
  const stepGroups = Array.from(experiment.steps.reduce((groups, step) => {
    const group = groups.get(step.groupKey) ?? { key: step.groupKey, title: step.groupTitle, order: step.groupOrder, steps: [] as typeof experiment.steps };
    group.steps.push(step);
    groups.set(step.groupKey, group);
    return groups;
  }, new Map<string, { key: string; title: string; order: number; steps: typeof experiment.steps }>()).values()).sort((a, b) => a.order - b.order);
  const recycleConditions = [
    ...(experiment.researchPlanId ? [{ targetType: "research_plan", targetId: experiment.researchPlanId }] : []),
    ...experiment.protocolVersions.map((row) => ({ targetType: "protocol", targetId: row.protocolVersion.protocolId })),
    ...experiment.results.map((row) => ({ targetType: "result", targetId: row.id })),
  ];
  const [reportSourceReferences, entryReferences, proposedActions, recycledAssociations] = await Promise.all([
    prisma.reportSource.count({ where: { sourceType: "experiment", sourceId: experiment.id } }),
    prisma.itemLink.count({ where: { sourceType: "entry", targetType: "experiment", targetId: experiment.id } }),
    experiment.protocolRun ? prisma.proposedAction.count({ where: { sourceType: "protocol", sourceId: experiment.protocolRun.id } }) : Promise.resolve(0),
    recycleConditions.length ? prisma.deletedRecord.findMany({ where: { restoredAt: null, OR: recycleConditions }, select: { targetType: true, targetId: true } }) : Promise.resolve([]),
  ]);
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
    <PageHeader identifier={experiment.runCode} eyebrow={experiment.researchPlan?.code ?? "Unassigned plan"} title={experiment.title} description={experiment.purpose ?? "Purpose not recorded."} actions={<>{experiment.status !== "archived" ? <Link href={`/experiments/${experiment.id}/run`} className={primaryButton}><Play className="h-4 w-4" aria-hidden />Run</Link> : null}<Link href={resultRecordingHref} className={secondaryButton}>Record results</Link><Link href={`/experiments/${experiment.id}/edit`} className={secondaryButton}>Edit experiment</Link><RecordLifecycleControl id={experiment.id} identifier={experiment.runCode} title={experiment.title} recordLabel="Experiment" recordLabelZh="实验" blockers={deletionBlockers} archived={experiment.status === "archived"} deleteAction={deleteExperiment} archiveAction={archiveExperiment} editHref={`/experiments/${experiment.id}/edit`} /></>} />
    {recycledAssociations.some((row) => row.targetType === "research_plan") ? <RecycleBinWarning label="Research Plan" labelZh="研究方案" /> : null}
    {recycledAssociations.some((row) => row.targetType === "protocol") ? <RecycleBinWarning label="Protocol" labelZh="实验规程" /> : null}
    {recycledAssociations.some((row) => row.targetType === "result") ? <RecycleBinWarning label="Result" labelZh="结果" /> : null}
    <div className="document-editor-layout">
      <main className="document-editor-main space-y-6">
        <ScientificDocumentView document={document} title={experiment.title} identifier={experiment.runCode} subtitle={experiment.purpose} />
        <Card><CardHeader title="Execution record" eyebrow="Run mode is the source of step execution and live notes" action={<Link href={`/experiments/${experiment.id}/run`} className="inline-flex h-9 items-center rounded-[8px] border border-hairline bg-surface px-3 py-2 text-xs font-medium text-moss hover:bg-warm">Open run mode</Link>} /><CardBody className="space-y-2 text-sm leading-6 text-graphite"><p>{completed}/{experiment.steps.length} planned steps completed</p><p>{experiment.steps.filter((step) => Boolean(step.deviationNote)).length} deviations were recorded</p>{!experiment.steps.length ? <p className="text-xs text-muted">No fixed checklist steps were configured. Use run mode for freeform execution notes.</p> : null}</CardBody></Card>
        {stepGroups.length ? <Card><CardHeader title="Execution step history" eyebrow="Last known step-level status (for quick checks)" /><CardBody className="space-y-4">{stepGroups.map((group) => { const heading = experimentStepGroupHeading(group.title); return <section key={group.key} className="overflow-hidden rounded-[9px] border border-hairline"><div className="bg-sage-surface/55 px-3 py-2"><h3 className="text-sm font-semibold text-ink">{group.order + 1}. {heading.title}</h3>{heading.detail ? <p className="mt-0.5 text-xs text-muted">{heading.detail}</p> : null}</div><div className="divide-y divide-hairline">{group.steps.slice(0, 2).map((step) => <div key={step.id} className="flex gap-3 bg-warm px-3 py-3 text-sm"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${step.completed ? "border-moss bg-moss text-warm" : "border-border-strong"}`}>{step.completed ? "✓" : ""}</span><div><strong className="font-medium text-ink">{step.order}. {step.title}</strong>{step.description ? <p className="mt-1 leading-6 text-graphite">{step.description}</p> : null}{step.deviationNote ? <p className="mt-1 text-warning">Deviation: {step.deviationNote}</p> : null}</div></div>)}</div></section>; })}</CardBody></Card> : null}
      </main>

      <aside className="document-editor-sidebar experiment-detail-sidebar" aria-label="Experiment controls and result recording">
        <Card><CardHeader title="Execution control" eyebrow="Plan and exact method provenance" action={<div className="flex gap-1.5"><StatusPill status={experiment.status} /><StatusPill status={experiment.recordStatus} /></div>} /><CardBody className="space-y-3">
          <Control label="Research Plan">{experiment.researchPlan ? <span className="flex flex-wrap items-center gap-2"><Link href={`/research-plans/${experiment.researchPlan.id}`} className="text-moss hover:underline">{experiment.researchPlan.code ?? experiment.researchPlan.title}</Link>{recycledKeys.has(`research_plan:${experiment.researchPlan.id}`) ? <Badge tone="warning">In Recycle Bin</Badge> : null}</span> : <span className="text-warning">Unassigned</span>}</Control>
          <Control label="Project">{experiment.project?.name ?? "—"}</Control>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-hairline pt-3"><Control label="Date">{experiment.date.toLocaleDateString()}</Control><Control label="Steps">{completed}/{experiment.steps.length}</Control><Control label="Results">{experiment.results.length}</Control><Control label="Attachments">{attachmentLinks.length}</Control></div>
          <div className="space-y-2 border-t border-hairline pt-3">{experiment.tags.length ? <div className="flex flex-wrap gap-1.5">{experiment.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div> : null}{experiment.primaryProtocolVersion ? <Link href={`/protocols/${experiment.primaryProtocolVersion.protocolId}?version=${experiment.primaryProtocolVersion.id}`} className="block text-moss hover:underline"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">Primary protocol</span><ProtocolIdentity compact title={experiment.primaryProtocolVersion.protocol.canonicalTitle ?? experiment.primaryProtocolVersion.protocol.title} code={experiment.primaryProtocolVersion.protocol.humanCode} version={experiment.primaryProtocolVersion.displayVersion} /></Link> : null}</div>
        </CardBody></Card>

        <ExperimentResultRecordingCard experimentId={experiment.id} recording={resultRecording} />

        <Card><CardHeader title="Locked ProtocolVersions" /><CardBody className="py-1"><ul className="divide-y divide-hairline">{experiment.protocolVersions.map((row) => <li key={row.protocolVersionId} className="py-2.5"><div className="flex min-w-0 items-start justify-between gap-2"><Link href={`/protocols/${row.protocolVersion.protocolId}?version=${row.protocolVersionId}`} className="min-w-0 flex-1 text-moss hover:underline"><ProtocolIdentity compact title={row.protocolVersion.protocol.canonicalTitle ?? row.protocolVersion.protocol.title} code={row.protocolVersion.protocol.humanCode} version={row.protocolVersion.displayVersion} /></Link><div className="flex shrink-0 flex-wrap justify-end gap-1"><Badge tone={row.role === "primary" ? "sage" : "neutral"}>{row.role}</Badge><StatusPill status={row.protocolVersion.reviewStage} />{recycledKeys.has(`protocol:${row.protocolVersion.protocolId}`) ? <Badge tone="warning">In Recycle Bin</Badge> : null}</div></div></li>)}</ul></CardBody></Card>

        <Card><CardHeader title="Attachments" eyebrow="Images, videos and instrument files" /><CardBody className="space-y-4"><AttachmentUploadForm targetType="experiment" targetId={experiment.id} hideTargetFields />{attachmentLinks.length ? <ul className="space-y-2 border-t border-hairline pt-4">{attachmentLinks.map((link) => <li key={link.id} className="flex items-center gap-2"><Link href={`/api/attachments/${link.attachment.id}`} className="min-w-0 flex-1 break-all text-sm font-medium text-moss hover:underline">{link.attachment.originalFilename}</Link><span className="text-xs text-muted">{(link.attachment.size / 1024).toFixed(1)} KB</span><AttachmentDeleteButton attachmentId={link.attachment.id} linkId={link.id} filename={link.attachment.originalFilename} /></li>)}</ul> : null}</CardBody></Card>
      </aside>
    </div>
  </div></AppShell>;
}

function Control({ label, children }: { label: string; children: React.ReactNode }) { return <div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p><div className="mt-1 text-sm font-medium leading-5 text-ink">{children}</div></div>; }
