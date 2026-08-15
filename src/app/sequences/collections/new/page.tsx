import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SequenceCollectionForm } from "@/components/SequenceCollectionForm";
import { prisma } from "@/lib/db";
import { createSequenceCollection } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewSequenceCollectionPage() {
  const [projects, sequences] = await Promise.all([
    prisma.project.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.sequence.findMany({ where: { status: { not: "archived" } }, include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } }, orderBy: { name: "asc" } }),
  ]);
  const versions = sequences.flatMap((record) => record.versions.map((version) => ({ id: version.id, sequenceId: record.id, label: `${record.code} · ${record.name} · v${version.displayVersion}`, moleculeType: version.moleculeType, designType: record.designType })));
  return <AppShell><div className="space-y-4"><PageHeader title="New Sequence Collection" /><SequenceCollectionForm action={createSequenceCollection} projects={projects} versions={versions} /></div></AppShell>;
}
