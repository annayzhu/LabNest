import { AppShell } from "@/components/AppShell";
import { ActiveFilterBar, type ActiveFilter } from "@/components/ActiveFilterBar";
import { PageHeader } from "@/components/PageHeader";
import { BadgeLink, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { projects } from "@/lib/demo-data";
import { filterHref, firstSearchParam, type PageSearchParams } from "@/lib/filters";

export default async function ProjectsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const tag = firstSearchParam(params, "tag");
  const status = firstSearchParam(params, "status");
  const filteredProjects = projects.filter((project) => {
    return (!tag || project.tags.includes(tag)) && (!status || project.status === status);
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
          description="Projects collect entries, experiments, protocols, entities, inventory, results, purchases, attachments, and backlinks."
        />
        <Card>
          <CardHeader title="Project Index" eyebrow="Searchable context" />
          <CardBody>
            <ActiveFilterBar
              filters={activeFilters}
              clearHref="/projects"
              resultCount={filteredProjects.length}
              totalCount={projects.length}
            />
            <DataTable
              rows={filteredProjects}
              getRowKey={(row) => row.id}
              className="mt-4"
              columns={[
                { key: "name", header: "Project", render: (row) => <span className="font-semibold text-ink">{row.name}</span> },
                { key: "description", header: "Description", render: (row) => row.description },
                { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} href={filterHref("/projects", { status: row.status })} /> },
                {
                  key: "tags",
                  header: "Tags",
                  render: (row) => (
                    <div className="flex flex-wrap gap-1">
                      {row.tags.map((tag) => (
                        <BadgeLink key={tag} href={filterHref("/projects", { tag })} title={`Filter projects by tag: ${tag}`}>
                          {tag}
                        </BadgeLink>
                      ))}
                    </div>
                  ),
                },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
