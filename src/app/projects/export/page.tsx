import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StructuredExportWorkspace } from "@/components/StructuredExportWorkspace";
import type { PageSearchParams } from "@/lib/filters";

export default async function ProjectsExportPage({ searchParams }: { searchParams: PageSearchParams }) {
  return <AppShell><div className="space-y-4"><PageHeader title="Export Projects" /><StructuredExportWorkspace module="projects" searchParams={await searchParams} /></div></AppShell>;
}
