import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ActiveFilterBar, type ActiveFilter } from "@/components/ActiveFilterBar";
import { PageHeader } from "@/components/PageHeader";
import { Badge, BadgeLink, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { filterHref, firstSearchParam, type PageSearchParams } from "@/lib/filters";

export const dynamic = "force-dynamic";

export default async function ExperimentsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const status = firstSearchParam(params, "status");
  const projectId = firstSearchParam(params, "project");
  const planId = firstSearchParam(params, "plan");
  const experimentId = firstSearchParam(params, "experiment");
  const experiments = await prisma.experiment.findMany({
    where: {
      ...(status ? { status: status as "planned" | "running" | "completed" | "failed" | "archived" } : {}),
      ...(projectId ? { projectId } : {}),
      ...(planId ? { researchPlanId: planId } : {}),
    },
    include: {
      project: true,
      researchPlan: true,
      primaryProtocolVersion: { include: { protocol: true } },
      protocolVersions: { orderBy: { order: "asc" }, include: { protocolVersion: { include: { protocol: true } } } },
      steps: { orderBy: { order: "asc" } },
      _count: { select: { results: true } },
    },
    orderBy: { date: "desc" },
  });
  const activeExperiment = experiments.find((item) => item.id === experimentId) ?? experiments[0];
  const activeFilters: ActiveFilter[] = [];
  if (status) activeFilters.push({ label: "status", value: status });
  if (projectId) activeFilters.push({ label: "project", value: activeExperiment?.project?.name ?? projectId });
  if (planId) activeFilters.push({ label: "plan", value: activeExperiment?.researchPlan?.title ?? planId });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Execution records"
          title="Experiments"
          description="Each experiment belongs to a research plan and preserves every protocol version used, including repeated runs of the same method."
          actions={<Link href="/experiments/new" className="focus-ring inline-flex h-10 items-center rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm">New Experiment</Link>}
        />

        {activeExperiment ? (
          <Card>
            <CardHeader title={activeExperiment.title} eyebrow={activeExperiment.researchPlan?.title ?? "Research plan not assigned"} action={<StatusPill status={activeExperiment.status} />} />
            <CardBody className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Purpose", activeExperiment.purpose],
                  ["Observations", activeExperiment.observations],
                  ["Deviations", activeExperiment.deviations],
                  ["Result summary", activeExperiment.resultSummary],
                ].map(([label, value]) => (
                  <section key={label} className="border-l border-hairline pl-3">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-graphite">{value || "Not recorded."}</p>
                  </section>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {activeExperiment.primaryProtocolVersion ? (
                  <Badge tone="sage">
                    Primary: {activeExperiment.primaryProtocolVersion.protocol.humanCode ?? activeExperiment.primaryProtocolVersion.protocol.title} · {activeExperiment.primaryProtocolVersion.displayVersion}
                  </Badge>
                ) : <Badge>No primary protocol</Badge>}
                {activeExperiment.protocolVersions.filter((link) => link.role === "supporting").map((link) => (
                  <Badge key={link.protocolVersionId} tone="neutral">
                    Supporting: {link.protocolVersion.protocol.humanCode ?? link.protocolVersion.protocol.title} · {link.protocolVersion.displayVersion}
                  </Badge>
                ))}
                <Badge>{activeExperiment.steps.filter((step) => step.completed).length}/{activeExperiment.steps.length} steps</Badge>
                <Badge>{activeExperiment._count.results} results</Badge>
              </div>
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Experiment index" eyebrow="Repeatable runs" />
          <CardBody>
            <ActiveFilterBar filters={activeFilters} clearHref="/experiments" resultCount={experiments.length} totalCount={experiments.length} />
            <DataTable
              rows={experiments}
              getRowKey={(row) => row.id}
              className="mt-4"
              columns={[
                {
                  key: "experiment",
                  header: "Experiment",
                  render: (row) => <Link href={`/experiments/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.runCode ? `${row.runCode} · ` : ""}{row.title}</Link>,
                },
                {
                  key: "plan",
                  header: "Research plan",
                  render: (row) => row.researchPlan ? <BadgeLink href={filterHref("/experiments", { plan: row.researchPlan.id })}>{row.researchPlan.code ?? row.researchPlan.title}</BadgeLink> : <span className="text-warning">Unassigned</span>,
                },
                {
                  key: "protocol",
                  header: "Primary protocol",
                  render: (row) => row.primaryProtocolVersion ? `${row.primaryProtocolVersion.protocol.humanCode ?? row.primaryProtocolVersion.protocol.title} · ${row.primaryProtocolVersion.displayVersion}` : "—",
                },
                { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} href={filterHref("/experiments", { status: row.status })} /> },
                { key: "date", header: "Date", render: (row) => row.date.toLocaleDateString() },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
