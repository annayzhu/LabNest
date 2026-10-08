import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StructuredImportWorkspace } from "@/components/StructuredImportWorkspace";
import { getAIAvailability } from "@/lib/ai-server";

export const dynamic = "force-dynamic";

export default async function ImportProtocolsPage() {
  const ai = await getAIAvailability();
  return <AppShell><div className="space-y-4"><PageHeader title="Import Protocols" /><StructuredImportWorkspace module="protocols" aiProviderName={ai.connected ? ai.providerName : undefined} /></div></AppShell>;
}
