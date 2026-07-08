import { AppShell } from "@/components/AppShell";
import { ActiveFilterBar, type ActiveFilter } from "@/components/ActiveFilterBar";
import { PageHeader } from "@/components/PageHeader";
import { BadgeLink, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { results as demoResults } from "@/lib/demo-data";
import { prisma } from "@/lib/db";
import { filterHref, firstSearchParam, type PageSearchParams } from "@/lib/filters";
import type { ResultRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getResultRecords(): Promise<ResultRecord[]> {
  try {
    const records = await prisma.result.findMany({
      include: { experiment: true, entity: true, project: true },
      orderBy: { updatedAt: "desc" },
    });

    return records.map((result) => ({
      id: result.id,
      title: result.title,
      resultType: result.resultType,
      experimentTitle: result.experiment?.title,
      entityName: result.entity?.name,
      projectName: result.project?.name,
      status: result.status,
      numericValue: result.numericValue ?? undefined,
      textValue: result.textValue ?? undefined,
      unit: result.unit ?? undefined,
      notes: result.notes ?? undefined,
    }));
  } catch {
    return demoResults;
  }
}

export default async function ResultsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const results = await getResultRecords();
  const type = firstSearchParam(params, "type");
  const status = firstSearchParam(params, "status");
  const filteredResults = results.filter((result) => {
    return (!type || result.resultType === type) && (!status || result.status === status);
  });
  const activeFilters: ActiveFilter[] = [];

  if (type) activeFilters.push({ label: "type", value: type });
  if (status) activeFilters.push({ label: "status", value: status });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Structured observations"
          title="Results"
          description="Results can be manual or generated from protocol templates, linked back to experiments, entities, projects, and attachments."
        />
        <Card>
          <CardHeader title="Result Records" eyebrow="Export-friendly" />
          <CardBody>
            <ActiveFilterBar
              filters={activeFilters}
              clearHref="/results"
              resultCount={filteredResults.length}
              totalCount={results.length}
            />
            <DataTable
              rows={filteredResults}
              getRowKey={(row) => row.id}
              className="mt-4"
              columns={[
                { key: "title", header: "Result", render: (row) => <span className="font-semibold text-ink">{row.title}</span> },
                {
                  key: "type",
                  header: "Type",
                  render: (row) => (
                    <BadgeLink href={filterHref("/results", { type: row.resultType })} tone="sage">
                      {row.resultType}
                    </BadgeLink>
                  ),
                },
                { key: "experiment", header: "Experiment", render: (row) => row.experimentTitle },
                { key: "entity", header: "Entity", render: (row) => row.entityName ?? "none" },
                { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} href={filterHref("/results", { status: row.status })} /> },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
