import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StructuredImportWorkspace } from "@/components/StructuredImportWorkspace";

export default function ImportProtocolsPage() {
  return <AppShell><div className="space-y-4"><PageHeader title="Import Protocols" /><StructuredImportWorkspace module="protocols" /></div></AppShell>;
}
