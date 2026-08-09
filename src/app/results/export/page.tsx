import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StructuredExportWorkspace } from "@/components/StructuredExportWorkspace";
import type { PageSearchParams } from "@/lib/filters";

export default async function ResultsExportPage({ searchParams }: { searchParams: PageSearchParams }) {
  return <AppShell><div className="space-y-4"><PageHeader title="Export Results" /><StructuredExportWorkspace module="results" searchParams={await searchParams} /></div></AppShell>;
}
