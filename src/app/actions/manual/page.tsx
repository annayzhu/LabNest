import { AppShell } from "@/components/AppShell";
import { ManualAiWorkbench } from "@/components/ManualAiWorkbench";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { getAIAvailability } from "@/lib/ai-server";

export const dynamic = "force-dynamic";

export default async function ManualAiPage() {
  const ai = await getAIAvailability();

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Manual AI"
          title="Copy-Paste Workbench"
          description="Only explicitly submitted context leaves LabNest. Model output is validated as proposed actions and never executes automatically."
        />
        <Card>
          <CardHeader title="Prompt and validation" eyebrow="Explicit context only" />
          <CardBody>
            <ManualAiWorkbench connected={ai.connected && ai.providerName ? { providerName: ai.providerName, model: ai.model } : undefined} />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
