import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SequenceWorkflowForm } from "@/components/SequenceWorkflowForm";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { sequenceWorkflowLabel } from "@/lib/sequence-entry";
import { createSequenceWorkflow } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewSequenceWorkflowPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const requestedType = firstSearchParam(params, "type");
  const type = requestedType === "assembly" || requestedType === "crispr" ? requestedType : "alignment";
  const initialProjectId = firstSearchParam(params, "projectId");
  const [projects, records] = await Promise.all([
    prisma.project.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.sequence.findMany({ where: { pairMembership: { is: null } }, select: { name: true, code: true, versions: { select: { id: true, displayVersion: true, moleculeType: true, sequence: true }, orderBy: { versionNumber: "desc" }, take: 1 } }, orderBy: { name: "asc" } }),
  ]);
  const versions = records.flatMap((record) => record.versions.map((version) => ({ id: version.id, label: record.name, detail: `${record.code} · v${version.displayVersion} · ${version.moleculeType} · ${version.sequence.length}` })));
  return <AppShell><div className="space-y-4"><PageHeader title={`New ${sequenceWorkflowLabel(type)}`} /><SequenceWorkflowForm action={createSequenceWorkflow} type={type} projects={projects} versions={versions} initialProjectId={initialProjectId} /></div></AppShell>;
}
