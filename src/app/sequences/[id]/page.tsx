import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Pencil } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SequenceRelationshipManager } from "@/components/SequenceRelationshipManager";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { collectionTypeLabel, designTypeLabel, validationStatusLabel } from "@/lib/sequence-registry";
import { estimatedMeltingTemperature, estimatedMolecularWeight, gcPercent, reverseComplement, sequenceLength, translateDna } from "@/lib/sequence";

export const dynamic = "force-dynamic";

const actionClass = "focus-ring inline-flex h-9 items-center gap-2 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-3 text-[13px] font-medium text-moss hover:bg-warm";

export default async function SequenceDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: PageSearchParams }) {
  const { id } = await params;
  const query = searchParams ? await searchParams : undefined;
  const requestedVersionId = firstSearchParam(query, "version");
  const [record, entities, projects, plans, protocols, experiments, results] = await Promise.all([
    prisma.sequence.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        versions: { include: { features: { orderBy: { start: "asc" } }, modifications: { orderBy: { order: "asc" } }, collectionMembers: { include: { collection: true } } }, orderBy: { versionNumber: "desc" } },
        entityLinks: {
          include: {
            entity: {
              include: {
                inventoryItems: {
                  include: { location: { select: { name: true } } },
                  orderBy: { updatedAt: "desc" },
                },
              },
            },
          },
          orderBy: [{ isPrimary: "desc" }, { order: "asc" }],
        },
      },
    }),
    prisma.entity.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true, type: true, code: true }, orderBy: [{ type: "asc" }, { name: "asc" }] }),
    prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.researchPlan.findMany({ select: { id: true, code: true, title: true }, orderBy: { updatedAt: "desc" } }),
    prisma.protocol.findMany({ select: { id: true, humanCode: true, title: true }, orderBy: { updatedAt: "desc" } }),
    prisma.experiment.findMany({ select: { id: true, runCode: true, title: true }, orderBy: { date: "desc" } }),
    prisma.result.findMany({ select: { id: true, title: true, resultType: true }, orderBy: { updatedAt: "desc" } }),
  ]);
  if (!record || !record.versions.length) notFound();
  const selectedVersion = record.versions.find((version) => version.id === requestedVersionId) ?? record.versions[0];
  const versionIds = record.versions.map((version) => version.id);
  const itemLinks = await prisma.itemLink.findMany({
    where: { OR: [{ sourceType: "sequence", sourceId: record.id }, { sourceType: "sequence_version", sourceId: { in: versionIds } }] },
    orderBy: { createdAt: "desc" },
  });
  const targetMaps: Record<string, Map<string, string>> = {
    project: new Map(projects.map((item) => [item.id, item.name])),
    research_plan: new Map(plans.map((item) => [item.id, `${item.code} · ${item.title}`])),
    protocol: new Map(protocols.map((item) => [item.id, `${item.title} · ${item.humanCode}`])),
    experiment: new Map(experiments.map((item) => [item.id, `${item.runCode} · ${item.title}`])),
    result: new Map(results.map((item) => [item.id, item.title])),
  };
  const researchLinks = itemLinks.map((link) => ({
    id: link.id,
    targetType: link.targetType,
    targetId: link.targetId,
    targetLabel: targetMaps[link.targetType]?.get(link.targetId) ?? `${link.targetType}:${link.targetId}`,
    linkType: link.linkType,
    note: link.note,
    versionLabel: record.versions.find((version) => version.id === link.sourceId)?.displayVersion,
  }));
  const inventoryItems = record.entityLinks.flatMap((link) => link.entity.inventoryItems.map((item) => ({ ...item, entityName: link.entity.name, entityRole: link.role })));
  const length = sequenceLength(selectedVersion.sequence);
  const unit = selectedVersion.moleculeType === "Protein" ? "aa" : "nt";
  const isNucleicAcid = selectedVersion.moleculeType !== "Protein";
  const nucleicMolecule = selectedVersion.moleculeType === "RNA" ? "RNA" : "DNA";
  const metadata = record.metadataJson && typeof record.metadataJson === "object" && !Array.isArray(record.metadataJson) ? record.metadataJson as Record<string, unknown> : {};
  const currentValidationLabel = validationStatusLabel(selectedVersion.validationStatus);
  const exportBase = new URLSearchParams({ exportScope: "selected", id: record.id, versions: "latest" });

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title={record.name} actions={<><Link href="/sequences" className={actionClass}><ArrowLeft className="h-4 w-4" aria-hidden />Sequences</Link><Link href={`/api/sequences/export?${exportBase.toString()}&format=fasta`} className={actionClass}><Download className="h-4 w-4" aria-hidden />FASTA</Link><Link href={`/sequences/${record.id}/edit`} className={actionClass}><Pencil className="h-4 w-4" aria-hidden />Edit</Link></>} />

        <Card>
          <CardBody className="grid gap-4 py-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <Field label="Sequence code" value={record.code} mono />
            <Field label="Design type" value={<Badge tone="sage">{designTypeLabel(record.designType)}</Badge>} />
            <Field label="Lifecycle" value={<StatusPill status={record.status} />} />
            <Field label="Version shown" value={`v${selectedVersion.displayVersion}`} mono />
            <Field label="Validation" value={<StatusPill status={selectedVersion.validationStatus} />} />
            <Field label="Project" value={record.project ? <Link href={`/projects/${record.project.id}`} className="text-moss hover:underline">{record.project.name}</Link> : "Sequence library"} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Canonical sequence" action={<span className="font-mono text-xs text-muted">5′ → 3′ · {selectedVersion.moleculeType === "Protein" ? "Amino acid" : selectedVersion.moleculeType} · {selectedVersion.topology} · {selectedVersion.strandedness}</span>} />
          <CardBody className="space-y-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-y border-hairline py-2 font-mono text-xs text-muted">
              <span>Length <strong className="text-ink">{length} {unit}</strong></span>
              {isNucleicAcid ? <span>GC <strong className="text-ink">{gcPercent(selectedVersion.sequence)}%</strong></span> : null}
              {isNucleicAcid && estimatedMeltingTemperature(selectedVersion.sequence, nucleicMolecule) !== undefined ? <span>Approx. Tm <strong className="text-ink">{estimatedMeltingTemperature(selectedVersion.sequence, nucleicMolecule)} °C</strong></span> : null}
              <span>Approx. MW <strong className="text-ink">{estimatedMolecularWeight(selectedVersion.sequence, selectedVersion.moleculeType).toLocaleString()} Da</strong></span>
              <span>Checksum <strong className="text-ink">{selectedVersion.checksum.slice(0, 12)}…</strong></span>
            </div>
            <SequenceText sequence={selectedVersion.sequence} />
            {isNucleicAcid ? <details className="rounded-[var(--ln-radius-control-lg)] border border-hairline"><summary className="cursor-pointer px-3 py-2 text-xs font-medium text-moss">Derived views</summary><div className="space-y-3 border-t border-hairline p-3"><DerivedSequence label="Reverse complement" value={reverseComplement(selectedVersion.sequence, nucleicMolecule)} />{selectedVersion.moleculeType === "DNA" ? <DerivedSequence label="Translation from base 1" value={translateDna(selectedVersion.sequence)} /> : null}<p className="text-[11px] text-muted">Derived values are convenience calculations; they do not create or replace an immutable Sequence version.</p></div></details> : null}
          </CardBody>
        </Card>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader title="Features" />
            <CardBody className="space-y-3">
              <FeatureStrip length={length} features={selectedVersion.features} />
              <DataTable rows={selectedVersion.features} getRowKey={(row) => row.id} emptyMessage="No Features are annotated for this version." columns={[
                { key: "name", header: "Feature", render: (row) => <span className="font-medium text-ink">{row.name}</span> },
                { key: "type", header: "Type", render: (row) => <Badge tone="sage">{row.type}</Badge> },
                { key: "coordinates", header: "Coordinates", render: (row) => <span className="font-mono text-xs">{row.start}–{row.end} {row.strand ?? ""}</span> },
                { key: "note", header: "Note", render: (row) => row.note ?? "—" },
              ]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Validation and modifications" />
            <CardBody className="space-y-4">
              <div className="rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm/50 p-3"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{currentValidationLabel}</p><p className="mt-2 text-sm leading-6 text-graphite">{selectedVersion.validationSummary ?? "No validation evidence has been recorded."}</p>{selectedVersion.validatedAt ? <p className="mt-2 text-xs text-muted">Conclusion recorded {selectedVersion.validatedAt.toLocaleDateString()}</p> : null}</div>
              <DataTable rows={selectedVersion.modifications} getRowKey={(row) => row.id} emptyMessage="No chemical modifications recorded." columns={[
                { key: "position", header: "Position", render: (row) => <span className="font-mono text-xs">{row.position}</span> },
                { key: "modification", header: "Modification", render: (row) => row.modification },
                { key: "note", header: "Note", render: (row) => row.note ?? "—" },
              ]} />
            </CardBody>
          </Card>
        </section>

        <Card>
          <CardHeader title="Record metadata" />
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Target / gene" value={record.targetName} />
            <Field label="Organism" value={record.organism} />
            {Object.entries(metadata).map(([key, value]) => <Field key={key} label={key.replace(/([A-Z])/g, " $1")} value={String(value)} />)}
            {record.description ? <div className="sm:col-span-2 lg:col-span-4"><Field label="Description" value={record.description} /></div> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Version history" />
          <CardBody><DataTable rows={record.versions} getRowKey={(row) => row.id} columns={[
            { key: "version", header: "Version", render: (row) => <Link href={`/sequences/${record.id}?version=${row.id}`} className={`record-identifier text-xs ${row.id === selectedVersion.id ? "font-semibold text-moss" : "text-ink hover:text-moss"}`}>v{row.displayVersion}{row.id === record.versions[0].id ? " · latest" : ""}</Link> },
            { key: "created", header: "Created", render: (row) => <span className="whitespace-nowrap text-xs">{row.createdAt.toLocaleString()}</span> },
            { key: "molecule", header: "Molecule", render: (row) => `${row.moleculeType === "Protein" ? "Amino acid" : row.moleculeType} · ${row.sequence.length} ${row.moleculeType === "Protein" ? "aa" : "nt"}` },
            { key: "validation", header: "Validation", render: (row) => <StatusPill status={row.validationStatus} /> },
            { key: "source", header: "Source", render: (row) => <div><p>{row.sourceType.replaceAll("_", " ")}</p><p className="text-xs text-muted">{row.sourceFileName ?? "LabNest editor"}</p></div> },
            { key: "change", header: "Change summary", render: (row) => row.changeSummary ?? "—" },
          ]} /></CardBody>
        </Card>

        {selectedVersion.collectionMembers.length ? <Card><CardHeader title="Sequence Collections" /><CardBody><DataTable rows={selectedVersion.collectionMembers} getRowKey={(row) => row.id} columns={[
          { key: "collection", header: "Collection", render: (row) => <Link href={`/sequences/collections/${row.collection.id}`} className="font-semibold text-ink hover:text-moss">{row.collection.name}</Link> },
          { key: "type", header: "Type", render: (row) => collectionTypeLabel(row.collection.type) },
          { key: "role", header: "Role", render: (row) => <Badge tone="sage">{row.role.replaceAll("_", " ")}</Badge> },
          { key: "status", header: "Lifecycle", render: (row) => <StatusPill status={row.collection.status} /> },
        ]} /></CardBody></Card> : null}

        <SequenceRelationshipManager
          sequenceId={record.id}
          versions={record.versions.map((version) => ({ id: version.id, label: `v${version.displayVersion} · ${version.moleculeType === "Protein" ? "Amino acid" : version.moleculeType} · ${version.sequence.length} ${version.moleculeType === "Protein" ? "aa" : "nt"}` }))}
          entities={entities}
          entityLinks={record.entityLinks.map((link) => ({ id: link.id, entityName: link.entity.name, entityType: link.entity.type, entityCode: link.entity.code, role: link.role, isPrimary: link.isPrimary, versionLabel: record.versions.find((version) => version.id === link.sequenceVersionId)?.displayVersion ?? "?", inventoryCount: link.entity.inventoryItems.length }))}
          researchTargets={{
            project: projects.map((item) => ({ id: item.id, label: item.name })),
            research_plan: plans.map((item) => ({ id: item.id, label: item.title, detail: item.code })),
            protocol: protocols.map((item) => ({ id: item.id, label: item.title, detail: item.humanCode })),
            experiment: experiments.map((item) => ({ id: item.id, label: item.title, detail: item.runCode })),
            result: results.map((item) => ({ id: item.id, label: item.title, detail: item.resultType })),
          }}
          researchLinks={researchLinks}
        />

        {inventoryItems.length ? <Card><CardHeader title="Physical Inventory linked through Entities" /><CardBody><DataTable rows={inventoryItems} getRowKey={(row) => `${row.id}-${row.entityRole}`} columns={[
          { key: "item", header: "Inventory Item", render: (row) => <div><Link href={`/inventory/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.name}</Link><p className="text-xs text-muted">{row.entityName} · {row.entityRole}</p></div> },
          { key: "lot", header: "Lot / aliquot", render: (row) => <span className="font-mono text-xs">{row.lotNumber ?? row.aliquotCode ?? "—"}</span> },
          { key: "quantity", header: "Stock", render: (row) => <span className="font-mono">{row.currentQuantity} {row.unit}</span> },
          { key: "location", header: "Location", render: (row) => `${row.location?.name ?? "Unassigned"}${row.positionCode ? ` · ${row.positionCode}` : ""}` },
          { key: "status", header: "Lifecycle", render: (row) => <StatusPill status={row.status} /> },
        ]} /></CardBody></Card> : null}
      </div>
    </AppShell>
  );
}

function SequenceText({ sequence }: { sequence: string }) {
  const lineWidth = 60;
  const lines = Array.from({ length: Math.ceil(sequence.length / lineWidth) }, (_, index) => ({ start: index * lineWidth + 1, value: sequence.slice(index * lineWidth, (index + 1) * lineWidth) }));
  return <pre data-i18n-ignore className="max-h-[420px] overflow-auto rounded-[var(--ln-radius-control-lg)] bg-warm p-3 font-mono text-xs leading-6 text-graphite">{lines.map((line) => `${String(line.start).padStart(8, " ")}  ${line.value.match(/.{1,10}/g)?.join(" ") ?? ""}`).join("\n")}</pre>;
}

function DerivedSequence({ label, value }: { label: string; value: string }) {
  return <div><p className="mb-1 text-xs font-medium text-muted">{label}</p><pre data-i18n-ignore className="overflow-x-auto rounded-[var(--ln-radius-control-sm)] bg-warm px-2 py-1.5 font-mono text-xs text-graphite">{value || "—"}</pre></div>;
}

function FeatureStrip({ length, features }: { length: number; features: Array<{ id: string; name: string; start: number; end: number; strand: string | null }> }) {
  if (!features.length || !length) return null;
  return <div className="space-y-1.5 rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm/50 p-3" aria-label="Read-only Feature overview">{features.map((feature, index) => { const left = Math.max(0, ((feature.start - 1) / length) * 100); const width = Math.max(1.5, ((feature.end - feature.start + 1) / length) * 100); return <div key={feature.id} className="grid grid-cols-[120px_1fr] items-center gap-3"><span className="truncate text-[11px] text-muted" title={feature.name}>{feature.name}</span><div className="relative h-4 rounded-full bg-stone"><span className="absolute top-0.5 h-3 rounded-full bg-moss/70" style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }} title={`${feature.name}: ${feature.start}–${feature.end} ${feature.strand ?? ""}`} /><span className="sr-only">{index + 1}</span></div></div>; })}<div className="grid grid-cols-[120px_1fr] gap-3"><span /><div className="flex justify-between font-mono text-[10px] text-muted"><span>1</span><span>{length}</span></div></div></div>;
}

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p><div className={`mt-1 text-sm text-ink ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</div></div>;
}
