import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { getSequenceRecords } from "@/lib/live-data";
import { gcPercent, reverseComplement, sequenceLength, toFasta, translateDna } from "@/lib/sequence";

export const dynamic = "force-dynamic";

export default async function SequencesPage() {
  const sequences = await getSequenceRecords();
  const sequence = sequences[0];

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Lightweight sequence library"
          title="Sequences"
          description="V1 supports FASTA import/export, length, GC%, reverse complement, translation, and links to entities and experiments. It does not try to be a full plasmid map editor."
        />

        {sequence ? (
          <Card>
            <CardHeader title={sequence.name} eyebrow="Sequence view" action={<Badge tone="sage">{sequence.type}</Badge>} />
            <CardBody className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Metric label="Length" value={`${sequenceLength(sequence.sequence)} bp`} />
                <Metric label="GC%" value={`${gcPercent(sequence.sequence)}%`} />
                <Metric label="Reverse complement" value={reverseComplement(sequence.sequence).slice(0, 12) + "..."} />
                <Metric label="Translation" value={translateDna(sequence.sequence).slice(0, 12) + "..."} />
              </div>
              <pre className="max-h-64 overflow-auto rounded-[10px] border border-hairline bg-warm p-4 font-mono text-xs leading-6 text-graphite">
                {toFasta(sequence.name, sequence.sequence, 64)}
              </pre>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader title="No sequences yet" eyebrow="Sequence view" />
            <CardBody>
              <p className="text-sm text-muted">Import or create a sequence to start the local sequence library.</p>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader title="Sequence Index" eyebrow="Linked objects" />
          <CardBody>
            <DataTable
              rows={sequences}
              getRowKey={(row) => row.id}
              emptyMessage="No sequences have been added yet."
              columns={[
                { key: "name", header: "Name", render: (row) => <span className="font-semibold text-ink">{row.name}</span> },
                { key: "type", header: "Type", render: (row) => <Badge tone="sage">{row.type}</Badge> },
                { key: "length", header: "Length", render: (row) => <span className="font-mono">{sequenceLength(row.sequence)}</span> },
                { key: "linked", header: "Linked entity", render: (row) => row.linkedEntity ?? "none" },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-hairline bg-warm p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 truncate font-mono text-sm text-ink">{value}</p>
    </div>
  );
}
