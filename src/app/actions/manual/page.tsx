import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ManualAiWorkbench } from "@/components/ManualAiWorkbench";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { getAIAvailability } from "@/lib/ai-server";

export const dynamic = "force-dynamic";

export default async function ManualAiPage() {
  const ai = await getAIAvailability();
  const enabled = ai.enabled;

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
            {enabled ? (
              <ManualAiWorkbench connected={ai.connected && ai.providerName ? { providerName: ai.providerName, model: ai.model } : undefined} />
            ) : (
              <div className="rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm p-5">
                <p className="text-sm leading-6 text-graphite">AI workflows are currently disabled. Manual records, protocols, experiments, inventory, and results remain fully available.</p>
                <Link href="/settings" className="focus-ring mt-4 inline-flex h-9 items-center rounded-[var(--ln-radius-control-lg)] border border-moss px-3 text-sm font-medium text-moss">Review AI settings</Link>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
