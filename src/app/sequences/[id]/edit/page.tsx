import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SequenceForm, type SequenceFormInitial } from "@/components/SequenceForm";
import { prisma } from "@/lib/db";
import { updateSequence } from "../../actions";

export const dynamic = "force-dynamic";

function jsonRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export default async function EditSequencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [record, projects] = await Promise.all([
    prisma.sequence.findUnique({ where: { id }, include: { versions: { include: { features: { orderBy: { start: "asc" } }, modifications: { orderBy: { order: "asc" } } }, orderBy: { versionNumber: "desc" }, take: 1 } } }),
    prisma.project.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const latest = record?.versions[0];
  if (!record || !latest) notFound();
  const initial: SequenceFormInitial = {
    id: record.id,
    name: record.name,
    entryClass: record.entryClass,
    ownershipScope: record.ownershipScope,
    designType: record.designType,
    status: record.status,
    description: record.description,
    projectId: record.projectId,
    targetName: record.targetName,
    organism: record.organism,
    metadata: jsonRecord(record.metadataJson),
    latestVersion: {
      displayVersion: latest.displayVersion,
      moleculeType: latest.moleculeType,
      sequence: latest.sequence,
      topology: latest.topology,
      strandedness: latest.strandedness,
      validationStatus: latest.validationStatus,
      validationSummary: latest.validationSummary,
      features: latest.features.map(({ name, type, start, end, strand, note }) => ({ name, type, start, end, strand: strand ?? "", note: note ?? "" })),
      modifications: latest.modifications.map(({ position, modification, note }) => ({ position, modification, note: note ?? "" })),
    },
  };
  return <AppShell><div className="space-y-4"><PageHeader title={`Edit ${record.name}`} /><SequenceForm action={updateSequence} projects={projects} initial={initial} /></div></AppShell>;
}
