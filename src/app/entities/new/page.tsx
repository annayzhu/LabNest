import { AppShell } from "@/components/AppShell";
import { EntityCreateForm } from "@/components/EntityCreateForm";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { createEntity } from "../actions";

export const dynamic = "force-dynamic";
const types = ["plasmid", "primer", "oligo", "cell_line", "antibody", "protein", "reagent", "compound", "bacteria", "mixture", "sample", "other"] as const;

export default async function NewEntityPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const requestedType = firstSearchParam(params, "type");
  const initialType = types.includes(requestedType as typeof types[number]) ? requestedType as typeof types[number] : "other";
  const mixtureKind = firstSearchParam(params, "mixtureKind") === "preparation" ? "preparation" : initialType === "mixture" ? "recipe" : undefined;
  const initialProjectId = firstSearchParam(params, "projectId");
  const [projects, schemas] = await Promise.all([
    prisma.project.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.scientificSchemaDefinition.findMany({ where: { enabled: true }, select: { key: true, label: true, entityType: true }, orderBy: { label: "asc" } }),
  ]);
  return <AppShell><div className="space-y-4"><PageHeader title={initialType === "mixture" ? `New Mixture ${mixtureKind}` : "New Entity from schema"} /><EntityCreateForm action={createEntity} projects={projects} schemas={schemas} initialType={initialType} initialMixtureKind={mixtureKind} initialProjectId={initialProjectId} /></div></AppShell>;
}
