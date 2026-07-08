import Link from "next/link";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { searchDemoRecords } from "@/lib/search";

export default async function SearchPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const query = firstSearchParam(params, "q") ?? "";
  const results = query ? searchDemoRecords(query, 80) : [];

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
              <button className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm shadow-paper transition hover:brightness-95">
                <Search className="h-4 w-4" aria-hidden />
                Search
              </button>
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
