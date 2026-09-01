import Link from "next/link";
import { ArrowRight, Boxes, ClipboardList, TestTube2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ActiveFilterBar, type ActiveFilter } from "@/components/ActiveFilterBar";
import { PageHeader } from "@/components/PageHeader";
import { Badge, BadgeLink, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { filterHref, firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { getSampleLedger } from "@/lib/live-data";
import {
  calculateSampleQuantityFromAliquots,
  countActionableSampleWarnings,
  getSampleAliquots,
  sortSampleEventsByTime,
} from "@/lib/samples";
import type { SampleWarning, StatusTone } from "@/lib/types";

const warningTone: Record<SampleWarning["severity"], StatusTone> = {
  watch: "warning",
  action: "danger",
};

export const dynamic = "force-dynamic";

export default async function SamplesPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const { inventoryItems, sampleLifecycleEvents, sampleProfiles } = await getSampleLedger();
  const status = firstSearchParam(params, "status");
  const warning = firstSearchParam(params, "warning");
  const aliquotStatus = firstSearchParam(params, "aliquotStatus");
  const eventType = firstSearchParam(params, "eventType");
  const sampleRows = sampleProfiles.map((sample) => ({
    ...sample,
    derivedQuantity: calculateSampleQuantityFromAliquots(sample, inventoryItems),
  }));
  const aliquotRows = sampleProfiles.flatMap((sample) =>
    getSampleAliquots(sample, inventoryItems).map((item) => ({
      ...item,
      sampleName: sample.name,
      sampleCode: sample.sampleCode,
    })),
  );
  const eventRows = sortSampleEventsByTime(sampleLifecycleEvents);
  const filteredSampleRows = sampleRows.filter((sample) => {
    return (!status || sample.status === status) && (!warning || sample.warnings.some((item) => item.type === warning));
  });
  const filteredAliquotRows = aliquotRows.filter((item) => !aliquotStatus || item.status === aliquotStatus);
  const filteredEventRows = eventRows.filter((event) => !eventType || event.type === eventType);
  const sampleFilters: ActiveFilter[] = [];
  const aliquotFilters: ActiveFilter[] = [];
  const eventFilters: ActiveFilter[] = [];

  if (status) sampleFilters.push({ label: "status", value: status });
  if (warning) sampleFilters.push({ label: "warning", value: warning.replaceAll("_", " ") });
  if (aliquotStatus) aliquotFilters.push({ label: "aliquot", value: aliquotStatus });
  if (eventType) eventFilters.push({ label: "event", value: eventType.replaceAll("_", " ") });

  const stockedSamples = sampleProfiles.filter((sample) => sample.status === "stocked").length;
  const stockedAliquots = aliquotRows.filter((item) => item.status === "active").length;
  const warningCount = sampleProfiles.reduce((count, sample) => count + sample.warnings.length, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Sample ledger"
          title="Samples"
          description="Biological identity, aliquots, storage, and experiment provenance in one ledger."
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SampleMetric icon={TestTube2} label="Stocked samples" value={stockedSamples} />
          <SampleMetric icon={Boxes} label="Active aliquots" value={stockedAliquots} />
          <SampleMetric icon={ClipboardList} label="Lifecycle events" value={eventRows.length} />
          <SampleMetric icon={ArrowRight} label="Warnings" value={warningCount} />
        </section>

        <Card>
          <CardHeader
            title="Sample Profiles"
            eyebrow="Identity layer"
            action={
              <Link href="/inventory" className="text-sm font-medium text-moss hover:underline">
                View aliquots
              </Link>
            }
          />
          <CardBody>
            <ActiveFilterBar
              filters={sampleFilters}
              clearHref="/samples"
              resultCount={filteredSampleRows.length}
              totalCount={sampleRows.length}
            />
            <DataTable
              rows={filteredSampleRows}
              getRowKey={(row) => row.id}
              className="mt-4"
              columns={[
                {
                  key: "sample",
                  header: "Sample",
                  render: (row) => (
                    <div>
                      <p className="font-semibold text-ink">{row.name}</p>
                      <p className="record-identifier mt-1 text-xs text-muted">{row.sampleCode}</p>
                    </div>
                  ),
                },
                { key: "type", header: "Type", render: (row) => row.sampleType.replaceAll("_", " ") },
                {
                  key: "quantity",
                  header: "Remaining",
                  render: (row) => (
                    <span className="font-mono">
                      {row.derivedQuantity} {row.unit}
                    </span>
                  ),
                },
                {
                  key: "storage",
                  header: "Primary Location",
                  render: (row) => row.primaryLocation ?? "not placed",
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <StatusPill status={row.status} href={filterHref("/samples", { status: row.status })} />,
                },
                {
                  key: "warnings",
                  header: "Warnings",
                  render: (row) => (
                    <div className="flex flex-wrap gap-2">
                      {row.warnings.length ? (
                        row.warnings.map((warning) => (
                          <BadgeLink
                            key={`${row.id}-${warning.type}`}
                            href={filterHref("/samples", { warning: warning.type })}
                            tone={warningTone[warning.severity]}
                          >
                            {warning.type.replaceAll("_", " ")}
                          </BadgeLink>
                        ))
                      ) : (
                        <Badge tone="success">clear</Badge>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </CardBody>
        </Card>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader title="Aliquots and Positions" eyebrow="Physical layer" />
            <CardBody>
              <ActiveFilterBar
                filters={aliquotFilters}
                clearHref="/samples"
                resultCount={filteredAliquotRows.length}
                totalCount={aliquotRows.length}
              />
              <DataTable
                rows={filteredAliquotRows}
                getRowKey={(row) => row.id}
                className="mt-4"
                columns={[
                  {
                    key: "aliquot",
                    header: "Aliquot",
                    render: (row) => (
                      <div>
                        <p className="font-semibold text-ink">{row.aliquotCode ?? row.name}</p>
                        <p className="mt-1 text-xs text-muted">{row.sampleCode}</p>
                      </div>
                    ),
                  },
                  {
                    key: "quantity",
                    header: "Qty",
                    render: (row) => (
                      <span className="font-mono">
                        {row.currentQuantity} {row.unit}
                      </span>
                    ),
                  },
                  { key: "position", header: "Position", render: (row) => row.positionCode ?? "not set" },
                  { key: "freezeThaw", header: "F/T", render: (row) => row.freezeThawCount ?? 0 },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => <StatusPill status={row.status} href={filterHref("/samples", { aliquotStatus: row.status })} />,
                  },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Lifecycle Events" eyebrow="Provenance trail" />
            <CardBody>
              <ActiveFilterBar
                filters={eventFilters}
                clearHref="/samples"
                resultCount={filteredEventRows.length}
                totalCount={eventRows.length}
              />
              <DataTable
                rows={filteredEventRows}
                getRowKey={(row) => row.id}
                className="mt-4"
                columns={[
                  {
                    key: "event",
                    header: "Event",
                    render: (row) => (
                      <div>
                        <p className="font-semibold text-ink">{row.title}</p>
                        <p className="mt-1 font-mono text-xs text-muted">{row.occurredAt}</p>
                      </div>
                    ),
                  },
                  {
                    key: "type",
                    header: "Type",
                    render: (row) => (
                      <BadgeLink href={filterHref("/samples", { eventType: row.type })} tone="sage">
                        {row.type.replaceAll("_", " ")}
                      </BadgeLink>
                    ),
                  },
                  {
                    key: "link",
                    header: "Linked Record",
                    render: (row) => row.experimentTitle ?? row.aliquotCode ?? "sample profile",
                  },
                  {
                    key: "change",
                    header: "Change",
                    render: (row) =>
                      row.quantityChange === undefined ? (
                        "context"
                      ) : (
                        <span className="font-mono">
                          {row.quantityChange > 0 ? "+" : ""}
                          {row.quantityChange} {row.unit}
                        </span>
                      ),
                  },
                ]}
              />
            </CardBody>
          </Card>
        </section>

        <Card>
          <CardHeader title="Open Sample Flags" eyebrow="Review queue" />
          <CardBody className="grid gap-3 md:grid-cols-2">
            {sampleProfiles.flatMap((sample) =>
              sample.warnings.map((warning) => (
                <div key={`${sample.id}-${warning.type}`} className="rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-ink">{sample.name}</p>
                    <Badge tone={warningTone[warning.severity]}>{warning.severity}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-graphite">{warning.message}</p>
                  <p className="record-identifier mt-2 text-xs text-muted">{sample.sampleCode}</p>
                </div>
              )),
            )}
            {countActionableSampleWarnings(sampleProfiles) === 0 ? (
              <div className="rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm p-3">
                <p className="font-semibold text-ink">No action-level sample flags</p>
                <p className="mt-2 text-sm leading-6 text-graphite">Watch-level flags remain visible in the profile table.</p>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}

function SampleMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof TestTube2;
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-h-[94px] min-w-0 flex-col justify-between rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface p-4 shadow-paper">
      <Icon className="h-4 w-4 shrink-0 text-moss" aria-hidden />
      <div>
        <p className="font-serif text-2xl font-medium leading-none text-ink">{value}</p>
        <p className="mt-2 text-[11px] font-semibold uppercase leading-none tracking-[0.04em] text-muted">{label}</p>
      </div>
    </div>
  );
}
