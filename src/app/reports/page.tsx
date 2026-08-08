import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function ReportsPage() {
  const reports = await prisma.report.findMany({ include: { project: true, researchPlan: true, _count: { select: { sources: true } } }, orderBy: { updatedAt: "desc" } });
  return <AppShell><div className="space-y-6"><PageHeader eyebrow="Traceable synthesis" title="Reports" description="Reports are editable documents with a separate, refreshable source snapshot covering plans, exact ProtocolVersions, Experiments, Results and Entries." actions={<Link href="/reports/new" className="focus-ring inline-flex h-10 items-center rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm">New Report</Link>} />
    <Card><CardHeader title="Report index" eyebrow="Small status surface, complete source trail" /><CardBody>{reports.length ? <DataTable rows={reports} getRowKey={(row) => row.id} columns={[
      { key: "report", header: "Report", render: (row) => <div><Link href={`/reports/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.title}</Link><p className="mt-1 text-xs text-muted">Updated {row.updatedAt.toLocaleDateString()}</p></div> },
      { key: "scope", header: "Scope", render: (row) => <div>{row.project.name}<p className="text-xs text-muted">{row.researchPlan?.code ?? row.researchPlan?.title ?? "Entire Project"}</p></div> },
      { key: "sources", header: "Sources", render: (row) => row._count.sources },
      { key: "period", header: "Period", render: (row) => row.periodStart || row.periodEnd ? `${row.periodStart?.toLocaleDateString() ?? "…"} – ${row.periodEnd?.toLocaleDateString() ?? "…"}` : "All records" },
      { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
    ]} /> : <div className="rounded-[10px] border border-dashed border-hairline bg-warm px-6 py-10 text-center"><h3 className="font-serif text-xl text-ink">No Reports yet</h3><p className="mt-2 text-sm text-muted">Create a traceable draft from a Project or Research Plan.</p></div>}</CardBody></Card>
  </div></AppShell>;
}
