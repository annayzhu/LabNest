import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { sequenceWorkflowLabel } from "@/lib/sequence-entry";

export const dynamic = "force-dynamic";

export default async function SequenceWorkflowsPage() {
  const workflows = await prisma.sequenceWorkflow.findMany({ include: { project: { select: { name: true } }, _count: { select: { inputs: true } } }, orderBy: { updatedAt: "desc" } });
  return <AppShell><div className="space-y-4"><PageHeader title="Sequence workflows" actions={<Link href="/sequences/workflows/new" className={buttonStyles({ variant: "primary", size: "sm" })}><Plus className="h-4 w-4" aria-hidden />New workflow</Link>} /><DataTable rows={workflows} getRowKey={(row) => row.id} emptyMessage="No Sequence workflows yet." columns={[
    { key: "name", header: "Workflow", render: (row) => <div><Link href={`/sequences/workflows/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.name}</Link><p className="font-mono text-[10px] text-muted">{row.code}</p></div> },
    { key: "type", header: "Type", render: (row) => <Badge tone="sage">{sequenceWorkflowLabel(row.type)}</Badge> },
    { key: "method", header: "Method", render: (row) => row.method.replaceAll("_", " ") },
    { key: "project", header: "Project", render: (row) => row.project.name },
    { key: "inputs", header: "Inputs", render: (row) => `${row._count.inputs} exact version${row._count.inputs === 1 ? "" : "s"}` },
    { key: "status", header: "Lifecycle", render: (row) => <StatusPill status={row.status} /> },
  ]} /></div></AppShell>;
}
