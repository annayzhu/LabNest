import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SampleEntryTable } from "@/components/SampleEntryTable";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { suggestedOutputType } from "@/lib/experiment-samples";
import { isRecordLocked } from "@/lib/record-lifecycle";
import { normalizeResultTemplate, resultDatasetValuesFromResultValues } from "@/lib/result-templates";
import { normalizePosition, type SampleRowInput } from "@/lib/samples";
import { sampleLocationOptions, sampleTypes } from "@/lib/samples.server";

export const dynamic = "force-dynamic";

/** The experiment's per-sample result tables (S11), as headers and text cells; a number with a unit keeps its unit. */
async function experimentResultTables(experimentId: string) {
  const results = await prisma.result.findMany({ where: { experimentId }, select: { id: true, title: true, valuesJson: true, templateSnapshotJson: true }, orderBy: { updatedAt: "desc" } });
  return results.flatMap((result) => {
    const template = normalizeResultTemplate(result.templateSnapshotJson);
    return Object.entries(resultDatasetValuesFromResultValues(result.valuesJson)).flatMap(([key, rows]) => {
      if (!rows.length) return [];
      const dataset = template.datasets?.find((candidate) => candidate.key === key);
      const columns = dataset?.columns.length ? dataset.columns.map((column) => ({ key: column.key, label: column.label ?? column.key, unit: column.unit })) : Object.keys(rows[0]).map((column) => ({ key: column, label: column, unit: undefined }));
      return [{
        key: `${result.id}:${key}`,
        label: `${result.title} · ${dataset?.label ?? key}`,
        headers: columns.map((column) => column.label),
        rows: rows.map((row) => columns.map((column) => {
          const value = row[column.key];
          if (value === null || value === undefined || value === "") return "";
          return typeof value === "number" && column.unit ? `${value} ${column.unit}` : String(value);
        })),
      }];
    });
  });
}

export default async function NewSamplesPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const experimentId = firstSearchParam(params, "experiment");
  const aliquotId = firstSearchParam(params, "aliquot");
  const requestedType = firstSearchParam(params, "type");
  const [types, locations, projects, held] = await Promise.all([
    sampleTypes(prisma),
    sampleLocationOptions(prisma),
    prisma.project.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.sample.findMany({ where: { position: { not: null }, locationId: { not: null } }, select: { locationId: true, position: true } }),
  ]);
  const occupied: Record<string, string[]> = {};
  for (const sample of held) (occupied[sample.locationId!] ??= []).push(normalizePosition(sample.position));

  let initialRows: SampleRowInput[] = [];
  let defaultTypeId = types.some((type) => type.id === requestedType) ? requestedType : undefined;
  let experiment: { id: string; runCode: string; title: string; projectId: string | null } | undefined;
  let aliquot: { id: string; code: string; name: string; amount: number | null; amountUnit: string | null } | undefined;
  let resultTables: Awaited<ReturnType<typeof experimentResultTables>> = [];

  if (experimentId) {
    const found = await prisma.experiment.findUnique({
      where: { id: experimentId },
      select: {
        id: true, runCode: true, title: true, projectId: true, status: true, recordStatus: true,
        primaryProtocolVersion: { select: { title: true } },
        samples: { where: { role: "input" }, orderBy: { sortOrder: "asc" }, include: { sample: { select: { code: true, name: true } } } },
      },
    });
    if (!found) notFound();
    if (found.status === "archived" || isRecordLocked(found.recordStatus)) {
      return <AppShell><div className="space-y-4"><PageHeader title="Register outputs" /><p className="text-sm text-muted">This Experiment is locked; its samples cannot change.</p><Link href={`/experiments/${found.id}`} className="text-sm text-moss hover:underline">Back to the experiment</Link></div></AppShell>;
    }
    experiment = { id: found.id, runCode: found.runCode, title: found.title, projectId: found.projectId };
    // One output per input by default (S11): the input is its parent and lends its name.
    initialRows = found.samples.map((link) => ({ name: link.sample.name, parentCode: link.sample.code }));
    resultTables = await experimentResultTables(found.id);
    const suggested = suggestedOutputType([found.title, found.primaryProtocolVersion?.title]);
    defaultTypeId ??= types.find((type) => type.key === suggested)?.id;
  } else if (aliquotId) {
    const parent = await prisma.sample.findUnique({ where: { id: aliquotId } });
    if (!parent) notFound();
    aliquot = { id: parent.id, code: parent.code, name: parent.name, amount: parent.amount, amountUnit: parent.amountUnit };
    const count = Math.min(50, Math.max(1, Number(firstSearchParam(params, "count")) || 2));
    defaultTypeId = types.some((type) => type.id === parent.typeId) ? parent.typeId : defaultTypeId;
    initialRows = Array.from({ length: count }, (_, index) => ({ name: `${parent.name}-${index + 1}`, parentCode: parent.code, typeId: parent.typeId, amountUnit: parent.amountUnit ?? undefined, concentration: parent.concentration === null ? undefined : String(parent.concentration), concentrationUnit: parent.concentrationUnit ?? undefined, biosafetyLevel: parent.biosafetyLevel ?? undefined }));
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title={experiment ? "Register outputs" : aliquot ? "Aliquot" : "New samples"} />
        <SampleEntryTable
          types={types}
          locations={locations.map((location) => ({ id: location.id, label: location.label, name: location.name, geometry: location.geometry }))}
          occupied={occupied}
          projects={projects}
          initialRows={initialRows}
          defaultTypeId={defaultTypeId}
          experiment={experiment}
          aliquot={aliquot}
          resultTables={resultTables}
        />
      </div>
    </AppShell>
  );
}
