import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ResultForm } from "@/components/ResultForm";
import { prisma } from "@/lib/db";
import { normalizeScientificDocument, resultSections } from "@/lib/scientific-document";
import { updateResult } from "../../actions";

export const dynamic = "force-dynamic";
export default async function EditResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await prisma.result.findUnique({ where: { id } });
  if (!result || !result.experimentId) notFound();
  const experiments = await prisma.experiment.findMany({ where: { id: result.experimentId }, include: { project: { select: { name: true } }, researchPlan: { select: { code: true, title: true } } } });
  return <AppShell><div className="space-y-6"><PageHeader eyebrow={result.resultType} title={`Edit ${result.title}`} description="The originating Experiment is locked to protect provenance; evidence content and QC status remain editable." /><ResultForm action={updateResult} experiments={experiments} lockedExperiment initial={{ ...result, document: normalizeScientificDocument(result.contentJson, resultSections) }} /></div></AppShell>;
}
