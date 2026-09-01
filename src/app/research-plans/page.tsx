import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CollectionExportMenu } from "@/components/CollectionExportMenu";
import { CollectionToolbar, collectionPrimaryActionClass, collectionSecondaryActionClass } from "@/components/CollectionToolbar";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolIdentity } from "@/components/ProtocolIdentity";
import { StatusPill } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { filterHref, firstOptionSearchParam, firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { normalizeResearchPlanSort, researchPlanOrderBy, researchPlanSortOptions } from "@/lib/research-plan-sorting";
import { researchPlanStatusOptions } from "@/lib/status-options";

export const dynamic = "force-dynamic";

export default async function ResearchPlansPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const query = firstSearchParam(params, "q")?.trim();
  const projectId = firstSearchParam(params, "project");
  const status = firstOptionSearchParam(params, "status", researchPlanStatusOptions);
  const sort = normalizeResearchPlanSort(firstSearchParam(params, "sort"));
  const orderBy = researchPlanOrderBy(sort);
  const recycledIds = (await prisma.deletedRecord.findMany({ where: { targetType: "research_plan", restoredAt: null }, select: { targetId: true } })).map((row) => row.targetId);
  const where = {
    id: { notIn: recycledIds },
    ...(projectId ? { projectId } : {}),
    ...(status ? { status } : {}),
    ...(query ? { OR: [
      { code: { contains: query, mode: "insensitive" as const } },
      { title: { contains: query, mode: "insensitive" as const } },
      { objective: { contains: query, mode: "insensitive" as const } },
    ] } : {}),
  };
  const [plans, totalCount, projects] = await Promise.all([
    prisma.researchPlan.findMany({ where, include: { project: true, protocols: { include: { protocol: true } }, _count: { select: { entries: true, experiments: true } } }, orderBy }),
    prisma.researchPlan.count({ where: { id: { notIn: recycledIds } } }),
    prisma.project.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const exportHref = filterHref("/research-plans/export", { exportScope: "filtered", q: query, project: projectId, status, sort });

  return (
    <AppShell><div className="space-y-4">
      <PageHeader title="Research Plans" />
      <CollectionToolbar
        path="/research-plans"
        query={query}
        searchPlaceholder="Search plans, codes, objectives…"
        resultCount={plans.length}
        totalCount={totalCount}
        sort={sort}
        defaultSort="updated_desc"
        filters={[
          { name: "project", label: "projects", value: projectId, options: projects.map((project) => ({ value: project.id, label: project.name })) },
          { name: "status", label: "status", value: status, options: researchPlanStatusOptions },
        ]}
        sortOptions={[...researchPlanSortOptions]}
        actions={<>
          <Link href="/research-plans/import" className={collectionSecondaryActionClass}><Upload className="h-4 w-4" aria-hidden />Import</Link>
          <CollectionExportMenu filteredHref={exportHref} exportPath="/research-plans/export" />
          <Link href="/research-plans/new" className={collectionPrimaryActionClass}><Plus className="h-4 w-4" aria-hidden />New Research Plan</Link>
        </>}
      />
      <DataTable rows={plans} getRowKey={(row) => row.id} emptyMessage="No Research Plans match this view." selection={{ exportPath: "/research-plans/export" }} columns={[
        { key: "plan", header: "Research Plan", render: (row) => <div><div className="flex items-center gap-2">{row.code ? <span className="font-mono text-xs text-muted">{row.code}</span> : null}<Link href={`/research-plans/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.title}</Link></div><p className="mt-1 max-w-xl text-xs leading-5 text-muted">{row.objective ?? "Objective not recorded."}</p></div> },
        { key: "project", header: "Project", render: (row) => <Link href={`/projects/${row.projectId}`} className="text-moss hover:underline">{row.project.name}</Link> },
        { key: "protocols", header: "Protocols", render: (row) => <div className="grid max-w-sm gap-1">{row.protocols.length ? row.protocols.map(({ protocol, isPrimary }) => <div key={protocol.id} className={`rounded-[var(--ln-radius-control-sm)] px-2 py-1 ${isPrimary ? "bg-sage-surface" : "bg-stone"}`}><ProtocolIdentity compact title={protocol.canonicalTitle ?? protocol.title} code={protocol.humanCode} /></div>) : <span className="text-muted">None linked</span>}</div> },
        { key: "records", header: "Records", render: (row) => `${row._count.experiments} experiments · ${row._count.entries} entries` },
        { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} href={filterHref("/research-plans", { status: row.status })} /> },
      ]} />
    </div></AppShell>
  );
}
