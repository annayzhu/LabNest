import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Beaker, Boxes, ClipboardList, Sparkles, TestTube2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EntryCard } from "@/components/EntryCard";
import { PageHeader } from "@/components/PageHeader";
import { ProposedActionCard } from "@/components/ProposedActionCard";
import { Badge, BadgeLink, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import {
  activity,
  dashboardStats,
  entries,
  experiments,
  inventoryItems,
  protocols,
  proposedActions,
  sampleProfiles,
} from "@/lib/demo-data";
import { filterHref } from "@/lib/filters";

export default function DashboardPage() {
  const lowInventory = inventoryItems.filter(
    (item) => item.lowThreshold !== undefined && item.currentQuantity < item.lowThreshold,
  );
  const expiringInventory = inventoryItems.filter((item) => item.expiryDate?.startsWith("2026-07"));
  const quickLinks = [
    { label: "Entries", href: "/entries" },
    { label: "Run Protocol", href: "/protocol-run" },
    { label: "Samples", href: "/samples" },
    { label: "Inventory", href: "/inventory" },
    { label: "Results", href: "/results" },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="LabNest V1"
          title="Your personal nest for protocols, notes, samples, and results."
          description="A quiet workspace for the daily record of lab work."
          actions={
            <>
              <Link
                href="/protocol-run"
                className="focus-ring inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm shadow-paper transition hover:brightness-95"
              >
                <ClipboardList className="h-4 w-4" aria-hidden />
                Run Protocol
              </Link>
              <Link
                href="/entries"
                className="focus-ring inline-flex h-10 shrink-0 items-center justify-center rounded-[8px] border border-hairline bg-surface px-4 text-sm font-medium text-ink shadow-paper transition hover:border-border-strong hover:bg-warm"
              >
                Entries
              </Link>
            </>
          }
        />

        <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
          <Card className="overflow-hidden">
            <div className="grid min-h-[320px] gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.78fr)]">
              <div className="flex flex-col justify-between p-5 md:p-6">
                <div>
                  <Badge tone="sage">AI optional</Badge>
                  <h2 className="mt-4 max-w-xl break-words font-serif text-2xl font-medium leading-tight text-ink md:text-[28px]">
                    Lab work, gathered.
                  </h2>
                  <p className="mt-3 hidden max-w-xl text-sm leading-6 text-graphite sm:block">
                    Notes, protocols, samples, results, and materials in one calm place.
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-3">
                  <Metric icon={Sparkles} label="Tasks" value={dashboardStats.pendingActions} />
                  <Metric icon={Beaker} label="Runs" value={dashboardStats.runningExperiments} />
                  <Metric icon={ClipboardList} label="SOPs" value={dashboardStats.activeProtocols} />
                  <Metric icon={TestTube2} label="Samples" value={sampleProfiles.length} />
                  <Metric icon={Boxes} label="Stock" value={dashboardStats.lowInventory} />
                </div>
              </div>
              <div className="relative hidden min-h-[320px] border-l border-hairline lg:block">
                <Image
                  src="/brand/labnest-editorial-workspace.png"
                  alt="Calm scientific notebook workspace"
                  fill
                  sizes="(min-width: 1280px) 28vw, 34vw"
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Quick Access" eyebrow="Daily surfaces" />
            <CardBody className="grid gap-2">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="focus-ring flex min-h-11 items-center justify-between rounded-[9px] border border-hairline bg-warm px-3 text-left text-sm font-medium text-ink transition hover:bg-sage-surface/60"
                >
                  {item.label}
                  <ArrowRight className="h-4 w-4 text-moss" aria-hidden />
                </Link>
              ))}
            </CardBody>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader
              title="Recent Entries"
              eyebrow="Journal"
              action={
                <Link href="/entries" className="text-sm font-medium text-moss hover:underline">
                  View all
                </Link>
              }
            />
            <CardBody className="grid gap-4 md:grid-cols-2">
              {entries.slice(0, 2).map((entry) => (
                <EntryCard key={entry.id} entry={entry} />
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Pending Proposed Actions"
              eyebrow="Review inbox"
              action={
                <Link href="/actions" className="text-sm font-medium text-moss hover:underline">
                  Review
                </Link>
              }
            />
            <CardBody className="space-y-3">
              {proposedActions.slice(0, 2).map((action) => (
                <ProposedActionCard key={action.id} action={action} />
              ))}
            </CardBody>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader title="Recent Experiments" eyebrow="Notebook" />
            <CardBody className="space-y-3">
              {experiments.map((experiment) => (
                <div key={experiment.id} className="rounded-[10px] border border-hairline bg-warm p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{experiment.title}</p>
                      <p className="mt-1 text-sm text-muted">{experiment.projectName}</p>
                    </div>
                    <StatusPill status={experiment.status} href={filterHref("/experiments", { status: experiment.status })} />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent Protocols" eyebrow="Versioned" />
            <CardBody className="space-y-3">
              {protocols.slice(0, 3).map((protocol) => (
                <div key={protocol.id} className="rounded-[10px] border border-hairline bg-warm p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{protocol.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <span className="mr-1 font-mono text-xs text-muted">v{protocol.currentVersion.versionNumber}</span>
                        {protocol.tags.map((tag) => (
                          <BadgeLink key={tag} href={filterHref("/protocols", { tag })} title={`Filter protocols by tag: ${tag}`}>
                            {tag}
                          </BadgeLink>
                        ))}
                      </div>
                    </div>
                    <StatusPill status={protocol.status} href={filterHref("/protocols", { status: protocol.status })} />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent Activity" eyebrow="Audit trail" />
            <CardBody className="space-y-3">
              {activity.map((item) => (
                <div key={item.id} className="border-l border-moss/40 pl-3">
                  <p className="text-sm font-semibold text-ink">{item.action.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-sm leading-6 text-graphite">{item.detail}</p>
                  <p className="mt-1 font-mono text-xs text-muted">{item.createdAt}</p>
                </div>
              ))}
            </CardBody>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader title="Low Inventory" eyebrow="Transaction-derived" />
            <CardBody>
              <DataTable
                rows={lowInventory}
                getRowKey={(row) => row.id}
                columns={[
                  { key: "name", header: "Item", render: (row) => <span className="font-semibold text-ink">{row.name}</span> },
                  {
                    key: "quantity",
                    header: "Quantity",
                    render: (row) => (
                      <span className="font-mono text-sm">
                        {row.currentQuantity} {row.unit}
                      </span>
                    ),
                  },
                  { key: "location", header: "Location", render: (row) => row.location },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Expiring Inventory" eyebrow="Review soon" />
            <CardBody>
              <DataTable
                rows={expiringInventory}
                getRowKey={(row) => row.id}
                columns={[
                  { key: "name", header: "Item", render: (row) => <span className="font-semibold text-ink">{row.name}</span> },
                  { key: "expiry", header: "Expiry", render: (row) => row.expiryDate },
                  {
                    key: "status",
                    header: "Status",
                    render: () => (
                      <BadgeLink href={filterHref("/inventory", { flag: "expiring" })} tone="warning">
                        expiring soon
                      </BadgeLink>
                    ),
                  },
                ]}
              />
            </CardBody>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Sparkles;
  label: string;
  value: number;
}) {
  return (
    <div
      className="flex min-h-[92px] min-w-0 flex-col justify-between rounded-[10px] border border-hairline bg-warm p-3"
      aria-label={`${label}: ${value}`}
    >
      <Icon className="h-4 w-4 shrink-0 text-moss" aria-hidden />
      <div className="min-w-0">
        <p className="font-serif text-2xl font-medium leading-none text-ink">{value}</p>
        <p className="mt-2 whitespace-nowrap text-[10px] font-semibold uppercase leading-none tracking-[0.04em] text-muted">
          {label}
        </p>
      </div>
    </div>
  );
}
