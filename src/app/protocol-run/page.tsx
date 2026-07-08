import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolRunStep } from "@/components/ProtocolSection";
import { ProposedActionCard } from "@/components/ProposedActionCard";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { cellTransfectionVersion, experiments, proposedActions } from "@/lib/demo-data";
import { createProtocolRunPreview } from "@/lib/protocol";

export default function ProtocolRunPage() {
  const preview = createProtocolRunPreview(cellTransfectionVersion, {
    well_count: 2,
    cell_line: "HEK293T",
    plasmid: "pLenti-GFP",
  });
  const experiment = experiments[0];

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Wet-lab run mode"
          title="Protocol Run"
          description="A mobile-friendly run surface for parameter review, checklist execution, deviations, quick notes, calculated consumption, and result forms."
        />

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader title={experiment.title} eyebrow="Run context" />
            <CardBody className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <InfoTile label="Protocol" value={cellTransfectionVersion.title} />
                <InfoTile label="Version" value={`v${cellTransfectionVersion.versionNumber}`} />
                <InfoTile label="Status" value={experiment.status} />
              </div>
              <div className="rounded-[10px] border border-hairline bg-warm p-4">
                <h3 className="font-serif text-xl font-medium text-ink">Parameters</h3>
                <div className="mt-3 grid gap-2">
                  {[
                    ["well_count", "2"],
                    ["cell_line", "HEK293T"],
                    ["plasmid", "pLenti-GFP"],
                  ].map(([name, value]) => (
                    <div key={name} className="flex items-center justify-between rounded-[8px] bg-surface px-3 py-2">
                      <span className="font-mono text-xs text-muted">{name}</span>
                      <span className="text-sm font-semibold text-ink">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[10px] border border-hairline bg-warm p-4">
                <h3 className="font-serif text-xl font-medium text-ink">Quick note</h3>
                <textarea
                  className="focus-ring mt-3 min-h-28 w-full resize-y rounded-[10px] border border-hairline bg-surface px-3 py-2 text-sm leading-6 text-ink placeholder:text-muted"
                  placeholder="Record observation, deviation, or photo context..."
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Step Checklist" eyebrow="Current run" />
            <CardBody className="space-y-3">
              {experiment.steps.map((step) => (
                <ProtocolRunStep key={step.id} step={step} />
              ))}
            </CardBody>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader title="Calculated Consumption" eyebrow="No transaction yet" />
            <CardBody>
              <DataTable
                rows={preview.consumption}
                getRowKey={(row) => row.materialName}
                columns={[
                  { key: "material", header: "Material", render: (row) => <span className="font-semibold text-ink">{row.materialName}</span> },
                  {
                    key: "quantity",
                    header: "Quantity",
                    render: (row) => (
                      <span className="font-mono">
                        {row.quantity} {row.unit}
                      </span>
                    ),
                  },
                  { key: "formula", header: "Formula", render: (row) => <span className="font-mono text-xs">{row.formula}</span> },
                  { key: "status", header: "Status", render: () => <Badge tone="warning">proposed only</Badge> },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Result Template" eyebrow="Structured capture" />
            <CardBody className="space-y-3">
              {cellTransfectionVersion.resultTemplates[0].fields.map((field) => (
                <label key={field.name} className="block rounded-[10px] border border-hairline bg-warm p-3">
                  <span className="text-sm font-semibold text-ink">
                    {field.name.replaceAll("_", " ")}
                    {field.required ? " *" : ""}
                  </span>
                  <input
                    className="focus-ring mt-2 h-10 w-full rounded-[8px] border border-hairline bg-surface px-3 text-sm"
                    placeholder={field.unit ? `unit: ${field.unit}` : field.type}
                  />
                </label>
              ))}
            </CardBody>
          </Card>
        </section>

        <Card>
          <CardHeader title="Pending Run Actions" eyebrow="Review before execution" />
          <CardBody className="grid gap-3 lg:grid-cols-2">
            {proposedActions.slice(0, 2).map((action) => (
              <ProposedActionCard key={action.id} action={action} />
            ))}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-hairline bg-warm p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
