import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CollectionExportMenu } from "@/components/CollectionExportMenu";
import { CollectionToolbar, collectionPrimaryActionClass, collectionSecondaryActionClass } from "@/components/CollectionToolbar";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { filterHref, firstOptionSearchParam, firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { reportStatusOptions } from "@/lib/status-options";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const query = firstSearchParam(params, "q")?.trim();
  const projectId = firstSearchParam(params, "project");
  const status = firstOptionSearchParam(params, "status", reportStatusOptions);
  const sort = firstSearchParam(params, "sort") ?? "updated_desc";
  const orderBy = sort === "title_asc" ? { title: "asc" as const } : { updatedAt: "desc" as const };
  const [reports, totalCount, projects] = await Promise.all([
    prisma.report.findMany({ where: { ...(projectId ? { projectId } : {}), ...(status ? { status } : {}), ...(query ? { OR: [{ title: { contains: query, mode: "insensitive" as const } }, { project: { name: { contains: query, mode: "insensitive" as const } } }] } : {}) }, include: { project: true, researchPlan: true, _count: { select: { sources: true } } }, orderBy }),
    prisma.report.count(),
    prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const exportHref = filterHref("/reports/export", { exportScope: "filtered", q: query, project: projectId, status, sort });
  return <AppShell><div className="space-y-4">
    <PageHeader title="Reports" />
    <CollectionToolbar path="/reports" query={query} searchPlaceholder="Search reports and projects…" resultCount={reports.length} totalCount={totalCount} sort={sort} defaultSort="updated_desc"
      filters={[
        { name: "project", label: "projects", value: projectId, options: projects.map((project) => ({ value: project.id, label: project.name })) },
        { name: "status", label: "status", value: status, options: reportStatusOptions },
      ]}
      sortOptions={[{ value: "updated_desc", label: "Recently updated" }, { value: "title_asc", label: "Title A–Z" }]}
      actions={<><Link href="/reports/import" className={collectionSecondaryActionClass}><Upload className="h-4 w-4" aria-hidden />Import</Link><CollectionExportMenu filteredHref={exportHref} exportPath="/reports/export" /><Link href="/reports/new" className={collectionPrimaryActionClass}><Plus className="h-4 w-4" aria-hidden />New Report</Link></>}
    />
    <DataTable rows={reports} getRowKey={(row) => row.id} emptyMessage="No Reports match this view." selection={{ exportPath: "/reports/export" }} columns={[
      { key: "report", header: "Report", render: (row) => <div><Link href={`/reports/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.title}</Link><p className="mt-1 text-xs text-muted">Updated {row.updatedAt.toLocaleDateString()}</p></div> },
      { key: "scope", header: "Scope", render: (row) => <div><Link href={`/projects/${row.project.id}`} className="text-moss hover:underline">{row.project.name}</Link><p className="text-xs text-muted">{row.researchPlan?.code ?? row.researchPlan?.title ?? "Entire Project"}</p></div> },
      { key: "sources", header: "Sources", render: (row) => row._count.sources },
      { key: "period", header: "Period", render: (row) => row.periodStart || row.periodEnd ? `${row.periodStart?.toLocaleDateString() ?? "…"} – ${row.periodEnd?.toLocaleDateString() ?? "…"}` : "All records" },
      { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
    ]} />
  </div></AppShell>;
}
