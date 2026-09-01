import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SequenceForm } from "@/components/SequenceForm";
import { SequencePairForm } from "@/components/SequencePairForm";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { sequenceCreationPreset } from "@/lib/sequence-entry";
import { createSequence, createSequencePair } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewSequencePage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const preset = sequenceCreationPreset(firstSearchParam(params, "category"));
  const initialProjectId = firstSearchParam(params, "projectId");
  const projects = await prisma.project.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  if (preset.recordKind === "paired" && preset.pairType) {
    return <AppShell><div className="space-y-4"><PageHeader title={preset.title} /><SequencePairForm action={createSequencePair} projects={projects} pairType={preset.pairType} initialProjectId={initialProjectId} /></div></AppShell>;
  }
  return <AppShell><div className="space-y-4"><PageHeader title={preset.title} /><SequenceForm action={createSequence} projects={projects} initial={{ entryClass: preset.entryClass, ownershipScope: initialProjectId ? "project" : "library", projectId: initialProjectId, designType: preset.designType, latestVersion: { displayVersion: "1.0", moleculeType: preset.moleculeType, sequence: "", topology: "linear", strandedness: "unknown", validationStatus: "unverified", features: [], modifications: [] } }} /></div></AppShell>;
}
