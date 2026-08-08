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

const primaryButton =
  "focus-ring inline-flex h-10 items-center justify-center rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm transition hover:brightness-95";

export default async function ProtocolsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const availability = firstSearchParam(params, "availability") ?? firstSearchParam(params, "status");
  const scope = firstSearchParam(params, "scope");
  const protocolId = firstSearchParam(params, "protocol");
  const protocols = await prisma.protocol.findMany({
    where: {
      ...(availability ? { availability: availability as "draft" | "active" | "retired" | "archived" } : {}),
      ...(scope ? { scope: scope as "general" | "project" } : {}),
    },
    include: {
      versions: { orderBy: { revision: "desc" } },
      project: true,
      researchPlans: { include: { researchPlan: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
  });
  const activeProtocol = protocols.find((item) => item.id === protocolId) ?? protocols[0];
  const currentVersion = activeProtocol?.versions[0];
  const activeFilters: ActiveFilter[] = [];
  if (availability) activeFilters.push({ label: "availability", value: availability });
  if (scope) activeFilters.push({ label: "scope", value: scope });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Controlled methods"
          title="Protocols"
          description="General protocols can be adapted for a research plan. Availability and scientific review are tracked separately, and experiments retain the exact version used."
          actions={<Link href="/protocols/new" className={primaryButton}>New protocol</Link>}
        />

        {activeProtocol && currentVersion ? (
          <Card>
            <CardHeader
              title={activeProtocol.canonicalTitle ?? activeProtocol.title}
              eyebrow={`${activeProtocol.humanCode ?? "Uncoded"} · version ${currentVersion.displayVersion}`}
              action={<Link href={`/entries/new?protocolVersionId=${currentVersion.id}`} className={primaryButton}>Use in experiment</Link>}
            />
            <CardBody className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <StatusPill status={activeProtocol.availability} />
                <StatusPill status={currentVersion.reviewStage} />
                <Badge tone={activeProtocol.scope === "general" ? "info" : "sage"}>{activeProtocol.scope} protocol</Badge>
                <Badge>{activeProtocol.versions.length} version{activeProtocol.versions.length === 1 ? "" : "s"}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Purpose", currentVersion.purpose],
                  ["Scope", currentVersion.scope],
                  ["Change", currentVersion.changeSummary],
                  ["Adaptation", currentVersion.adaptationRationale],
                ].map(([label, value]) => (
                  <section key={label} className="border-l border-hairline pl-3">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</h3>
                    <p className="mt-1 text-sm leading-6 text-graphite">{value || "Not recorded."}</p>
                  </section>
                ))}
              </div>
              {activeProtocol.researchPlans.length ? (
                <p className="text-xs text-muted">Linked plans: {activeProtocol.researchPlans.map(({ researchPlan }) => researchPlan.title).join(" · ")}</p>
              ) : null}
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Protocol library" eyebrow="General and project-adapted methods" />
          <CardBody>
            <ActiveFilterBar filters={activeFilters} clearHref="/protocols" resultCount={protocols.length} totalCount={protocols.length} />
            <DataTable
              rows={protocols}
              getRowKey={(row) => row.id}
              className="mt-4"
              emptyMessage="No protocols have been created."
              columns={[
                {
                  key: "protocol",
                  header: "Protocol",
                  render: (row) => (
                    <Link href={filterHref("/protocols", { protocol: row.id, availability, scope })} className="block">
                      <span className="font-mono text-xs text-muted">{row.humanCode ?? "—"}</span>
                      <span className="ml-2 font-semibold text-ink hover:text-moss">{row.canonicalTitle ?? row.title}</span>
                    </Link>
                  ),
                },
                {
                  key: "version",
                  header: "Current version",
                  render: (row) => row.versions[0] ? <span className="font-mono">{row.versions[0].displayVersion}</span> : "—",
                },
                {
                  key: "review",
                  header: "Review",
                  render: (row) => row.versions[0] ? <StatusPill status={row.versions[0].reviewStage} /> : "—",
                },
                { key: "availability", header: "Availability", render: (row) => <StatusPill status={row.availability} href={filterHref("/protocols", { availability: row.availability })} /> },
                { key: "scope", header: "Scope", render: (row) => <BadgeLink href={filterHref("/protocols", { scope: row.scope })} tone={row.scope === "general" ? "info" : "sage"}>{row.scope}</BadgeLink> },
                { key: "context", header: "Context", render: (row) => row.project?.name ?? (row.scope === "general" ? "Protocol library" : "Unassigned") },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
