import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ActiveFilterBar, type ActiveFilter } from "@/components/ActiveFilterBar";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolMetric, ProtocolStepCard, VariableBadge } from "@/components/ProtocolSection";
import { BadgeLink, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { protocols as demoProtocols } from "@/lib/demo-data";
import { prisma } from "@/lib/db";
import { filterHref, firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { recordLifecycleStatuses } from "@/lib/protocol";
import type {
  ConsumptionRule,
  Protocol,
  ProtocolMaterial,
  ProtocolParameter,
  ProtocolStep,
  ProtocolVersionData,
  ResultTemplate,
} from "@/lib/types";

export const dynamic = "force-dynamic";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

async function getProtocolRecords(): Promise<Protocol[]> {
  try {
    const records = await prisma.protocol.findMany({
      include: { versions: { orderBy: { versionNumber: "desc" } } },
      orderBy: { updatedAt: "desc" },
    });

    return records.map((protocol) => {
      const versions: ProtocolVersionData[] = protocol.versions.map((version) => ({
        id: version.id,
        protocolId: version.protocolId,
        versionNumber: version.versionNumber,
        recordStatus: version.recordStatus,
        createdFromVersionId: version.createdFromVersionId ?? undefined,
        changeSummary: version.changeSummary ?? undefined,
        title: version.title,
        purpose: version.purpose ?? "",
        background: version.background ?? "",
        scope: version.scope ?? "",
        notes: version.notes ?? "",
        parameters: asArray<ProtocolParameter>(version.parametersJson),
        materials: asArray<ProtocolMaterial>(version.materialsJson),
        equipment: asArray<ProtocolMaterial>(version.equipmentJson),
        steps: asArray<ProtocolStep>(version.stepsJson),
        consumptionRules: asArray<ConsumptionRule>(version.consumptionRulesJson),
        resultTemplates: asArray<ResultTemplate>(version.resultTemplatesJson),
        createdAt: version.createdAt.toISOString(),
      }));
      const currentVersion =
        versions[0] ??
        ({
          id: `${protocol.id}-empty-version`,
          protocolId: protocol.id,
          versionNumber: 0,
          recordStatus: protocol.recordStatus,
          title: `${protocol.title} v0`,
          purpose: protocol.description ?? "",
          background: "",
          scope: "",
          notes: "",
          parameters: [],
          materials: [],
          equipment: [],
          steps: [],
          consumptionRules: [],
          resultTemplates: [],
          createdAt: protocol.createdAt.toISOString(),
        } satisfies ProtocolVersionData);

      return {
        id: protocol.id,
        title: protocol.title,
        description: protocol.description ?? "",
        status: protocol.status,
        recordStatus: protocol.recordStatus,
        tags: protocol.tags,
        currentVersion,
        versions,
        updatedAt: protocol.updatedAt.toISOString(),
      };
    });
  } catch {
    return demoProtocols;
  }
}

export default async function ProtocolsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const protocols = await getProtocolRecords();
  const tag = firstSearchParam(params, "tag");
  const status = firstSearchParam(params, "status");
  const record = firstSearchParam(params, "record");
  const filteredProtocols = protocols.filter((protocol) => {
    return (
      (!tag || protocol.tags.includes(tag)) &&
      (!status || protocol.status === status) &&
      (!record || protocol.recordStatus === record)
    );
  });
  const activeFilters: ActiveFilter[] = [];

  if (tag) activeFilters.push({ label: "tag", value: tag });
  if (status) activeFilters.push({ label: "status", value: status });
  if (record) activeFilters.push({ label: "record", value: record });

  const activeProtocol = filteredProtocols[0] ?? protocols[0];
  if (!activeProtocol) {
    return (
      <AppShell>
        <div className="space-y-6">
          <PageHeader
            eyebrow="Versioned methods"
            title="Protocols"
            description="Protocols are structured scientific documents."
            actions={
              <Link
                href="/protocols/new"
                className="focus-ring inline-flex h-10 items-center justify-center rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm shadow-paper transition hover:brightness-95"
              >
                New Protocol
              </Link>
            }
          />
          <Card>
            <CardBody>
              <p className="text-sm text-graphite">No protocols yet.</p>
            </CardBody>
          </Card>
        </div>
      </AppShell>
    );
  }
  const version = activeProtocol.currentVersion;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Versioned methods"
          title="Protocols"
          description="Protocols are structured scientific documents. Experiments created from them store the exact protocol version used."
          actions={
            <Link
              href="/protocols/new"
              className="focus-ring inline-flex h-10 items-center justify-center rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm shadow-paper transition hover:brightness-95"
            >
              New Protocol
            </Link>
          }
        />

        <Card>
          <CardHeader
            title={version.title}
            eyebrow="Structured editor"
            action={
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/entries/new?protocolVersionId=${version.id}`}
                  className="focus-ring inline-flex h-10 shrink-0 items-center justify-center rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm shadow-paper transition hover:brightness-95"
                >
                  Record Entry
                </Link>
                <Link
                  href="/protocol-run"
                  className="focus-ring inline-flex h-10 shrink-0 items-center justify-center rounded-[8px] border border-hairline bg-surface px-4 text-sm font-medium text-moss shadow-paper transition hover:bg-sage-surface"
                >
                  Run Preview
                </Link>
              </div>
            }
          />
          <CardBody className="space-y-5">
            <div className="grid gap-3 md:grid-cols-4">
              <ProtocolMetric label="Version" value={`v${version.versionNumber}`} />
              <ProtocolMetric label="Record" value={version.recordStatus} />
              <ProtocolMetric label="Parameters" value={version.parameters.length} />
              <ProtocolMetric label="Steps" value={version.steps.length} />
            </div>

            <section className="rounded-[10px] border border-hairline bg-warm p-4">
              <h3 className="font-serif text-xl font-medium text-ink">Overview</h3>
              <p className="mt-2 text-sm leading-6 text-graphite">{version.purpose}</p>
              <p className="mt-2 text-sm leading-6 text-graphite">{version.background}</p>
              {version.changeSummary ? (
                <p className="mt-3 text-sm leading-6 text-graphite">{version.changeSummary}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
              {recordLifecycleStatuses.map((status) => (
                  <BadgeLink
                    key={status}
                    href={filterHref("/protocols", { record: status })}
                    tone={status === version.recordStatus ? "success" : "neutral"}
                    className={status === version.recordStatus ? "border-moss" : undefined}
                    title={`Filter protocols by record status: ${status}`}
                  >
                    {status}
                  </BadgeLink>
                ))}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[10px] border border-hairline bg-warm p-4">
                <h3 className="font-serif text-xl font-medium text-ink">Parameters</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {version.parameters.map((parameter) => (
                    <VariableBadge key={parameter.name}>{"{{" + parameter.name + "}}"}</VariableBadge>
                  ))}
                </div>
              </div>
              <div className="rounded-[10px] border border-hairline bg-warm p-4">
                <h3 className="font-serif text-xl font-medium text-ink">Consumption Rules</h3>
                <div className="mt-3 space-y-2">
                  {version.consumptionRules.length ? version.consumptionRules.map((rule) => (
                    <p key={rule.material_name} className="font-mono text-xs leading-5 text-graphite">
                      {rule.material_name}: {rule.formula} {rule.unit}
                    </p>
                  )) : <p className="text-sm text-muted">No consumption rules yet.</p>}
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-3 font-serif text-xl font-medium text-ink">Steps</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {version.steps.length ? version.steps.map((step) => (
                  <ProtocolStepCard key={step.order} step={step} />
                )) : <p className="rounded-[10px] border border-hairline bg-warm p-4 text-sm text-muted">No steps yet.</p>}
              </div>
            </section>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Protocol Library" eyebrow="Templates" />
          <CardBody>
            <ActiveFilterBar
              filters={activeFilters}
              clearHref="/protocols"
              resultCount={filteredProtocols.length}
              totalCount={protocols.length}
            />
            <DataTable
              rows={filteredProtocols}
              getRowKey={(row) => row.id}
              className="mt-4"
              columns={[
                { key: "title", header: "Protocol", render: (row) => <span className="font-semibold text-ink">{row.title}</span> },
                { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} href={filterHref("/protocols", { status: row.status })} /> },
                {
                  key: "record",
                  header: "Record",
                  render: (row) => <StatusPill status={row.recordStatus} href={filterHref("/protocols", { record: row.recordStatus })} />,
                },
                {
                  key: "version",
                  header: "Current Version",
                  render: (row) => <span className="font-mono">v{row.currentVersion.versionNumber}</span>,
                },
                {
                  key: "tags",
                  header: "Tags",
                  render: (row) => (
                    <div className="flex flex-wrap gap-1">
                      {row.tags.map((tag) => (
                        <BadgeLink key={tag} href={filterHref("/protocols", { tag })} title={`Filter protocols by tag: ${tag}`}>
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

        <Card>
          <CardHeader title="Version History" eyebrow="Protocol changes" />
          <CardBody>
            <DataTable
              rows={activeProtocol.versions}
              getRowKey={(row) => row.id}
              columns={[
                {
                  key: "version",
                  header: "Version",
                  render: (row) => <span className="font-mono">v{row.versionNumber}</span>,
                },
                { key: "record", header: "Record", render: (row) => <StatusPill status={row.recordStatus} href={filterHref("/protocols", { record: row.recordStatus })} /> },
                {
                  key: "source",
                  header: "From",
                  render: (row) => <span className="font-mono text-xs">{row.createdFromVersionId ?? "initial"}</span>,
                },
                { key: "summary", header: "Change", render: (row) => row.changeSummary ?? "Initial version." },
                { key: "created", header: "Created", render: (row) => row.createdAt },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
