import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ActiveFilterBar, type ActiveFilter } from "@/components/ActiveFilterBar";
import { PageHeader } from "@/components/PageHeader";
import { BadgeLink, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { filterHref, firstSearchParam, type PageSearchParams } from "@/lib/filters";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const tag = firstSearchParam(params, "tag");
  const status = firstSearchParam(params, "status");
  const projects = await prisma.project.findMany({
    where: {
      ...(status ? { status: status as "active" | "paused" | "completed" | "archived" } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
    },
    include: {
      _count: { select: { researchPlans: true, experiments: true, results: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const activeFilters: ActiveFilter[] = [];
  if (tag) activeFilters.push({ label: "tag", value: tag });
  if (status) activeFilters.push({ label: "status", value: status });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Research context"
          title="Projects"
          description="A project defines the scientific objective and contains one or more research plans. Experiments belong to a plan, not directly to an undifferentiated project."
        />
        <Card>
          <CardHeader title="Project index" eyebrow="Database records" />
          <CardBody>
            <ActiveFilterBar filters={activeFilters} clearHref="/projects" resultCount={projects.length} totalCount={projects.length} />
            <DataTable
              rows={projects}
              getRowKey={(row) => row.id}
              className="mt-4"
              columns={[
                {
                  key: "name",
                  header: "Project",
                  render: (row) => (
                    <div>
                      <span className="font-semibold text-ink">{row.name}</span>
                      <p className="mt-1 max-w-xl text-xs leading-5 text-muted">{row.description ?? "No description."}</p>
                    </div>
                  ),
                },
                {
                  key: "counts",
                  header: "Connected work",
                  render: (row) => (
                    <Link href={filterHref("/research-plans", { project: row.id })} className="text-moss hover:underline">
                      {row._count.researchPlans} plans · {row._count.experiments} experiments · {row._count.results} results
                    </Link>
                  ),
                },
                { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} href={filterHref("/projects", { status: row.status })} /> },
                {
                  key: "tags",
                  header: "Tags",
                  render: (row) => <div className="flex flex-wrap gap-1">{row.tags.map((item) => <BadgeLink key={item} href={filterHref("/projects", { tag: item })}>{item}</BadgeLink>)}</div>,
                },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
