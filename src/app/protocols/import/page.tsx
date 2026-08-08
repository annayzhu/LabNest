import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolImportForm } from "@/components/ProtocolImportForm";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export default function ImportProtocolPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Document intake"
          title="Import Protocol"
          description="Import the established LabNest DOCX template into fixed scientific sections while preserving paragraphs, checklists, tables, and warning callouts."
        />
        <Card>
          <CardHeader title="DOCX import" eyebrow="Template-aware parser" />
          <CardBody><ProtocolImportForm /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Validation boundary" eyebrow="No silent correction" />
          <CardBody className="grid gap-3 text-sm leading-6 text-graphite md:grid-cols-2">
            <p>Required sections: Description, Purpose, Background, Material, Steps, Result Templates, and Consumption Rules.</p>
            <p>Filename code/status discrepancies are retained as warnings. Existing identifiers and identical source files are blocked instead of overwritten.</p>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
