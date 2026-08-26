import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CalculatorWorkbench } from "@/components/calculators/CalculatorWorkspace";
import { getCalculatorCatalog } from "@/lib/calculators/calculator-engine";

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
  const initialInputs = Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => [key, value as string]),
  );
  const plateContext = query.source === "plate" && typeof query.workspaceId === "string" && typeof query.plateId === "string" && typeof query.plateName === "string" && typeof query.wellIds === "string"
    ? { workspaceId: query.workspaceId, plateId: query.plateId, plateName: query.plateName, plateSize: Number(query.plateSize) || 0, wellIds: query.wellIds.split(",").filter(Boolean) }
    : undefined;
  const embedded = query.embed === "plate";
  const embeddedLocale = query.locale === "zh" || query.locale === "en" ? query.locale : undefined;
  if (embedded) {
    return <main className="min-h-screen bg-warm/35 p-3 sm:p-5"><CalculatorWorkbench calculatorId={calculatorId} initialInputs={initialInputs} plateContext={plateContext} embedded embeddedLocale={embeddedLocale} /></main>;
  }
  return <AppShell><CalculatorWorkbench calculatorId={calculatorId} initialInputs={initialInputs} plateContext={plateContext} /></AppShell>;
}
