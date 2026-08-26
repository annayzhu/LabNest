import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CollectionExportMenu } from "@/components/CollectionExportMenu";
import {
  CollectionToolbar,
  collectionPrimaryActionClass,
  collectionSecondaryActionClass,
} from "@/components/CollectionToolbar";
import { PageHeader } from "@/components/PageHeader";
import { BadgeLink, StatusPill } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { filterHref, firstOptionSearchParam, firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { projectStatusOptions } from "@/lib/status-options";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const query = firstSearchParam(params, "q")?.trim();
  const tag = firstSearchParam(params, "tag");
  const status = firstOptionSearchParam(params, "status", projectStatusOptions);
  const sort = firstSearchParam(params, "sort") ?? "updated_desc";
  const orderBy = sort === "name_asc" ? { name: "asc" as const }
    : sort === "status_asc" ? [{ status: "asc" as const }, { name: "asc" as const }]
      : { updatedAt: "desc" as const };
  const where = {
    ...(status ? { status } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(query ? { OR: [
      { name: { contains: query, mode: "insensitive" as const } },
      { description: { contains: query, mode: "insensitive" as const } },
    ] } : {}),
  };
  const [projects, totalCount, tagRows] = await Promise.all([
    prisma.project.findMany({ where, include: { _count: { select: { researchPlans: true, experiments: true, results: true } } }, orderBy }),
    prisma.project.count(),
    prisma.project.findMany({ select: { tags: true } }),
  ]);
  const tags = [...new Set(tagRows.flatMap((row) => row.tags))].sort();
  const exportHref = filterHref("/projects/export", { exportScope: "filtered", q: query, status, tag, sort });

  return (
    <AppShell><div className="space-y-4">
      <PageHeader title="Projects" />
      <CollectionToolbar
        path="/projects"
        query={query}
        searchPlaceholder="Search projects…"
        resultCount={projects.length}
        totalCount={totalCount}
        sort={sort}
        defaultSort="updated_desc"
        filters={[
          { name: "status", label: "status", value: status, options: projectStatusOptions },
          { name: "tag", label: "tags", value: tag, options: tags.map((value) => ({ value, label: value })) },
        ]}
        sortOptions={[
          { value: "updated_desc", label: "Recently updated" },
          { value: "name_asc", label: "Name A–Z" },
          { value: "status_asc", label: "Status" },
        ]}
        actions={<>
          <Link href="/projects/import" className={collectionSecondaryActionClass}><Upload className="h-4 w-4" aria-hidden />Import</Link>
          <CollectionExportMenu filteredHref={exportHref} exportPath="/projects/export" />
          <Link href="/projects/new" className={collectionPrimaryActionClass}><Plus className="h-4 w-4" aria-hidden />New Project</Link>
        </>}
      />
      <DataTable
        rows={projects}
        getRowKey={(row) => row.id}
        emptyMessage="No Projects match this view."
        selection={{ exportPath: "/projects/export" }}
        columns={[
          { key: "name", header: "Project", render: (row) => <div><Link href={`/projects/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.name}</Link><p className="mt-1 max-w-xl text-xs leading-5 text-muted">{row.description ?? "No description."}</p></div> },
          { key: "counts", header: "Connected work", render: (row) => <Link href={filterHref("/research-plans", { project: row.id })} className="text-moss hover:underline">{row._count.researchPlans} plans · {row._count.experiments} experiments · {row._count.results} results</Link> },
          { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} href={filterHref("/projects", { status: row.status })} /> },
          { key: "tags", header: "Tags", render: (row) => <div className="flex flex-wrap gap-1">{row.tags.map((item) => <BadgeLink key={item} href={filterHref("/projects", { tag: item })}>{item}</BadgeLink>)}</div> },
        ]}
      />
    </div></AppShell>
  );
}
