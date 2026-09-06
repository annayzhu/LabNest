import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CalculatorWorkbench } from "@/components/calculators/CalculatorWorkspace";
import { getCalculatorCatalog, getCalculatorDefinition } from "@/lib/calculators/calculator-engine";

export function generateStaticParams() {
  return getCalculatorCatalog().map((tool) => ({ calculatorId: tool.id }));
}

export default async function CalculatorToolPage({
  params,
  searchParams,
}: {
  params: Promise<{ calculatorId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { calculatorId } = await params;
  if (!getCalculatorCatalog().some((tool) => tool.id === calculatorId)) notFound();
  const query = await searchParams;
  const allowed = new Set([...getCalculatorDefinition(calculatorId).fields.flatMap(field => [field.key, `${field.key}Unit`]), "record", "experimentId", "experimentStepId", "fold", "stockToTargetFactor", "finalVolumeMl", "volumeUnit", "plates"]);
  const initialInputs = Object.fromEntries(
    Object.entries(query)
      .filter(([key, value]) => allowed.has(key) && typeof value === "string" && value.length <= 10000)
      .map(([key, value]) => [key, value as string]),
  );
  const plateContext = query.source === "plate" && typeof query.workspaceId === "string" && typeof query.plateId === "string" && typeof query.plateName === "string" && typeof query.wellIds === "string"
    ? { workspaceId: query.workspaceId, plateId: query.plateId, plateName: query.plateName, plateSize: Number(query.plateSize) || 0, wellIds: query.wellIds.split(",").filter(Boolean) }
    : undefined;
  const embedded = query.embed === "plate" || query.embed === "step";
  const embeddedLocale = query.locale === "zh" || query.locale === "en" ? query.locale : undefined;
  if (embedded) {
    return <main className="min-h-screen bg-warm/35 p-3 sm:p-5"><CalculatorWorkbench calculatorId={calculatorId} initialInputs={initialInputs} plateContext={plateContext} embedded embeddedLocale={embeddedLocale} /></main>;
  }
  return <AppShell><CalculatorWorkbench calculatorId={calculatorId} initialInputs={initialInputs} plateContext={plateContext} /></AppShell>;
}
