import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Plus, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { collectionPrimaryActionClass, collectionSecondaryActionClass } from "@/components/CollectionToolbar";
import { PageHeader } from "@/components/PageHeader";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { filterHref } from "@/lib/filters";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      researchPlans: { orderBy: { updatedAt: "desc" }, include: { _count: { select: { experiments: true, results: true } } } },
      protocols: { orderBy: { updatedAt: "desc" }, include: { versions: { orderBy: { revision: "desc" }, take: 1 } } },
      reports: { orderBy: { updatedAt: "desc" } },
      _count: { select: { researchPlans: true, experiments: true, results: true, reports: true, entries: true } },
    },
  });
  if (!project) notFound();
  const researchPlanExportHref = filterHref("/research-plans/export", {
    exportScope: "filtered",
    project: project.id,
  });

  return (
    <AppShell><div className="space-y-5">
      <PageHeader title={project.name} actions={<Link href={`/projects/${project.id}/edit`} className="focus-ring inline-flex h-9 items-center rounded-[7px] border border-hairline bg-surface px-3 text-[13px] font-medium text-moss hover:bg-warm">Edit Project</Link>} />
      <Card><CardHeader title="Project control" action={<StatusPill status={project.status} />} /><CardBody className="space-y-4">
        <p className="whitespace-pre-wrap text-sm leading-7 text-graphite">{project.description ?? "No description recorded."}</p>
        <div className="flex flex-wrap gap-2">{project.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div>
        <div className="grid gap-3 border-t border-hairline pt-4 sm:grid-cols-3 xl:grid-cols-5">
          {[['Research Plans', project._count.researchPlans], ['Experiments', project._count.experiments], ['Results', project._count.results], ['Reports', project._count.reports], ['Entries', project._count.entries]].map(([label, value]) => <div key={String(label)}><p className="text-xs text-muted">{label}</p><p className="mt-1 font-mono text-lg text-ink">{value}</p></div>)}
        </div>
      </CardBody></Card>
      <Card><CardHeader title="Research Plans" action={<div className="flex flex-wrap items-center justify-end gap-2">
        <Link href="/research-plans/import" className={collectionSecondaryActionClass}><Upload className="h-4 w-4" aria-hidden />Import</Link>
        <Link href={researchPlanExportHref} className={collectionSecondaryActionClass}><Download className="h-4 w-4" aria-hidden />Export</Link>
        <Link href={`/research-plans/new?project=${project.id}`} className={collectionPrimaryActionClass}><Plus className="h-4 w-4" aria-hidden />New Research Plan</Link>
      </div>} /><CardBody><DataTable rows={project.researchPlans} getRowKey={(row) => row.id} emptyMessage="No Research Plans in this Project." columns={[
        { key: "plan", header: "Research Plan", render: (row) => <Link href={`/research-plans/${row.id}`} className="font-semibold text-moss hover:underline">{row.code ? `${row.code} · ` : ""}{row.title}</Link> },
        { key: "experiments", header: "Experiments", render: (row) => row._count.experiments },
        { key: "results", header: "Results", render: (row) => row._count.results },
        { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
      ]} /></CardBody></Card>
      {project.protocols.length ? <Card><CardHeader title="Project Protocols" /><CardBody><DataTable rows={project.protocols} getRowKey={(row) => row.id} columns={[
        { key: "protocol", header: "Protocol", render: (row) => <Link href={`/protocols/${row.id}`} className="font-semibold text-moss hover:underline">{row.humanCode ?? row.canonicalTitle ?? row.title}</Link> },
        { key: "version", header: "Current version", render: (row) => row.versions[0]?.displayVersion ?? "—" },
        { key: "availability", header: "Availability", render: (row) => <StatusPill status={row.availability} /> },
      ]} /></CardBody></Card> : null}
    </div></AppShell>
  );
}
