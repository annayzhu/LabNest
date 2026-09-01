import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SequenceForm } from "@/components/SequenceForm";
import { SequencePairForm } from "@/components/SequencePairForm";
import { SequenceTypeChooser } from "@/components/SequenceTypeChooser";
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
  if (!preset) {
    return <AppShell><div className="space-y-4"><PageHeader title="New Sequence" /><SequenceTypeChooser projectId={initialProjectId} /></div></AppShell>;
  }
  const pairModeLinks = preset.pairType === "primer_pair" || preset.designType === "primer" ? (
    <nav aria-label="Primer entry mode" className="flex items-center gap-1 rounded-[8px] border border-hairline bg-surface p-1 text-xs">
      <Link href={`/sequences/new?category=primer${initialProjectId ? `&projectId=${initialProjectId}` : ""}`} className={`rounded-[6px] px-2.5 py-1.5 ${preset.recordKind === "paired" ? "bg-sage-surface font-medium text-moss" : "text-muted hover:bg-warm"}`}>Primer pair</Link>
      <Link href={`/sequences/new?category=single-primer${initialProjectId ? `&projectId=${initialProjectId}` : ""}`} className={`rounded-[6px] px-2.5 py-1.5 ${preset.recordKind === "single" ? "bg-sage-surface font-medium text-moss" : "text-muted hover:bg-warm"}`}>Single primer · advanced</Link>
    </nav>
  ) : null;
  if (preset.recordKind === "paired" && preset.pairType) {
    return <AppShell><div className="space-y-4"><PageHeader title={preset.title} actions={pairModeLinks} /><SequencePairForm action={createSequencePair} projects={projects} pairType={preset.pairType} initialProjectId={initialProjectId} /></div></AppShell>;
  }
  return <AppShell><div className="space-y-4"><PageHeader title={preset.title} actions={pairModeLinks} /><SequenceForm action={createSequence} projects={projects} allowedDesignTypes={preset.allowedDesignTypes} initial={{ entryClass: preset.entryClass, ownershipScope: initialProjectId ? "project" : "library", projectId: initialProjectId, designType: preset.designType, latestVersion: { displayVersion: "1.0", moleculeType: preset.moleculeType, sequence: "", topology: "linear", strandedness: "unknown", validationStatus: "unverified", features: [], modifications: [] } }} /></div></AppShell>;
}
