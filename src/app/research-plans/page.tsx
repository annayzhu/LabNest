import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ActiveFilterBar, type ActiveFilter } from "@/components/ActiveFilterBar";
import { PageHeader } from "@/components/PageHeader";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { filterHref, firstSearchParam, type PageSearchParams } from "@/lib/filters";

export const dynamic = "force-dynamic";

export default async function ResearchPlansPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const projectId = firstSearchParam(params, "project");
  const status = firstSearchParam(params, "status");
  const plans = await prisma.researchPlan.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(status ? { status: status as "draft" | "active" | "paused" | "completed" | "archived" } : {}),
    },
    include: {
      project: true,
      protocols: { include: { protocol: true } },
      _count: { select: { entries: true, experiments: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const activeFilters: ActiveFilter[] = [];
  if (projectId) activeFilters.push({ label: "project", value: plans[0]?.project.name ?? projectId });
  if (status) activeFilters.push({ label: "status", value: status });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Scientific design"
          title="Research Plans"
          description="Plans translate a project objective into a testable hypothesis, design, adapted protocols, and a series of repeatable experiments."
        />
        <Card>
          <CardHeader title="Plan index" eyebrow="Project → plan → protocol → experiment" />
          <CardBody>
            <ActiveFilterBar filters={activeFilters} clearHref="/research-plans" resultCount={plans.length} totalCount={plans.length} />
            <DataTable
              rows={plans}
              getRowKey={(row) => row.id}
              className="mt-4"
              columns={[
                {
                  key: "plan",
                  header: "Research plan",
                  render: (row) => (
                    <div>
                      <div className="flex items-center gap-2">
                        {row.code ? <span className="font-mono text-xs text-muted">{row.code}</span> : null}
                        <span className="font-semibold text-ink">{row.title}</span>
                      </div>
                      <p className="mt-1 max-w-xl text-xs leading-5 text-muted">{row.objective ?? "Objective not recorded."}</p>
                    </div>
                  ),
                },
                {
                  key: "project",
                  header: "Project",
                  render: (row) => <Link href={filterHref("/projects", { project: row.projectId })} className="text-moss hover:underline">{row.project.name}</Link>,
                },
                {
                  key: "protocols",
                  header: "Protocols",
                  render: (row) => <div className="flex max-w-sm flex-wrap gap-1">{row.protocols.length ? row.protocols.map(({ protocol, isPrimary }) => <Badge key={protocol.id} tone={isPrimary ? "sage" : "neutral"}>{protocol.humanCode ?? protocol.title}</Badge>) : <span className="text-muted">None linked</span>}</div>,
                },
                { key: "records", header: "Records", render: (row) => `${row._count.experiments} experiments · ${row._count.entries} entries` },
                { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} href={filterHref("/research-plans", { status: row.status })} /> },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
