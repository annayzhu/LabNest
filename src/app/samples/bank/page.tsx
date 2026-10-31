import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SampleBankSearchForm } from "@/components/SampleBankSearchForm";
import { SampleNav } from "@/components/SampleNav";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { sampleBankQuerySchema } from "@/lib/sample-bank/contract";
import { searchState, searchStateLabels } from "@/lib/sample-bank/push";
import { querySummary } from "@/lib/sample-bank/query";
import { sampleTypes } from "@/lib/samples.server";

export const dynamic = "force-dynamic";

/** The 外部样本库 tab (S20): a search for the sample bank, then every search sent and how far its results have come. */
export default async function SampleBankPage() {
  const [connection, types, searches] = await Promise.all([
    prisma.sampleBankConnection.findFirst({ where: { enabled: true }, orderBy: { createdAt: "asc" } }),
    sampleTypes(prisma),
    prisma.sampleBankSearch.findMany({
      orderBy: { requestedAt: "desc" }, take: 100,
      select: { id: true, requestedAt: true, query: true, test: true, status: true, pageCount: true, pagesReceived: true, requestedBy: true, _count: { select: { records: true } } },
    }),
  ]);
  const typeLabel = (key: string) => types.find((type) => type.key === key)?.label ?? key;
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title="Samples" />
        <SampleNav current="bank" />
        {connection ? (
          <SampleBankSearchForm bankName={connection.name} types={types.map((type) => ({ key: type.key, label: type.label }))} />
        ) : (
          <p className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface px-4 py-3 text-sm text-graphite">
            <span>The external sample bank is not connected yet.</span> <Link href="/settings#sample-bank" className="font-medium text-moss hover:underline">Set it up in Settings</Link>
          </p>
        )}
        <section aria-labelledby="bank-searches" className="space-y-2">
          <h2 id="bank-searches" className="text-base font-semibold text-ink">Searches</h2>
          <DataTable
            rows={searches}
            getRowKey={(row) => row.id}
            emptyMessage="No search sent yet."
            columns={[
              { key: "sent", header: "Sent at", width: 168, render: (row) => <Link href={`/samples/bank/${row.id}`} className="font-medium text-moss hover:underline">{row.requestedAt.toLocaleString()}</Link> },
              {
                key: "query", header: "Conditions", minWidth: 220,
                render: (row) => {
                  const query = sampleBankQuerySchema.safeParse(row.query);
                  return <span className="inline-flex flex-wrap items-center gap-2">{row.test ? <Badge tone="info">Test</Badge> : null}<span>{query.success ? querySummary(query.data, typeLabel) : "—"}</span></span>;
                },
              },
              {
                key: "state", header: "Status", width: 200,
                render: (row) => {
                  const state = searchState(row);
                  return <span><span>{searchStateLabels[state]}</span>{row.pageCount && state !== "complete" ? <span className="tabular-nums text-muted"> · {row.pagesReceived.length}/{row.pageCount}</span> : null}</span>;
                },
              },
              { key: "records", header: "Records", width: 96, render: (row) => <span className="tabular-nums">{row._count.records}</span> },
              { key: "by", header: "Requested by", width: 128, render: (row) => row.requestedBy ?? <span className="text-muted">—</span> },
            ]}
          />
        </section>
      </div>
    </AppShell>
  );
}
