import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StructuredImportWorkspace } from "@/components/StructuredImportWorkspace";
export default function Page() { return <AppShell><div className="space-y-4"><PageHeader title="Import Projects" /><StructuredImportWorkspace module="projects" /></div></AppShell>; }
