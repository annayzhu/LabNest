import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Plus, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { collectionPrimaryActionClass, collectionSecondaryActionClass } from "@/components/CollectionToolbar";
import { ControlKeyInformationForm } from "@/components/ControlKeyInformationForm";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolIdentity } from "@/components/ProtocolIdentity";
import { RecordLifecycleControl } from "@/components/RecordLifecycleControl";
import { ResearchPlanSortControl } from "@/components/ResearchPlanSortControl";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { filterHref, firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { projectDeleteBlockers } from "@/lib/record-lifecycle";
import { normalizeResearchPlanSort, researchPlanOrderBy } from "@/lib/research-plan-sorting";
import { archiveProject, deleteProject, updateProjectKeyInformation } from "../actions";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: PageSearchParams }) {
  const { id } = await params;
  const query = searchParams ? await searchParams : undefined;
  const planSort = normalizeResearchPlanSort(firstSearchParam(query, "planSort"));
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      researchPlans: { orderBy: researchPlanOrderBy(planSort), include: { _count: { select: { experiments: true, results: true } } } },
      protocols: { orderBy: { updatedAt: "desc" }, include: { versions: { orderBy: { revision: "desc" }, take: 1 } } },
      protocolAssociations: { orderBy: { createdAt: "desc" }, include: { protocol: { include: { versions: { orderBy: { revision: "desc" }, take: 1 } } } } },
      reports: { orderBy: { updatedAt: "desc" } },
      _count: { select: { researchPlans: true, protocols: true, experiments: true, results: true, reports: true, entries: true, entities: true, procurementInquiries: true } },
    },
  });
  if (!project) notFound();
  const projectProtocols = Array.from(new Map([
    ...project.protocols.map((protocol) => [protocol.id, protocol] as const),
    ...project.protocolAssociations.map((link) => [link.protocol.id, link.protocol] as const),
  ]).values());
  const genericReferences = await prisma.itemLink.count({ where: { OR: [{ sourceType: "project", sourceId: project.id }, { targetType: "project", targetId: project.id }] } });
  const deletionBlockers = projectDeleteBlockers({ ...project._count, genericReferences });
  const researchPlanExportHref = filterHref("/research-plans/export", {
    exportScope: "filtered",
    project: project.id,
    sort: planSort,
  });

  return (
    <AppShell><div className="space-y-5">
      <PageHeader title={project.name} actions={<><Link href={`/projects/${project.id}/edit`} className="focus-ring inline-flex h-10 items-center rounded-[8px] border border-hairline bg-surface px-4 text-sm font-medium text-moss hover:bg-warm">Edit Project</Link><RecordLifecycleControl id={project.id} identifier={project.name} title="Project record" recordLabel="Project" recordLabelZh="项目" blockers={deletionBlockers} archived={project.status === "archived"} deleteAction={deleteProject} archiveAction={archiveProject} editHref={`/projects/${project.id}/edit`} /></>} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="order-2 min-w-0 space-y-5 xl:order-1">
          <Card><CardHeader title="Research Plans" action={<div className="flex flex-wrap items-center justify-end gap-2">
            <ResearchPlanSortControl path={`/projects/${project.id}`} value={planSort} />
            <Link href="/research-plans/import" className={collectionSecondaryActionClass}><Upload className="h-4 w-4" aria-hidden />Import</Link>
            <Link href={researchPlanExportHref} className={collectionSecondaryActionClass}><Download className="h-4 w-4" aria-hidden />Export</Link>
            <Link href={`/research-plans/new?project=${project.id}`} className={collectionPrimaryActionClass}><Plus className="h-4 w-4" aria-hidden />New Research Plan</Link>
          </div>} /><CardBody><DataTable rows={project.researchPlans} getRowKey={(row) => row.id} emptyMessage="No Research Plans in this Project." columns={[
            { key: "plan", header: "Research Plan", render: (row) => <Link href={`/research-plans/${row.id}`} className="font-semibold text-moss hover:underline">{row.code ? `${row.code} · ` : ""}{row.title}</Link> },
            { key: "experiments", header: "Experiments", render: (row) => row._count.experiments },
            { key: "results", header: "Results", render: (row) => row._count.results },
            { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
          ]} /></CardBody></Card>
          {projectProtocols.length ? <Card><CardHeader title="Project-associated Protocols" /><CardBody><DataTable rows={projectProtocols} getRowKey={(row) => row.id} columns={[
            { key: "protocol", header: "Protocol", render: (row) => <Link href={`/protocols/${row.id}`} className="block text-moss hover:underline"><ProtocolIdentity title={row.canonicalTitle ?? row.title} code={row.humanCode} /></Link> },
            { key: "version", header: "Current version", render: (row) => row.versions[0]?.displayVersion ?? "—" },
            { key: "availability", header: "Availability", render: (row) => <StatusPill status={row.availability} /> },
          ]} /></CardBody></Card> : null}
        </div>
        <aside className="order-1 xl:sticky xl:top-5 xl:order-2">
          <Card><CardHeader title="Project control" action={<StatusPill status={project.status} />} /><CardBody className="space-y-4">
            <p className="whitespace-pre-wrap text-sm leading-6 text-graphite">{project.description ?? "No description recorded."}</p>
            <div className="flex flex-wrap gap-2">{project.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div>
            <ControlKeyInformationForm id={project.id} initialValue={project.keyInformation} scope="project" action={updateProjectKeyInformation} />
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-hairline pt-4">
              {[['Research Plans', project._count.researchPlans], ['Experiments', project._count.experiments], ['Results', project._count.results], ['Reports', project._count.reports], ['Entries', project._count.entries]].map(([label, value]) => <div key={String(label)}><p className="text-xs text-muted">{label}</p><p className="mt-1 font-mono text-lg text-ink">{value}</p></div>)}
            </div>
          </CardBody></Card>
        </aside>
      </div>
    </div></AppShell>
  );
}
