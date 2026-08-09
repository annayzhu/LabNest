import { Play } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AttachmentUploadForm } from "@/components/AttachmentUploadForm";
import { PageHeader } from "@/components/PageHeader";
import { ScientificDocumentView } from "@/components/ScientificDocumentView";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { experimentSections, normalizeScientificDocument } from "@/lib/scientific-document";

export const dynamic = "force-dynamic";
const primaryButton = "focus-ring inline-flex h-10 items-center justify-center rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm";
const secondaryButton = "focus-ring inline-flex h-10 items-center justify-center rounded-[8px] border border-hairline bg-surface px-4 text-sm font-medium text-moss hover:bg-warm";

export default async function ExperimentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [experiment, attachmentLinks] = await Promise.all([
    prisma.experiment.findUnique({ where: { id }, include: {
      project: true, researchPlan: true, primaryProtocolVersion: { include: { protocol: true } },
      protocolVersions: { orderBy: { order: "asc" }, include: { protocolVersion: { include: { protocol: true } } } },
      protocolRun: true, steps: { orderBy: { order: "asc" } }, results: { orderBy: { updatedAt: "desc" }, include: { _count: { select: { datasets: true } } } },
    } }),
    prisma.attachmentLink.findMany({ where: { targetType: "experiment", targetId: id }, include: { attachment: true }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!experiment) notFound();
  const document = normalizeScientificDocument(experiment.contentJson, experimentSections);
  const completed = experiment.steps.filter((step) => step.completed).length;
  return <AppShell><div className="space-y-6">
    <PageHeader identifier={experiment.runCode} eyebrow={experiment.researchPlan?.code ?? "Unassigned plan"} title={experiment.title} description={experiment.purpose ?? "Purpose not recorded."} actions={<>{experiment.status !== "archived" ? <Link href={`/experiments/${experiment.id}/run`} className={primaryButton}><Play className="h-4 w-4" aria-hidden />Run</Link> : null}<Link href={`/results/new?experiment=${experiment.id}`} className={secondaryButton}>Add Result</Link><Link href={`/experiments/${experiment.id}/edit`} className={secondaryButton}>Edit experiment</Link></>} />
    <Card><CardHeader title="Execution control" eyebrow="Plan and exact method provenance" action={<div className="flex gap-2"><StatusPill status={experiment.status} /><StatusPill status={experiment.recordStatus} /></div>} /><CardBody className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <Control label="Research Plan">{experiment.researchPlan ? <Link href={`/research-plans/${experiment.researchPlan.id}`} className="text-moss hover:underline">{experiment.researchPlan.code ?? experiment.researchPlan.title}</Link> : <span className="text-warning">Unassigned</span>}</Control>
      <Control label="Project">{experiment.project?.name ?? "—"}</Control><Control label="Date">{experiment.date.toLocaleDateString()}</Control><Control label="Steps">{completed}/{experiment.steps.length}</Control><Control label="Results">{experiment.results.length}</Control><Control label="Attachments">{attachmentLinks.length}</Control>
      <div className="sm:col-span-2 xl:col-span-6 flex flex-wrap gap-2 border-t border-hairline pt-3">{experiment.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}{experiment.primaryProtocolVersion ? <Link href={`/protocols/${experiment.primaryProtocolVersion.protocolId}?version=${experiment.primaryProtocolVersion.id}`} className="text-xs font-medium text-moss hover:underline">Primary: {experiment.primaryProtocolVersion.protocol.humanCode ?? experiment.primaryProtocolVersion.protocol.title} · {experiment.primaryProtocolVersion.displayVersion}</Link> : null}</div>
    </CardBody></Card>
    <ScientificDocumentView document={document} />
    <Card><CardHeader title="Locked ProtocolVersions" eyebrow="Snapshot retained independently of future Protocol edits" /><CardBody><DataTable rows={experiment.protocolVersions} getRowKey={(row) => row.protocolVersionId} columns={[
      { key: "protocol", header: "Protocol", render: (row) => <Link href={`/protocols/${row.protocolVersion.protocolId}?version=${row.protocolVersionId}`} className="font-semibold text-moss hover:underline">{row.protocolVersion.protocol.humanCode ?? row.protocolVersion.protocol.title}</Link> },
      { key: "version", header: "Version", render: (row) => row.protocolVersion.displayVersion },
      { key: "review", header: "Review stage", render: (row) => <StatusPill status={row.protocolVersion.reviewStage} /> },
      { key: "role", header: "Role", render: (row) => <Badge tone={row.role === "primary" ? "sage" : "neutral"}>{row.role}</Badge> },
    ]} /></CardBody></Card>
    {experiment.steps.length ? <Card><CardHeader title="Execution checklist" eyebrow="Copied from the primary ProtocolVersion" /><CardBody className="space-y-2">{experiment.steps.map((step) => <div key={step.id} className="flex gap-3 rounded-[8px] border border-hairline bg-warm px-3 py-3 text-sm"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${step.completed ? "border-moss bg-moss text-warm" : "border-border-strong"}`}>{step.completed ? "✓" : ""}</span><div><strong className="font-medium text-ink">{step.order}. {step.title}</strong><p className="mt-1 leading-6 text-graphite">{step.description}</p>{step.deviationNote ? <p className="mt-1 text-warning">Deviation: {step.deviationNote}</p> : null}</div></div>)}</CardBody></Card> : null}
    <Card><CardHeader title="Results" eyebrow="Structured evidence produced by this execution" action={<Link href={`/results/new?experiment=${experiment.id}`} className="text-sm font-medium text-moss hover:underline">Add result</Link>} /><CardBody>{experiment.results.length ? <DataTable rows={experiment.results} getRowKey={(row) => row.id} columns={[
      { key: "result", header: "Result", render: (row) => <Link href={`/results/${row.id}`} className="font-semibold text-moss hover:underline">{row.title}</Link> },
      { key: "type", header: "Type", render: (row) => row.resultType }, { key: "datasets", header: "Datasets", render: (row) => row._count.datasets },
      { key: "quality", header: "QC", render: (row) => <StatusPill status={row.qualityStatus} /> }, { key: "record", header: "Record", render: (row) => <StatusPill status={row.recordStatus} /> },
    ]} /> : <p className="text-sm text-muted">No Results recorded.</p>}</CardBody></Card>
    <Card><CardHeader title="Attachments" eyebrow="Images, videos and instrument files" /><CardBody className="space-y-4"><AttachmentUploadForm targetType="experiment" targetId={experiment.id} hideTargetFields />{attachmentLinks.length ? <ul className="space-y-2 border-t border-hairline pt-4">{attachmentLinks.map((link) => <li key={link.id}><Link href={`/api/attachments/${link.attachment.id}`} className="text-sm font-medium text-moss hover:underline">{link.attachment.originalFilename}</Link> <span className="text-xs text-muted">· {(link.attachment.size / 1024).toFixed(1)} KB</span></li>)}</ul> : null}</CardBody></Card>
  </div></AppShell>;
}

function Control({ label, children }: { label: string; children: React.ReactNode }) { return <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p><div className="mt-2 text-sm font-medium text-ink">{children}</div></div>; }
