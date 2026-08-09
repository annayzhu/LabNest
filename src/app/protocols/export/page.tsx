import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StructuredExportWorkspace } from "@/components/StructuredExportWorkspace";
import type { PageSearchParams } from "@/lib/filters";

export default async function ProtocolsExportPage({ searchParams }: { searchParams: PageSearchParams }) {
  return <AppShell><div className="space-y-4"><PageHeader title="Export Protocols" /><StructuredExportWorkspace module="protocols" searchParams={await searchParams} /></div></AppShell>;
}
