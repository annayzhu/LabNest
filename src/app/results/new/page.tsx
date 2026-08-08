import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ResultForm } from "@/components/ResultForm";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { createScientificDocument, resultSections } from "@/lib/scientific-document";
import { createResult } from "../actions";

export const dynamic = "force-dynamic";
export default async function NewResultPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const query = searchParams ? await searchParams : undefined;
  const experimentId = firstSearchParam(query, "experiment");
  const experiments = await prisma.experiment.findMany({ where: { status: { not: "archived" } }, include: { project: { select: { name: true } }, researchPlan: { select: { code: true, title: true } } }, orderBy: { date: "desc" } });
  return <AppShell><div className="space-y-6"><PageHeader eyebrow="Structured evidence" title="New Result" description="Record evidence from one Experiment. Narrative, metrics, small tables and media stay flexible; large tables are registered as independent Datasets after saving." /><ResultForm action={createResult} experiments={experiments} initial={{ experimentId, document: createScientificDocument(resultSections) }} /></div></AppShell>;
}
