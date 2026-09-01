import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SequenceCollectionForm } from "@/components/SequenceCollectionForm";
import { prisma } from "@/lib/db";
import { updateSequenceCollection } from "../../../actions";
import { sequenceCollectionTypes } from "@/lib/sequence-registry";

export const dynamic = "force-dynamic";

export default async function EditSequenceCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [collection, projects, sequences] = await Promise.all([
    prisma.sequenceCollection.findUnique({ where: { id }, include: { members: { orderBy: { order: "asc" } } } }),
    prisma.project.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.sequence.findMany({ include: { versions: { orderBy: { versionNumber: "desc" } } }, orderBy: { name: "asc" } }),
  ]);
  if (!collection) notFound();
  const editableType = sequenceCollectionTypes.find((item) => item.value === collection.type)?.value ?? "other";
  const versions = sequences.flatMap((record) => record.versions.map((version) => ({ id: version.id, sequenceId: record.id, label: `${record.code} · ${record.name} · v${version.displayVersion}`, moleculeType: version.moleculeType, designType: record.designType })));
  return <AppShell><div className="space-y-4"><PageHeader title={`Edit ${collection.name}`} /><SequenceCollectionForm action={updateSequenceCollection} projects={projects} versions={versions} initial={{ id: collection.id, name: collection.name, type: editableType, status: collection.status, description: collection.description, ownershipScope: collection.ownershipScope, projectId: collection.projectId, members: collection.members.map((member) => ({ sequenceVersionId: member.sequenceVersionId, role: member.role, note: member.note ?? "" })) }} /></div></AppShell>;
}
