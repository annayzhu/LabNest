import Link from "next/link";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import type { SearchResult } from "@/lib/search";

export const dynamic = "force-dynamic";

function textFilter(query: string) {
  return { contains: query, mode: "insensitive" as const };
}

async function searchRecords(query: string): Promise<SearchResult[]> {
  if (!query) return [];

  try {
    const [entries, protocols, inventoryItems, sampleProfiles, results, purchases, sequences] = await Promise.all([
      prisma.entry.findMany({
        where: { OR: [{ title: textFilter(query) }, { body: textFilter(query) }, { moodStatus: textFilter(query) }] },
        include: { project: true },
        orderBy: { occurredAt: "desc" },
        take: 20,
      }),
      prisma.protocol.findMany({
        where: { OR: [{ title: textFilter(query) }, { description: textFilter(query) }] },
        include: { versions: { orderBy: { revision: "desc" }, take: 1 } },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      prisma.inventoryItem.findMany({
        where: {
          OR: [
            { name: textFilter(query) },
            { barcode: textFilter(query) },
            { aliquotCode: textFilter(query) },
            { lotNumber: textFilter(query) },
            { vendor: textFilter(query) },
            { catalogNumber: textFilter(query) },
            { notes: textFilter(query) },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      prisma.sampleProfile.findMany({
        where: {
          OR: [
            { sampleCode: textFilter(query) },
            { sampleType: textFilter(query) },
            { sourceLabel: textFilter(query) },
            { notes: textFilter(query) },
            { entity: { name: textFilter(query) } },
          ],
        },
        include: { entity: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      prisma.result.findMany({
        where: { OR: [{ title: textFilter(query) }, { resultType: textFilter(query) }, { templateKey: textFilter(query) }, { textValue: textFilter(query) }, { notes: textFilter(query) }] },
        include: { experiment: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      prisma.purchaseRequest.findMany({
        where: { OR: [{ title: textFilter(query) }, { vendor: textFilter(query) }, { catalogNumber: textFilter(query) }, { notes: textFilter(query) }] },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      prisma.sequence.findMany({
        where: { OR: [{ code: textFilter(query) }, { name: textFilter(query) }, { targetName: textFilter(query) }, { organism: textFilter(query) }, { description: textFilter(query) }, { versions: { some: { sequence: textFilter(query) } } }] },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ]);

    return [
      ...entries.map((entry) => ({
        id: entry.id,
        type: "entry" as const,
        title: entry.title,
        subtitle: entry.project?.name,
        href: `/entries/${entry.id}`,
        matchedText: entry.body,
      })),
      ...protocols.map((protocol) => ({
        id: protocol.id,
        type: "protocol" as const,
        title: protocol.title,
        subtitle: protocol.versions[0]?.title ?? protocol.availability,
        href: `/protocols?protocol=${protocol.id}`,
        matchedText: protocol.description ?? undefined,
      })),
      ...inventoryItems.map((item) => ({
        id: item.id,
        type: "inventory_item" as const,
        title: item.name,
        subtitle: item.aliquotCode ?? item.lotNumber ?? item.status,
        href: `/inventory?status=${item.status}`,
        matchedText: item.notes ?? item.catalogNumber ?? undefined,
      })),
      ...sampleProfiles.map((sample) => ({
        id: sample.id,
        type: "sample_profile" as const,
        title: sample.entity.name,
        subtitle: sample.sampleCode,
        href: `/samples?status=${sample.status}`,
        matchedText: sample.notes ?? sample.sourceLabel ?? undefined,
      })),
      ...results.map((result) => ({
        id: result.id,
        type: "result" as const,
        title: result.title,
        subtitle: result.experiment?.title ?? result.resultType,
        href: `/results?type=${result.resultType}`,
        matchedText: result.notes ?? result.textValue ?? undefined,
      })),
      ...purchases.map((purchase) => ({
        id: purchase.id,
        type: "purchase" as const,
        title: purchase.title,
        subtitle: purchase.vendor ?? purchase.status,
        href: `/purchases?status=${purchase.status}`,
        matchedText: purchase.notes ?? purchase.catalogNumber ?? undefined,
      })),
      ...sequences.map((sequence) => ({
        id: sequence.id,
        type: "sequence" as const,
        title: sequence.name,
        subtitle: `${sequence.code} · ${sequence.designType} · v${sequence.versions[0]?.displayVersion ?? "?"}`,
        href: `/sequences/${sequence.id}`,
        matchedText: sequence.targetName ?? sequence.organism ?? sequence.description ?? undefined,
      })),
    ];
  } catch {
    return [];
  }
}

export default async function SearchPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const query = firstSearchParam(params, "q") ?? "";
  const results = await searchRecords(query);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Find"
          title="Search"
          description="Search notes, protocols, samples, inventory, results, purchases, and references."
        />

        <Card>
          <CardHeader title="Query" eyebrow="Local index" />
          <CardBody>
            <form className="flex flex-col gap-3 sm:flex-row" action="/search">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Search query</span>
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="GFP, HEK-WCB, agarose, transfection..."
                  className="focus-ring h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"
                />
              </label>
              <Button type="submit" variant="primary" size="lg" className="shadow-paper">
                <Search className="h-4 w-4" aria-hidden />
                Search
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Results" eyebrow={query ? `${results.length} matches` : "ready"} />
          <CardBody>
            <DataTable
              rows={results}
              getRowKey={(row) => `${row.type}-${row.id}`}
              emptyMessage={query ? "No records match this query." : "Enter a query to search records."}
              columns={[
                {
                  key: "title",
                  header: "Record",
                  render: (row) => (
                    <div>
                      <Link href={row.href} className="font-semibold text-ink hover:underline">
                        {row.title}
                      </Link>
                      <p className="mt-1 text-xs text-muted">{row.subtitle ?? row.id}</p>
                    </div>
                  ),
                },
                { key: "type", header: "Type", render: (row) => <Badge tone="sage">{row.type.replaceAll("_", " ")}</Badge> },
                { key: "match", header: "Matched Text", render: (row) => row.matchedText ?? "title" },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
