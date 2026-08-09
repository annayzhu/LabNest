import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StructuredImportWorkspace } from "@/components/StructuredImportWorkspace";
export default function Page() { return <AppShell><div className="space-y-4"><PageHeader title="Import Reports" /><StructuredImportWorkspace module="reports" /></div></AppShell>; }
