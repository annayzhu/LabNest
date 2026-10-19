import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolImportForm } from "@/components/ProtocolImportForm";

export const dynamic = "force-dynamic";

export default function ImportProtocolsPage() {
  return <AppShell><div className="space-y-4"><PageHeader title="Import Protocols" /><ProtocolImportForm /></div></AppShell>;
}
