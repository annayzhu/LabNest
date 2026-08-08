import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolDocumentView } from "@/components/ProtocolDocumentView";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { normalizeProtocolDocument, protocolDocumentFromLegacy } from "@/lib/protocol-document";
import type { ConsumptionRule, ProtocolMaterial, ProtocolStep, ResultTemplate } from "@/lib/types";

export const dynamic = "force-dynamic";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

const primaryButton = "focus-ring inline-flex h-10 items-center justify-center rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm";
const secondaryButton = "focus-ring inline-flex h-10 items-center justify-center rounded-[8px] border border-hairline bg-surface px-4 text-sm font-medium text-moss hover:bg-warm";

export default async function ProtocolDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: PageSearchParams;
}) {
  const { id } = await params;
  const query = searchParams ? await searchParams : undefined;
  const selectedVersionId = firstSearchParam(query, "version");
  const protocol = await prisma.protocol.findUnique({
    where: { id },
    include: {
      project: true,
      researchPlans: { include: { researchPlan: { include: { project: true } } } },
      versions: {
        orderBy: { revision: "desc" },
        include: {
          derivedFromVersion: { include: { protocol: true } },
          previousVersion: true,
          _count: { select: { primaryExperiments: true, experimentLinks: true, protocolRuns: true } },
        },
      },
    },
  });
  if (!protocol) notFound();
  const version = protocol.versions.find((item) => item.id === selectedVersionId) ?? protocol.versions[0];
  if (!version) notFound();

  const document = normalizeProtocolDocument(version.contentJson) ?? protocolDocumentFromLegacy({
    description: protocol.description,
    purpose: version.purpose,
    background: version.background,
    materials: asArray<ProtocolMaterial>(version.materialsJson),
    equipment: asArray<ProtocolMaterial>(version.equipmentJson),
    steps: asArray<ProtocolStep>(version.stepsJson),
    resultTemplates: asArray<ResultTemplate>(version.resultTemplatesJson),
    consumptionRules: asArray<ConsumptionRule>(version.consumptionRulesJson),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow={`${protocol.humanCode ?? "Uncoded"} · version ${version.displayVersion}`}
          title={protocol.canonicalTitle ?? protocol.title}
          description={protocol.englishTitle ?? protocol.description ?? undefined}
          actions={
            <>
              <Link href={`/entries/new?protocolVersionId=${version.id}`} className={primaryButton}>Use in experiment</Link>
              <Link href={`/protocols/${protocol.id}/versions/${version.id}/edit`} className={secondaryButton}>{version.reviewStage === "reviewed" ? "Create revision" : "Edit"}</Link>
              {protocol.scope === "general" ? <Link href={`/protocols/${protocol.id}/adapt?version=${version.id}`} className={secondaryButton}>Adapt to project</Link> : null}
            </>
          }
        />

        <Card>
          <CardHeader title="Protocol control" eyebrow="Identity and provenance" />
          <CardBody className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <Control label="Availability"><StatusPill status={protocol.availability} /></Control>
            <Control label="Review stage"><StatusPill status={version.reviewStage} /></Control>
            <Control label="Scope"><Badge tone={protocol.scope === "general" ? "info" : "sage"}>{protocol.scope}</Badge></Control>
            <Control label="Source"><Badge>{version.sourceType.replaceAll("_", " ")}</Badge></Control>
            <Control label="Usage">{version._count.primaryExperiments} primary runs</Control>
            <Control label="Updated">{protocol.updatedAt.toLocaleDateString()}</Control>
            <div className="sm:col-span-2 xl:col-span-6 flex flex-wrap gap-2 border-t border-hairline pt-3">
              {protocol.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
              {version.derivedFromVersion ? <Link href={`/protocols/${version.derivedFromVersion.protocol.id}?version=${version.derivedFromVersion.id}`} className="text-xs font-medium text-moss hover:underline">Derived from {version.derivedFromVersion.protocol.humanCode ?? version.derivedFromVersion.protocol.title} · {version.derivedFromVersion.displayVersion}</Link> : null}
              {version.previousVersion ? <Link href={`/protocols/${protocol.id}?version=${version.previousVersion.id}`} className="text-xs font-medium text-moss hover:underline">Previous revision {version.previousVersion.displayVersion}</Link> : null}
              {version.sourceFileName ? <span className="font-mono text-xs text-muted">Source: {version.sourceFileName}</span> : null}
            </div>
          </CardBody>
        </Card>

        <ProtocolDocumentView document={document} />

        <Card>
          <CardHeader title="Version history" eyebrow="Immutable lineage" />
          <CardBody>
            <DataTable
              rows={protocol.versions}
              getRowKey={(row) => row.id}
              columns={[
                { key: "version", header: "Version", render: (row) => <Link href={`/protocols/${protocol.id}?version=${row.id}`} className="font-mono font-semibold text-moss hover:underline">{row.displayVersion}</Link> },
                { key: "review", header: "Review", render: (row) => <StatusPill status={row.reviewStage} /> },
                { key: "source", header: "Source", render: (row) => row.sourceType.replaceAll("_", " ") },
                { key: "change", header: "Change", render: (row) => row.changeSummary ?? "—" },
                { key: "created", header: "Created", render: (row) => row.createdAt.toLocaleDateString() },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p><div className="mt-2 text-sm font-medium text-ink">{children}</div></div>;
}
