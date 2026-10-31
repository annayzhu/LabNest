import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SampleForm } from "@/components/SampleForm";
import { prisma } from "@/lib/db";
import { sampleTypeRef } from "@/lib/samples";
import { sampleLocationOptions, sampleTypes } from "@/lib/samples.server";

export const dynamic = "force-dynamic";

export default async function EditSamplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sample = await prisma.sample.findUnique({ where: { id }, include: { type: true, parent: { select: { code: true } } } });
  if (!sample) notFound();
  const [types, locations, projects] = await Promise.all([
    sampleTypes(prisma),
    sampleLocationOptions(prisma),
    prisma.project.findMany({ where: { OR: [{ status: { not: "archived" } }, { id: sample.projectId ?? "" }] }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  // A type turned off since stays selectable for the samples that have it.
  const choices = types.some((type) => type.id === sample.typeId) ? types : [...types, sampleTypeRef(sample.type)];
  const text = (value: number | string | null) => (value === null ? "" : String(value));
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-4">
        <PageHeader identifier={sample.code} title="Edit sample" />
        <SampleForm
          types={choices}
          locations={locations.map((location) => ({ id: location.id, label: location.label, grid: location.geometry ? `${location.geometry.rows}×${location.geometry.columns}` : null }))}
          projects={projects}
          initial={{
            id: sample.id, code: sample.code, name: sample.name, typeId: sample.typeId, origin: text(sample.origin), parentCode: sample.parent?.code ?? "",
            projectId: sample.projectId ?? "", status: sample.status, locationId: sample.locationId ?? "", position: text(sample.position),
            amount: text(sample.amount), amountUnit: text(sample.amountUnit), concentration: text(sample.concentration), concentrationUnit: text(sample.concentrationUnit),
            collectedAt: sample.collectedAt?.toISOString().slice(0, 10) ?? "", biosafetyLevel: text(sample.biosafetyLevel), notes: text(sample.notes),
            fields: (sample.fieldValues && typeof sample.fieldValues === "object" ? sample.fieldValues : {}) as Record<string, string>,
          }}
        />
      </div>
    </AppShell>
  );
}
