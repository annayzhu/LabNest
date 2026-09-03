import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ControlKeyInformationForm } from "@/components/ControlKeyInformationForm";
import { PageHeader } from "@/components/PageHeader";
import { DocumentPrintButton } from "@/components/DocumentPrintButton";
import { ProtocolIdentity } from "@/components/ProtocolIdentity";
import { RecordLifecycleControl } from "@/components/RecordLifecycleControl";
import { RecycleBinWarning } from "@/components/RecycleBinWarning";
import { ResearchPlanPremiseView } from "@/components/ResearchPlanPremiseView";
import { ScientificDocumentView } from "@/components/ScientificDocumentView";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { normalizeResearchPlanDocument } from "@/lib/scientific-document";
import { researchPlanDeleteBlockerItems } from "@/lib/record-lifecycle";
import { archiveResearchPlan, deleteResearchPlan, updateResearchPlanKeyInformation } from "../actions";

export const dynamic = "force-dynamic";
const primaryButton = buttonStyles({ variant: "primary", size: "md" });
const secondaryButton = buttonStyles({ size: "md", className: "bg-surface font-medium text-moss hover:bg-warm" });

export default async function ResearchPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await prisma.researchPlan.findUnique({
    where: { id },
    include: {
      project: true,
      protocols: { orderBy: { isPrimary: "desc" }, include: { protocol: { include: { versions: { orderBy: { revision: "desc" }, take: 1 } } } } },
      experiments: { orderBy: { date: "desc" }, include: { primaryProtocolVersion: { include: { protocol: true } }, _count: { select: { results: true } } } },
      results: { orderBy: { updatedAt: "desc" }, take: 20 },
      reports: { orderBy: { updatedAt: "desc" } },
      _count: { select: { entries: true, experiments: true, results: true, reports: true } },
    },
  });
  if (!plan) notFound();
  const recycleTargets = [
    { targetType: "research_plan", targetId: plan.id },
    ...plan.protocols.map((row) => ({ targetType: "protocol", targetId: row.protocolId })),
    ...plan.results.map((row) => ({ targetType: "result", targetId: row.id })),
  ];
  const [reportSourceReferences, recycledRecords] = await Promise.all([
    prisma.reportSource.count({ where: { sourceType: "research_plan", sourceId: plan.id } }),
    prisma.deletedRecord.findMany({ where: { restoredAt: null, OR: recycleTargets }, select: { targetType: true, targetId: true } }),
  ]);
  const recycledKeys = new Set(recycledRecords.map((row) => `${row.targetType}:${row.targetId}`));
  const deletionBlockers = researchPlanDeleteBlockerItems(plan.status, { ...plan._count, reportSourceReferences });
  const document = normalizeResearchPlanDocument(plan.contentJson, plan.design);
  return (
    <AppShell><div className="space-y-6">
      <PageHeader identifier={plan.code ?? undefined} eyebrow={plan.project.name} title={plan.title} actions={<><DocumentPrintButton showLabel />{recycledKeys.has(`research_plan:${plan.id}`) ? <Link href="/trash" className={primaryButton}>Restore from Recycle Bin</Link> : <><Link href={`/experiments/new?plan=${plan.id}`} className={primaryButton}>New Experiment</Link><Link href={`/research-plans/${plan.id}/edit`} className={secondaryButton}>Edit plan</Link><RecordLifecycleControl id={plan.id} identifier={plan.code} title={plan.title} recordLabel="Research Plan" recordLabelZh="研究方案" blockers={deletionBlockers} archived={plan.status === "archived"} deleteAction={deleteResearchPlan} archiveAction={archiveResearchPlan} editHref={`/research-plans/${plan.id}/edit`} allowLinkedRecycle /></>}</>} />
      {recycledKeys.has(`research_plan:${plan.id}`) ? <RecycleBinWarning kind="self" label="Research Plan" labelZh="研究方案" /> : null}
      {recycledRecords.some((row) => row.targetType !== "research_plan") ? <RecycleBinWarning label="record" labelZh="记录" /> : null}
      <div className="document-preview-layout">
        <div className="document-preview-main space-y-5">
          <ScientificDocumentView document={document} showEmptySections title={plan.title} identifier={plan.code} subtitle={plan.project.name} leadingContent={<ResearchPlanPremiseView objective={plan.objective} hypothesis={plan.hypothesis} rationale={plan.rationale} />} />
          {plan.results.length ? <Card><CardHeader title="Recent Results" eyebrow="Evidence produced by this plan" /><CardBody><DataTable rows={plan.results} getRowKey={(row) => row.id} columns={[
            { key: "result", header: "Result", render: (row) => <div className="flex flex-wrap items-center gap-2"><Link href={`/results/${row.id}`} className="font-semibold text-moss hover:underline">{row.title}</Link>{recycledKeys.has(`result:${row.id}`) ? <Badge tone="warning">In Recycle Bin</Badge> : null}</div> },
            { key: "type", header: "Type", render: (row) => row.resultType },
            { key: "quality", header: "QC", render: (row) => <StatusPill status={row.qualityStatus} /> },
            { key: "record", header: "Record", render: (row) => <StatusPill status={row.recordStatus} /> },
          ]} /></CardBody></Card> : null}
        </div>
        <aside className="document-preview-sidebar">
          <Card><CardHeader title="Plan control" eyebrow="Compact source map" action={<StatusPill status={plan.status} />} /><CardBody className="space-y-4">
            <Control label="Project"><Link href={`/projects/${plan.projectId}`} className="text-moss hover:underline">{plan.project.name}</Link></Control>
            {!recycledKeys.has(`research_plan:${plan.id}`) ? <ControlKeyInformationForm id={plan.id} initialValue={plan.keyInformation} scope="research_plan" action={updateResearchPlanKeyInformation} /> : null}
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-hairline pt-4">
              <Control label="Protocols">{plan.protocols.length}</Control><Control label="Experiments">{plan._count.experiments}</Control><Control label="Results">{plan._count.results}</Control><Control label="Entries">{plan._count.entries}</Control><Control label="Reports">{plan._count.reports}</Control>
            </div>
            {plan.tags.length ? <div className="flex flex-wrap gap-2 border-t border-hairline pt-4">{plan.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div> : null}
          </CardBody></Card>
          <Card><CardHeader title="Associated Protocols" eyebrow="Reusable methods" /><CardBody><DataTable rows={plan.protocols} getRowKey={(row) => row.protocolId} emptyMessage="No protocols are associated with this plan." columns={[
            { key: "protocol", header: "Protocol", render: (row) => <div><div className="flex items-start gap-2"><Link href={`/protocols/${row.protocolId}`} className="min-w-0 flex-1 text-moss hover:underline"><ProtocolIdentity compact title={row.protocol.canonicalTitle ?? row.protocol.title} code={row.protocol.humanCode} version={row.protocol.versions[0]?.displayVersion} meta={row.protocol.scope} /></Link>{recycledKeys.has(`protocol:${row.protocolId}`) ? <Badge tone="warning">In Recycle Bin</Badge> : null}</div></div> },
            { key: "role", header: "Role", render: (row) => row.isPrimary ? <Badge tone="sage">primary</Badge> : <Badge>supporting</Badge> },
          ]} /></CardBody></Card>
          <Card><CardHeader title="Experiments" eyebrow="Repeated executions" action={<Link href={`/experiments/new?plan=${plan.id}`} className="text-sm font-medium text-moss hover:underline">Create</Link>} /><CardBody><DataTable rows={plan.experiments} getRowKey={(row) => row.id} emptyMessage="No experiments have been created for this plan." columns={[
            { key: "experiment", header: "Experiment", render: (row) => <div><Link href={`/experiments/${row.id}`} className="font-semibold text-moss hover:underline">{row.runCode ? `${row.runCode} · ` : ""}{row.title}</Link>{row.primaryProtocolVersion ? <ProtocolIdentity className="mt-1" compact title={row.primaryProtocolVersion.protocol.canonicalTitle ?? row.primaryProtocolVersion.protocol.title} code={row.primaryProtocolVersion.protocol.humanCode} version={row.primaryProtocolVersion.displayVersion} /> : <p className="mt-1 text-xs text-muted">No primary ProtocolVersion</p>}<p className="mt-1 font-mono text-xs text-muted">{row.date.toLocaleDateString()} · {row._count.results} results</p></div> },
            { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
          ]} /></CardBody></Card>
        </aside>
      </div>
    </div></AppShell>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) { return <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p><div className="mt-2 text-sm font-medium text-ink">{children}</div></div>; }
