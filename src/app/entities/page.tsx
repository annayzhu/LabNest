import { AppShell } from "@/components/AppShell";
import { ActiveFilterBar, type ActiveFilter } from "@/components/ActiveFilterBar";
import { PageHeader } from "@/components/PageHeader";
import { BadgeLink, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { entities } from "@/lib/demo-data";
import { filterHref, firstSearchParam, type PageSearchParams } from "@/lib/filters";

export default async function EntitiesPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const type = firstSearchParam(params, "type");
  const status = firstSearchParam(params, "status");
  const filteredEntities = entities.filter((entity) => {
    return (!type || entity.type === type) && (!status || entity.status === status);
  });
  const activeFilters: ActiveFilter[] = [];

  if (type) activeFilters.push({ label: "type", value: type.replaceAll("_", " ") });
  if (status) activeFilters.push({ label: "status", value: status });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Samples and entities"
          title="Entities"
          description="A lightweight registry for plasmids, primers, cell lines, antibodies, compounds, samples, and other lab objects."
        />
        <Card>
          <CardHeader title="Registry" eyebrow="Filterable objects" />
          <CardBody>
            <ActiveFilterBar
              filters={activeFilters}
              clearHref="/entities"
              resultCount={filteredEntities.length}
              totalCount={entities.length}
            />
            <DataTable
              rows={filteredEntities}
              getRowKey={(row) => row.id}
              className="mt-4"
              columns={[
                { key: "name", header: "Name", render: (row) => <span className="font-semibold text-ink">{row.name}</span> },
                {
                  key: "type",
                  header: "Type",
                  render: (row) => (
                    <BadgeLink href={filterHref("/entities", { type: row.type })} tone="sage">
                      {row.type.replaceAll("_", " ")}
                    </BadgeLink>
                  ),
                },
                { key: "code", header: "Code", render: (row) => <span className="font-mono text-xs">{row.code}</span> },
                { key: "project", header: "Project", render: (row) => row.projectName },
                { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} href={filterHref("/entities", { status: row.status })} /> },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
