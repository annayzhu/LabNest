import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SequencePairEditForm } from "@/components/SequencePairEditForm";
import { prisma } from "@/lib/db";
import { updateSequencePair } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function EditSequencePairPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [pair, projects] = await Promise.all([
    prisma.sequencePair.findUnique({ where: { id } }),
    prisma.project.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!pair) notFound();
  const metadata = pair.metadataJson && typeof pair.metadataJson === "object" && !Array.isArray(pair.metadataJson) ? pair.metadataJson as Record<string, unknown> : {};
  return <AppShell><div className="space-y-4"><PageHeader title={`Edit ${pair.name}`} /><SequencePairEditForm action={updateSequencePair} projects={projects} initial={{ id: pair.id, pairType: pair.type, name: pair.name, organism: pair.organism, ownershipScope: pair.ownershipScope, projectId: pair.projectId, status: pair.status, description: pair.description, metadata }} /></div></AppShell>;
}
