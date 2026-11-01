import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StructuredImportWorkspace } from "@/components/StructuredImportWorkspace";
export default function Page() {
  return (
    <AppShell>
      <PageHeader title="Import purchases" />
      <StructuredImportWorkspace module="purchases" />
    </AppShell>
  );
}
