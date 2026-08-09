import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ScientificDocumentView } from "@/components/ScientificDocumentView";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { normalizeResearchPlanDocument } from "@/lib/scientific-document";

export const dynamic = "force-dynamic";
const primaryButton = "focus-ring inline-flex h-10 items-center justify-center rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm";
const secondaryButton = "focus-ring inline-flex h-10 items-center justify-center rounded-[8px] border border-hairline bg-surface px-4 text-sm font-medium text-moss hover:bg-warm";

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
  const document = normalizeResearchPlanDocument(plan.contentJson, plan.design);
  const scientificPremise = [
    ["Objective", plan.objective],
    ["Hypothesis", plan.hypothesis],
    ["Rationale", plan.rationale],
  ] as const;
  return (
    <AppShell><div className="space-y-6">
      <PageHeader identifier={plan.code ?? undefined} eyebrow={plan.project.name} title={plan.title} actions={<><Link href={`/experiments/new?plan=${plan.id}`} className={primaryButton}>New Experiment</Link><Link href={`/research-plans/${plan.id}/edit`} className={secondaryButton}>Edit plan</Link></>} />
      <Card><CardHeader title="Plan control" eyebrow="Compact source map" action={<StatusPill status={plan.status} />} /><CardBody className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Control label="Project"><Link href={`/projects?project=${plan.projectId}`} className="text-moss hover:underline">{plan.project.name}</Link></Control>
        <Control label="Protocols">{plan.protocols.length}</Control><Control label="Experiments">{plan._count.experiments}</Control><Control label="Results">{plan._count.results}</Control><Control label="Entries">{plan._count.entries}</Control><Control label="Reports">{plan._count.reports}</Control>
        <div className="sm:col-span-2 xl:col-span-6 flex flex-wrap gap-2 border-t border-hairline pt-3">{plan.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div>
      </CardBody></Card>
      <Card><CardHeader title="Scientific premise" eyebrow="Template-aligned sections" /><CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{scientificPremise.map(([label, value]) => <ContentField key={label} label={label} value={value} compact />)}</CardBody></Card>
      <ScientificDocumentView document={document} showEmptySections />
      <Card><CardHeader title="Associated Protocols" eyebrow="Reusable methods; Experiments lock exact versions" /><CardBody><DataTable rows={plan.protocols} getRowKey={(row) => row.protocolId} columns={[
        { key: "protocol", header: "Protocol", render: (row) => <Link href={`/protocols/${row.protocolId}`} className="font-semibold text-moss hover:underline">{row.protocol.humanCode ?? row.protocol.title}</Link> },
        { key: "scope", header: "Scope", render: (row) => <Badge tone={row.protocol.scope === "project" ? "sage" : "info"}>{row.protocol.scope}</Badge> },
        { key: "version", header: "Latest", render: (row) => row.protocol.versions[0]?.displayVersion ?? "—" },
        { key: "role", header: "Role", render: (row) => row.isPrimary ? <Badge tone="sage">primary</Badge> : <Badge>supporting</Badge> },
      ]} /></CardBody></Card>
      <Card><CardHeader title="Experiments" eyebrow="Repeated executions" action={<Link href={`/experiments/new?plan=${plan.id}`} className="text-sm font-medium text-moss hover:underline">Create experiment</Link>} /><CardBody><DataTable rows={plan.experiments} getRowKey={(row) => row.id} columns={[
        { key: "experiment", header: "Experiment", render: (row) => <Link href={`/experiments/${row.id}`} className="font-semibold text-moss hover:underline">{row.runCode ? `${row.runCode} · ` : ""}{row.title}</Link> },
        { key: "protocol", header: "Primary ProtocolVersion", render: (row) => row.primaryProtocolVersion ? `${row.primaryProtocolVersion.protocol.humanCode ?? row.primaryProtocolVersion.protocol.title} · ${row.primaryProtocolVersion.displayVersion}` : "—" },
        { key: "results", header: "Results", render: (row) => row._count.results },
        { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
        { key: "date", header: "Date", render: (row) => row.date.toLocaleDateString() },
      ]} /></CardBody></Card>
      {plan.results.length ? <Card><CardHeader title="Recent Results" eyebrow="Evidence produced by this plan" /><CardBody><DataTable rows={plan.results} getRowKey={(row) => row.id} columns={[
        { key: "result", header: "Result", render: (row) => <Link href={`/results/${row.id}`} className="font-semibold text-moss hover:underline">{row.title}</Link> },
        { key: "type", header: "Type", render: (row) => row.resultType },
        { key: "quality", header: "QC", render: (row) => <StatusPill status={row.qualityStatus} /> },
        { key: "record", header: "Record", render: (row) => <StatusPill status={row.recordStatus} /> },
      ]} /></CardBody></Card> : null}
    </div></AppShell>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) { return <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p><div className="mt-2 text-sm font-medium text-ink">{children}</div></div>; }
function ContentField({ label, value, compact = false }: { label?: string; value?: string | null; compact?: boolean }) {
  return <section className={compact ? "rounded-[9px] border border-hairline bg-warm/70 p-4" : undefined}>{label ? <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</h3> : null}<p className={`${label ? "mt-2 " : ""}whitespace-pre-wrap text-sm leading-7 ${value ? "text-graphite" : "text-muted"}`}>{value || "Not recorded."}</p></section>;
}
