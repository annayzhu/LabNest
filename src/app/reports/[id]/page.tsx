import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AttachmentUploadForm } from "@/components/AttachmentUploadForm";
import { PageHeader } from "@/components/PageHeader";
import { RecordLifecycleControl } from "@/components/RecordLifecycleControl";
import { RecycleBinWarning } from "@/components/RecycleBinWarning";
import { ScientificDocumentView } from "@/components/ScientificDocumentView";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { normalizeScientificDocument, reportSections } from "@/lib/scientific-document";
import { reportDeleteBlockers } from "@/lib/record-lifecycle";
import { archiveReport, deleteReport, refreshReportSources } from "../actions";

export const dynamic = "force-dynamic";
const primaryButton = "focus-ring inline-flex h-10 items-center justify-center rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm";
const secondaryButton = "focus-ring inline-flex h-10 items-center justify-center rounded-[8px] border border-hairline bg-surface px-4 text-sm font-medium text-moss hover:bg-warm";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [report, attachmentLinks] = await Promise.all([
    prisma.report.findUnique({ where: { id }, include: { project: true, researchPlan: true, sources: { orderBy: { order: "asc" } } } }),
    prisma.attachmentLink.findMany({ where: { targetType: "report", targetId: id }, include: { attachment: true }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!report) notFound();
  const document = normalizeScientificDocument(report.contentJson, reportSections);
  const snapshot = report.sourceSnapshotJson && typeof report.sourceSnapshotJson === "object" && !Array.isArray(report.sourceSnapshotJson) ? report.sourceSnapshotJson as Record<string, unknown> : {};
  const counts = snapshot.counts && typeof snapshot.counts === "object" && !Array.isArray(snapshot.counts) ? snapshot.counts as Record<string, number> : {};
  const generatedAt = typeof snapshot.generatedAt === "string" ? new Date(snapshot.generatedAt) : null;
  const protocolVersionSourceIds = report.sources.filter((row) => row.sourceType === "protocol_version").map((row) => row.sourceId);
  const [itemReferences, reportSourceReferences, sourceProtocolVersions] = await Promise.all([
    prisma.itemLink.count({ where: { OR: [{ sourceType: "report", sourceId: report.id }, { targetType: "report", targetId: report.id }] } }),
    prisma.reportSource.count({ where: { sourceType: "report", sourceId: report.id } }),
    protocolVersionSourceIds.length ? prisma.protocolVersion.findMany({ where: { id: { in: protocolVersionSourceIds } }, select: { id: true, protocolId: true } }) : Promise.resolve([]),
  ]);
  const protocolIdByVersionId = new Map(sourceProtocolVersions.map((row) => [row.id, row.protocolId]));
  const recycleConditions = [
    ...(report.researchPlanId ? [{ targetType: "research_plan", targetId: report.researchPlanId }] : []),
    ...report.sources.filter((row) => ["research_plan", "protocol", "result"].includes(row.sourceType)).map((row) => ({ targetType: row.sourceType, targetId: row.sourceId })),
    ...sourceProtocolVersions.map((row) => ({ targetType: "protocol", targetId: row.protocolId })),
  ];
  const recycledRecords = recycleConditions.length ? await prisma.deletedRecord.findMany({ where: { restoredAt: null, OR: recycleConditions }, select: { targetType: true, targetId: true } }) : [];
  const recycledKeys = new Set(recycledRecords.map((row) => `${row.targetType}:${row.targetId}`));
  const deletionBlockers = reportDeleteBlockers(report.status, { externalReferences: itemReferences + reportSourceReferences });
  return <AppShell><div className="space-y-6">
    <PageHeader eyebrow={`${report.project.name} · ${report.researchPlan?.code ?? "Project scope"}`} title={report.title} description="Editable synthesis with a separately maintained, version-aware source snapshot." actions={<><Link href={`/reports/${report.id}/edit`} className={primaryButton}>Edit Report</Link><Link href={`/api/reports/${report.id}/markdown`} className={secondaryButton}>Export Markdown</Link><RecordLifecycleControl id={report.id} identifier={report.title} title="Report record" recordLabel="Report" recordLabelZh="报告" blockers={deletionBlockers} archived={report.status === "archived"} deleteAction={deleteReport} archiveAction={archiveReport} editHref={`/reports/${report.id}/edit`} /></>} />
    {recycledRecords.length ? <RecycleBinWarning label="source record" labelZh="来源记录" /> : null}
    <Card><CardHeader title="Report control" eyebrow="Status and source coverage" action={<StatusPill status={report.status} />} /><CardBody className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <Control label="Scope">{report.researchPlan ? <Link href={`/research-plans/${report.researchPlan.id}`} className="text-moss hover:underline">{report.researchPlan.code ?? report.researchPlan.title}</Link> : "Entire Project"}</Control>
      <Control label="Plans">{counts.researchPlans ?? 0}</Control><Control label="Protocol versions">{counts.protocolVersions ?? 0}</Control><Control label="Experiments">{counts.experiments ?? 0}</Control><Control label="Results">{counts.results ?? 0}</Control><Control label="Entries">{counts.entries ?? 0}</Control>
      <div className="sm:col-span-2 xl:col-span-6 flex flex-wrap items-center gap-2 border-t border-hairline pt-3">{report.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}<span className="text-xs text-muted">Source snapshot {generatedAt && !Number.isNaN(generatedAt.valueOf()) ? generatedAt.toLocaleString() : "not dated"}</span><form action={refreshReportSources} className="ml-auto"><input type="hidden" name="id" value={report.id} /><button className="text-xs font-semibold text-moss hover:underline">Refresh source index</button></form></div>
    </CardBody></Card>
    <ScientificDocumentView document={document} title={report.title} subtitle={`${report.project.name}${report.researchPlan ? ` · ${report.researchPlan.title}` : " · Entire Project"}`} />
    <Card><CardHeader title="Source index" eyebrow="Titles and versions frozen at inclusion" /><CardBody><DataTable rows={report.sources} getRowKey={(row) => row.id} columns={[
      { key: "type", header: "Type", render: (row) => <Badge>{row.sourceType.replaceAll("_", " ")}</Badge> },
      { key: "source", header: "Source", render: (row) => {
        const targetType = row.sourceType === "protocol_version" ? "protocol" : row.sourceType;
        const targetId = row.sourceType === "protocol_version" ? protocolIdByVersionId.get(row.sourceId) : row.sourceId;
        const recycled = targetId ? recycledKeys.has(`${targetType}:${targetId}`) : false;
        return <div className="flex flex-wrap items-center gap-2">{row.hrefSnapshot ? <Link href={row.hrefSnapshot} className="font-semibold text-moss hover:underline">{row.titleSnapshot}</Link> : <span className="font-semibold text-ink">{row.titleSnapshot}</span>}{recycled ? <Badge tone="warning">In Recycle Bin</Badge> : null}</div>;
      } },
      { key: "version", header: "Version / status", render: (row) => row.versionSnapshot ?? "—" },
      { key: "included", header: "Included", render: (row) => row.includedAt.toLocaleDateString() },
    ]} /></CardBody></Card>
    <Card><CardHeader title="Attachments" eyebrow="Rendered exports and supporting documents" /><CardBody className="space-y-4"><AttachmentUploadForm targetType="report" targetId={report.id} hideTargetFields />{attachmentLinks.length ? <ul className="space-y-2 border-t border-hairline pt-4">{attachmentLinks.map((link) => <li key={link.id}><Link href={`/api/attachments/${link.attachment.id}`} className="text-sm font-medium text-moss hover:underline">{link.attachment.originalFilename}</Link></li>)}</ul> : null}</CardBody></Card>
  </div></AppShell>;
}
function Control({ label, children }: { label: string; children: React.ReactNode }) { return <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p><div className="mt-2 text-sm font-medium text-ink">{children}</div></div>; }
