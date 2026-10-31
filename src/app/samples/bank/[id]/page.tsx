import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { RefreshWhileWaiting } from "@/components/RefreshWhileWaiting";
import { SampleBankResults, type BankResultRow } from "@/components/SampleBankResults";
import { SampleBankTypePairForm } from "@/components/SampleBankTypePairForm";
import { SampleNav } from "@/components/SampleNav";
import { Badge } from "@/components/ui/Badge";
import { prisma } from "@/lib/db";
import { sampleBankErrorSchema, sampleBankQuerySchema } from "@/lib/sample-bank/contract";
import { searchState, searchStateLabels } from "@/lib/sample-bank/push";
import { querySummary } from "@/lib/sample-bank/query";
import { searchResults } from "@/lib/sample-bank/results.server";

export const dynamic = "force-dynamic";

const changeLabels: Record<string, string> = { name: "Name", type: "Type", origin: "Origin", collectedAt: "Collected", biosafetyLevel: "Biosafety level", location: "Location in the bank" };
const quantity = (value: { value: number; unit: string } | undefined) => value ? `${value.value} ${value.unit}` : "";
const stored = (value: number | null, unit: string | null) => value === null ? "" : `${value} ${unit ?? ""}`.trim();

/** One search's page (S21–S22): how far its results have come, type words to pair, and the records to import. */
export default async function SampleBankSearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await searchResults(prisma, id).catch(() => null);
  if (!loaded) notFound();
  const { search, types, results } = loaded;
  const projects = await prisma.project.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const state = searchState(search);
  const query = sampleBankQuerySchema.safeParse(search.query);
  const error = sampleBankErrorSchema.safeParse(search.error);
  const typeLabel = (typeId: string | undefined) => types.find((type) => type.id === typeId)?.label ?? "—";
  const fieldLabel = (typeId: string | undefined, key: string) => types.find((type) => type.id === typeId)?.fields.find((field) => field.key === key)?.label ?? key;
  const rows: BankResultRow[] = results.map((result) => ({
    id: result.recordId, externalId: result.record.externalId, name: result.record.name, code: result.record.code ?? null,
    bankType: result.record.sampleType, typeId: result.row.typeId ?? "", typeLabel: typeLabel(result.row.typeId), typeMatched: result.typeMatched,
    origin: result.record.origin ?? "", collectedAt: result.record.collectedAt ?? "",
    amount: quantity(result.record.amount), concentration: quantity(result.record.concentration), location: result.record.location ?? "",
    attributes: Object.entries(result.record.attributes ?? {}).map(([name, value]) => `${name}: ${value}`).join("; "),
    status: result.status,
    changes: result.changes.map((change) => ({
      label: change.field.startsWith("field:") ? fieldLabel(result.row.typeId, change.field.slice(6)) : changeLabels[change.field] ?? change.field,
      from: change.field === "type" ? typeLabel(change.from) : change.from,
      to: change.field === "type" ? typeLabel(change.to) : change.to,
    })),
    sample: result.sample ? { id: result.sample.id, code: result.sample.code, amount: stored(result.sample.amount, result.sample.amountUnit), concentration: stored(result.sample.concentration, result.sample.concentrationUnit) } : null,
    parentId: result.parentRecordId,
  }));
  const unpaired = [...results.filter((result) => !result.typeMatched).reduce((words, result) => words.set(result.record.sampleType, (words.get(result.record.sampleType) ?? 0) + 1), new Map<string, number>())];

  return (
    <AppShell>
      <div className="space-y-4">
        <SampleNav current="bank" />
        <Link href="/samples/bank" className="inline-block text-sm text-moss hover:underline">← External sample bank</Link>
        <PageHeader title={query.success ? querySummary(query.data, (key) => types.find((type) => type.key === key)?.label ?? key) || "Search" : "Search"} description={search.connection.name} />
        <RefreshWhileWaiting active={state === "sent" || state === "accepted" || state === "receiving"} />
        <dl className="grid gap-x-6 gap-y-1 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface px-4 py-3 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-muted">Status</dt><dd className="flex flex-wrap items-center gap-2 text-ink">{search.test ? <Badge tone="info">Test</Badge> : null}<span>{searchStateLabels[state]}</span>{search.pageCount ? <span className="tabular-nums text-muted">{search.pagesReceived.length}/{search.pageCount}</span> : null}</dd></div>
          <div><dt className="text-xs text-muted">Records received</dt><dd className="tabular-nums text-ink">{results.length}{search.total !== null ? <span className="text-muted"> / {search.total}</span> : null}</dd></div>
          <div><dt className="text-xs text-muted">Sent at</dt><dd className="text-ink">{search.requestedAt.toLocaleString()}{search.requestedBy ? <span className="text-muted"> · {search.requestedBy}</span> : null}</dd></div>
          <div><dt className="text-xs text-muted">Bank request</dt><dd className="record-identifier text-ink">{search.bankRequestId ?? "—"}</dd></div>
          {error.success ? <div className="sm:col-span-4"><dt className="text-xs text-muted">Reason</dt><dd className="text-error">{error.data.message}</dd></div> : null}
        </dl>
        {unpaired.length ? (
          <section aria-labelledby="bank-types" className="space-y-2 rounded-[var(--ln-radius-panel)] border border-warning/40 bg-warning-surface/40 px-4 py-3">
            <h2 id="bank-types" className="text-sm font-semibold text-ink">Type words LabNest did not recognise</h2>
            <p className="text-sm text-graphite">They are kept as Other for now. Choose the type each word means; LabNest remembers it for this sample bank.</p>
            {unpaired.map(([word, count]) => <SampleBankTypePairForm key={word} bankType={word} count={count} types={types.map((type) => ({ id: type.id, label: type.label }))} />)}
          </section>
        ) : null}
        <SampleBankResults searchId={search.id} rows={rows} types={types.map((type) => ({ id: type.id, label: type.label }))} projects={projects} />
      </div>
    </AppShell>
  );
}
