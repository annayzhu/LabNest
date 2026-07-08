import { AppShell } from "@/components/AppShell";
import { ManualAiWorkbench } from "@/components/ManualAiWorkbench";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export default function ManualAiPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Manual AI"
          title="Copy-Paste Workbench"
          description="Use ChatGPT or Claude in the browser; LabNest only validates proposed actions."
        />

        <Card>
          <CardHeader title="Prompt and Validation" eyebrow="No API key required" />
          <CardBody>
            <ManualAiWorkbench />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
