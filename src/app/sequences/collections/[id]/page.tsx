import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { collectionTypeLabel, validationStatusLabel } from "@/lib/sequence-registry";
import { gcPercent, sequenceLength } from "@/lib/sequence";

export const dynamic = "force-dynamic";

const actionClass = "focus-ring inline-flex h-9 items-center gap-2 rounded-[7px] border border-hairline bg-surface px-3 text-[13px] font-medium text-moss hover:bg-warm";

export default async function SequenceCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const collection = await prisma.sequenceCollection.findUnique({
    where: { id },
    include: { project: { select: { id: true, name: true } }, members: { include: { sequenceVersion: { include: { sequenceRecord: true } } }, orderBy: { order: "asc" } } },
  });
  if (!collection) notFound();
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title={collection.name} actions={<><Link href="/sequences/collections" className={actionClass}><ArrowLeft className="h-4 w-4" aria-hidden />Collections</Link><Link href={`/sequences/collections/${collection.id}/edit`} className={actionClass}><Pencil className="h-4 w-4" aria-hidden />Edit</Link></>} />
        <Card><CardHeader title="Collection identity" action={<StatusPill status={collection.status} />} /><CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field label="Code" value={collection.code} mono /><Field label="Type" value={<Badge tone="sage">{collectionTypeLabel(collection.type)}</Badge>} /><Field label="Project" value={collection.project ? <Link href={`/projects/${collection.project.id}`} className="text-moss hover:underline">{collection.project.name}</Link> : "Shared library"} /><Field label="Members" value={collection.members.length} />{collection.description ? <div className="sm:col-span-2 lg:col-span-4"><Field label="Description" value={collection.description} /></div> : null}</CardBody></Card>
        <Card><CardHeader title="Pinned sequence versions" /><CardBody><DataTable rows={collection.members} getRowKey={(row) => row.id} columns={[
          { key: "role", header: "Role", render: (row) => <Badge tone="sage">{row.role.replaceAll("_", " ")}</Badge> },
          { key: "sequence", header: "Sequence", render: (row) => <div><Link href={`/sequences/${row.sequenceVersion.sequenceRecord.id}?version=${row.sequenceVersion.id}`} className="font-semibold text-ink hover:text-moss">{row.sequenceVersion.sequenceRecord.name}</Link><p className="font-mono text-xs text-muted">{row.sequenceVersion.sequenceRecord.code} · v{row.sequenceVersion.displayVersion}</p></div> },
          { key: "type", header: "Molecule / design", render: (row) => `${row.sequenceVersion.moleculeType === "Protein" ? "Amino acid" : row.sequenceVersion.moleculeType} · ${row.sequenceVersion.sequenceRecord.designType}` },
          { key: "metrics", header: "Length / GC", render: (row) => <span className="font-mono text-xs">{sequenceLength(row.sequenceVersion.sequence)} {row.sequenceVersion.moleculeType === "Protein" ? "aa" : "nt"}{row.sequenceVersion.moleculeType === "Protein" ? "" : ` · GC ${gcPercent(row.sequenceVersion.sequence)}%`}</span> },
          { key: "validation", header: "Validation", render: (row) => <span>{validationStatusLabel(row.sequenceVersion.validationStatus)}</span> },
          { key: "note", header: "Note", render: (row) => row.note ?? "—" },
        ]} /></CardBody></Card>
      </div>
    </AppShell>
  );
}

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p><div className={`mt-1 text-sm text-ink ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</div></div>;
}
