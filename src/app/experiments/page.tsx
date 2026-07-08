import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ActiveFilterBar, type ActiveFilter } from "@/components/ActiveFilterBar";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolRunStep } from "@/components/ProtocolSection";
import { RelevantItemsPanel } from "@/components/RelevantItemsPanel";
import { Badge, BadgeLink, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { experiments as demoExperiments, relevantItems } from "@/lib/demo-data";
import { prisma } from "@/lib/db";
import { filterHref, firstSearchParam, type PageSearchParams } from "@/lib/filters";
import type { Experiment } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getExperimentRecords(): Promise<Experiment[]> {
  try {
    const records = await prisma.experiment.findMany({
      include: {
        project: true,
        protocolRun: true,
        protocolVersion: { include: { protocol: true } },
        steps: { orderBy: { order: "asc" } },
      },
      orderBy: { date: "desc" },
    });

    return records.map((experiment) => ({
      id: experiment.id,
      title: experiment.title,
      projectId: experiment.projectId ?? undefined,
      projectName: experiment.project?.name,
      status: experiment.status,
      recordStatus: experiment.recordStatus,
      date: experiment.date.toISOString(),
      purpose: experiment.purpose ?? "",
      background: experiment.background ?? "",
      materialsText: experiment.materialsText ?? "",
      observations: experiment.observations ?? "",
      resultSummary: experiment.resultSummary ?? "",
      conclusion: experiment.conclusion ?? "",
      deviations: experiment.deviations ?? "",
      protocolVersionId: experiment.protocolVersionId ?? undefined,
      protocolRunId: experiment.protocolRun?.id,
      tags: experiment.tags,
      steps: experiment.steps.map((step) => ({
        id: step.id,
        order: step.order,
        title: step.title,
        description: step.description,
        completed: step.completed,
        completedAt: step.completedAt?.toISOString(),
        deviationNote: step.deviationNote ?? undefined,
      })),
    }));
  } catch {
    return demoExperiments;
  }
}

export default async function ExperimentsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const experiments = await getExperimentRecords();
  const tag = firstSearchParam(params, "tag");
  const status = firstSearchParam(params, "status");
  const project = firstSearchParam(params, "project");
  const projectLabel = experiments.find((experiment) => experiment.projectId === project)?.projectName ?? project;
  const filteredExperiments = experiments.filter((experiment) => {
    return (
      (!tag || experiment.tags.includes(tag)) &&
      (!status || experiment.status === status) &&
      (!project || experiment.projectId === project)
    );
  });
  const activeFilters: ActiveFilter[] = [];

  if (tag) activeFilters.push({ label: "tag", value: tag });
  if (status) activeFilters.push({ label: "status", value: status });
  if (project && projectLabel) activeFilters.push({ label: "project", value: projectLabel });

  const activeExperiment = filteredExperiments[0] ?? experiments[0];

  return (
    <AppShell>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <PageHeader
            eyebrow="Formal lab notebook"
            title="Experiments"
            description="Experiment records keep purpose, background, deviations, observations, results, protocol version, and inventory transaction links together."
            actions={
              <Link
                href="/entries/new"
                className="focus-ring inline-flex h-10 items-center justify-center rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm shadow-paper transition hover:brightness-95"
              >
                Record Entry
              </Link>
            }
          />

          {activeExperiment ? (
            <Card>
              <CardHeader
                title={activeExperiment.title}
                eyebrow="Active experiment"
                action={
                  <StatusPill
                    status={activeExperiment.status}
                    href={filterHref("/experiments", { status: activeExperiment.status })}
                  />
                }
              />
              <CardBody>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ["Purpose", activeExperiment.purpose],
                    ["Background", activeExperiment.background],
                    ["Materials", activeExperiment.materialsText],
                    ["Observations", activeExperiment.observations],
                    ["Deviations", activeExperiment.deviations],
                    ["Results Summary", activeExperiment.resultSummary],
                  ].map(([label, value]) => (
                    <section key={label} className="rounded-[10px] border border-hairline bg-warm p-4">
                      <h3 className="font-serif text-lg font-medium text-ink">{label}</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-graphite">{value || "Not recorded yet."}</p>
                    </section>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {activeExperiment.tags.map((tag) => (
                    <BadgeLink key={tag} href={filterHref("/experiments", { tag })} title={`Filter experiments by tag: ${tag}`}>
                      {tag}
                    </BadgeLink>
                  ))}
                  {activeExperiment.protocolVersionId ? <Badge tone="sage">protocol version locked</Badge> : null}
                  <StatusPill status={activeExperiment.recordStatus} />
                </div>
              </CardBody>
            </Card>
          ) : null}

          {activeExperiment ? (
            <Card>
              <CardHeader title="Protocol Checklist" eyebrow="Run state" />
              <CardBody className="space-y-3">
                {activeExperiment.steps.length ? (
                  activeExperiment.steps.map((step) => <ProtocolRunStep key={step.id} step={step} />)
                ) : (
                  <p className="text-sm text-muted">No protocol steps registered.</p>
                )}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Experiment Index" eyebrow="All records" />
            <CardBody>
              <ActiveFilterBar
                filters={activeFilters}
                clearHref="/experiments"
                resultCount={filteredExperiments.length}
                totalCount={experiments.length}
              />
              <DataTable
                rows={filteredExperiments}
                getRowKey={(row) => row.id}
                className="mt-4"
                columns={[
                  { key: "title", header: "Experiment", render: (row) => <span className="font-semibold text-ink">{row.title}</span> },
                  {
                    key: "project",
                    header: "Project",
                    render: (row) =>
                      row.projectId && row.projectName ? (
                        <Link href={filterHref("/experiments", { project: row.projectId })} className="text-moss hover:underline">
                          {row.projectName}
                        </Link>
                      ) : (
                        row.projectName
                      ),
                  },
                  { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} href={filterHref("/experiments", { status: row.status })} /> },
                  { key: "date", header: "Date", render: (row) => new Date(row.date).toLocaleDateString() },
                ]}
              />
            </CardBody>
          </Card>
        </div>
        <RelevantItemsPanel items={relevantItems} />
      </div>
    </AppShell>
  );
}
