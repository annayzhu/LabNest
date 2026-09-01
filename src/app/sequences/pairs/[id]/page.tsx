import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { pairTypeLabel } from "@/lib/sequence-registry";
import { sequencePairMetadataFields } from "@/lib/sequence-entry";
import { estimatedMeltingTemperature, gcPercent, sequenceLength } from "@/lib/sequence";

export const dynamic = "force-dynamic";

const actionClass = "focus-ring inline-flex h-9 items-center gap-2 rounded-[7px] border border-hairline bg-surface px-3 text-[13px] font-medium text-moss hover:bg-warm";

export default async function SequencePairDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pair = await prisma.sequencePair.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true } },
      members: {
        include: {
          sequenceRecord: { select: { code: true, name: true } },
          sequenceVersion: { include: { modifications: { orderBy: { order: "asc" } } } },
        },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!pair || pair.members.length !== 2) notFound();
  const metadata = pair.metadataJson && typeof pair.metadataJson === "object" && !Array.isArray(pair.metadataJson) ? pair.metadataJson as Record<string, unknown> : {};
  const exportBase = new URLSearchParams({ exportScope: "selected", id: pair.id, versions: "latest" });

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title={pair.name} actions={<><Link href="/sequences" className={actionClass}><ArrowLeft className="h-4 w-4" aria-hidden />Sequences</Link><Link href={`/api/sequences/export?${exportBase.toString()}&format=fasta`} className={actionClass}><Download className="h-4 w-4" aria-hidden />FASTA</Link></>} />
        <Card>
          <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
            <Badge tone="sage">{pairTypeLabel(pair.type)}</Badge>
            <StatusPill status={pair.status} />
            <span className="text-sm text-graphite">{pair.project ? <Link href={`/projects/${pair.project.id}`} className="text-moss hover:underline">{pair.project.name}</Link> : "Sequence library"}</span>
            {pair.targetName ? <span className="text-sm text-graphite">Target: <strong className="font-medium text-ink">{pair.targetName}</strong></span> : null}
            {pair.organism ? <span className="text-sm text-graphite">{pair.organism}</span> : null}
            <span className="ml-auto font-mono text-[10px] text-muted/70" title="Internal Sequence pair code">{pair.code}</span>
            <span className="text-[10px] text-muted">Created {pair.createdAt.toLocaleString()} · Updated {pair.updatedAt.toLocaleString()}</span>
          </CardBody>
        </Card>
        <section className="grid gap-4 lg:grid-cols-2">
          {pair.members.map((member) => <PairMemberCard key={member.id} member={member} />)}
        </section>
        {Object.keys(metadata).some((key) => !["sourceType", "sourceFileName"].includes(key) && metadata[key]) ? <Card><CardHeader title="Design details" /><CardBody className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {pairMetadataRows(pair.type, metadata).map((item) => <div key={item.label}><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">{item.label}</p><p className="mt-1 text-sm text-ink">{item.value}</p></div>)}
        </CardBody></Card> : null}
        {pair.description ? <Card><CardHeader title="Notes" /><CardBody><p className="whitespace-pre-wrap text-sm leading-6 text-graphite">{pair.description}</p></CardBody></Card> : null}
        <p className="rounded-[8px] border border-hairline bg-warm/50 px-3 py-2 text-xs leading-5 text-muted">This pair is one Sequence entry. Its two exact member versions remain available for provenance and FASTA export, but are not listed as separate library entries.</p>
      </div>
    </AppShell>
  );
}

function pairMetadataRows(type: "primer_pair" | "sirna_duplex", metadata: Record<string, unknown>) {
  return sequencePairMetadataFields(type).flatMap((field) => metadata[field.key] === undefined || metadata[field.key] === "" ? [] : [{ label: field.label.replace(" (bp)", ""), value: `${String(metadata[field.key])}${field.unit ? ` ${field.unit}` : ""}` }]);
}

function PairMemberCard({ member }: { member: {
  role: string;
  note: string | null;
  sequenceRecord: { code: string; name: string };
  sequenceVersion: {
    displayVersion: string;
    moleculeType: "DNA" | "RNA" | "Protein";
    sequence: string;
    validationStatus: string;
    validationSummary: string | null;
    modifications: Array<{ id: string; position: string; modification: string; note: string | null }>;
  };
} }) {
  const version = member.sequenceVersion;
  const molecule = version.moleculeType === "RNA" ? "RNA" : "DNA";
  const tm = estimatedMeltingTemperature(version.sequence, molecule);
  return (
    <Card>
      <CardHeader title={roleLabel(member.role)} action={<span className="font-mono text-[10px] text-muted/70">v{version.displayVersion} · {member.sequenceRecord.code}</span>} />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-y border-hairline py-2 font-mono text-xs text-muted">
          <span>Length <strong className="text-ink">{sequenceLength(version.sequence)} nt</strong></span>
          <span>GC <strong className="text-ink">{gcPercent(version.sequence)}%</strong></span>
          {tm === undefined ? null : <span>Approx. Tm <strong className="text-ink">{tm} °C</strong></span>}
          <span className="ml-auto"><StatusPill status={version.validationStatus} /></span>
        </div>
        <SequenceText sequence={version.sequence} />
        {version.validationSummary ? <p className="text-xs leading-5 text-graphite">{version.validationSummary}</p> : null}
        {version.modifications.length ? <DataTable rows={version.modifications} getRowKey={(row) => row.id} columns={[
          { key: "position", header: "Position", render: (row) => <span className="font-mono text-xs">{row.position}</span> },
          { key: "modification", header: "Modification", render: (row) => row.modification },
          { key: "note", header: "Note", render: (row) => row.note ?? "—" },
        ]} /> : null}
        {member.note ? <p className="text-xs text-muted">{member.note}</p> : null}
      </CardBody>
    </Card>
  );
}

function SequenceText({ sequence }: { sequence: string }) {
  const lines = Array.from({ length: Math.ceil(sequence.length / 60) }, (_, index) => ({ start: index * 60 + 1, value: sequence.slice(index * 60, (index + 1) * 60) }));
  return <pre data-i18n-ignore className="max-h-[300px] overflow-auto rounded-[8px] bg-warm p-3 font-mono text-xs leading-6 text-graphite">{lines.map((line) => `${String(line.start).padStart(8, " ")}  ${line.value.match(/.{1,10}/g)?.join(" ") ?? ""}`).join("\n")}</pre>;
}

function roleLabel(role: string) {
  return role === "forward" ? "Forward primer" : role === "reverse" ? "Reverse primer" : role === "sense" ? "Sense strand" : role === "antisense" ? "Antisense strand" : role.replaceAll("_", " ");
}
