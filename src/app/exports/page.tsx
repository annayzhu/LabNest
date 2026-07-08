import { DatabaseBackup, Download } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";

const exports = [
  {
    id: "inventory",
    title: "Inventory",
    format: "CSV",
    href: "/api/exports/inventory.csv",
    scope: "Items, aliquots, lots, locations, quantities",
  },
  {
    id: "results",
    title: "Results",
    format: "CSV",
    href: "/api/exports/results.csv",
    scope: "Result records with experiment, entity, and project labels",
  },
  {
    id: "entities",
    title: "Entities",
    format: "CSV",
    href: "/api/exports/entities.csv",
    scope: "Plasmids, primers, samples, antibodies, and linked sequences",
  },
  {
    id: "protocols",
    title: "Protocols",
    format: "JSON",
    href: "/api/exports/protocols.json",
    scope: "Protocol records and every protocol version",
  },
  {
    id: "backup",
    title: "Full Backup",
    format: "JSON",
    href: "/api/exports/backup.json",
    scope: "Portable metadata snapshot; file binaries remain in attachment storage",
  },
];

export default function ExportsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Portability"
          title="Exports"
          description="Download reviewable tables and a local-first JSON snapshot."
        />

        <Card>
          <CardHeader title="Available Exports" eyebrow="Database-backed" />
          <CardBody>
            <DataTable
              rows={exports}
              getRowKey={(row) => row.id}
              columns={[
                {
                  key: "name",
                  header: "Export",
                  render: (row) => (
                    <div className="flex items-start gap-3">
                      <DatabaseBackup className="mt-0.5 h-4 w-4 shrink-0 text-moss" aria-hidden />
                      <div>
                        <p className="font-semibold text-ink">{row.title}</p>
                        <p className="mt-1 text-xs text-muted">{row.scope}</p>
                      </div>
                    </div>
                  ),
                },
                { key: "format", header: "Format", render: (row) => <Badge tone="sage">{row.format}</Badge> },
                {
                  key: "download",
                  header: "",
                  render: (row) => (
                    <a
                      href={row.href}
                      className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-hairline bg-surface px-3 text-sm font-medium text-moss transition hover:bg-sage-surface"
                    >
                      <Download className="h-4 w-4" aria-hidden />
                      Download
                    </a>
                  ),
                },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
