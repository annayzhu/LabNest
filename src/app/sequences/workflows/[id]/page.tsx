import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { sequenceWorkflowLabel } from "@/lib/sequence-entry";

export const dynamic = "force-dynamic";

export default async function SequenceWorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workflow = await prisma.sequenceWorkflow.findUnique({ where: { id }, include: { project: true, inputs: { include: { sequenceVersion: { include: { sequenceRecord: true } } }, orderBy: { order: "asc" } } } });
  if (!workflow) notFound();
  return <AppShell><div className="space-y-4"><PageHeader title={workflow.name} actions={<Link href="/sequences/workflows" className={buttonStyles({ variant: "secondary", size: "sm" })}><ArrowLeft className="h-4 w-4" aria-hidden />Workflows</Link>} /><Card><CardBody className="flex flex-wrap items-center gap-4 py-3"><Badge tone="sage">{sequenceWorkflowLabel(workflow.type)}</Badge><StatusPill status={workflow.status} /><span className="text-sm text-graphite">{workflow.project.name}</span><span className="text-sm text-graphite">Method: {workflow.method.replaceAll("_", " ")}</span><span className="ml-auto font-mono text-[10px] text-muted">{workflow.code}</span></CardBody></Card>{workflow.reference || workflow.pam || workflow.description ? <Card><CardHeader title="Design context" /><CardBody className="grid gap-3 sm:grid-cols-2"><Field label="Reference / source" value={workflow.reference} /><Field label="PAM" value={workflow.pam} />{workflow.description ? <div className="sm:col-span-2"><Field label="Description" value={workflow.description} /></div> : null}</CardBody></Card> : null}<Card><CardHeader title="Exact Sequence inputs" /><CardBody><DataTable rows={workflow.inputs} getRowKey={(row) => row.id} emptyMessage="No Sequence inputs were attached." columns={[
    { key: "sequence", header: "Sequence", render: (row) => <Link href={`/sequences/${row.sequenceVersion.sequenceRecord.id}`} className="font-semibold text-ink hover:text-moss">{row.sequenceVersion.sequenceRecord.name}</Link> },
    { key: "version", header: "Version", render: (row) => <span className="font-mono text-xs">v{row.sequenceVersion.displayVersion}</span> },
    { key: "molecule", header: "Molecule", render: (row) => `${row.sequenceVersion.moleculeType} · ${row.sequenceVersion.sequence.length}` },
    { key: "role", header: "Role", render: (row) => row.role },
  ]} /></CardBody></Card>{workflow.type === "crispr" ? <p className="rounded-[8px] border border-hairline bg-warm/50 px-3 py-2 text-xs leading-5 text-muted">LabNest records manual or external CRISPR designs with provenance. No on-target or off-target score is calculated unless a validated scoring engine and reference version are explicitly connected.</p> : null}</div></AppShell>;
}

function Field({ label, value }: { label: string; value: string | null }) {
  return <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm text-ink">{value || "—"}</p></div>;
}
