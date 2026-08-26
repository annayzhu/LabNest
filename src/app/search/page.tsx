import Link from "next/link";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { searchLabNestRecords } from "@/lib/global-search";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const query = firstSearchParam(params, "q") ?? "";
  const results = await searchLabNestRecords(query, 80);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Find"
          title="Global Search"
          description="Search across Projects, Research Plans, Experiments, Protocols, Entries, Results, Reports, Inventory, Samples, Sequences, Purchases, Tools, and references."
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
                  placeholder="Project, plan code, protocol, sample, reagent, result..."
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
                  header: "Search result",
                  render: (row) => (
                    <div>
                      <Link href={row.href} className="font-semibold text-ink hover:underline">
                        {row.title}
                      </Link>
                      <p className="mt-1 text-xs text-muted">{row.subtitle ?? row.id}</p>
                    </div>
                  ),
                },
                {
                  key: "location",
                  header: "Location",
                  render: (row) => (
                    <Link href={row.href} className="text-sm text-graphite hover:text-ink hover:underline">
                      {row.location}
                    </Link>
                  ),
                },
                { key: "type", header: "Type", render: (row) => <Badge tone="sage">{row.type.replaceAll("_", " ")}</Badge> },
                { key: "match", header: "Matched Text", render: (row) => <span className="line-clamp-3 text-xs leading-5 text-graphite">{row.matchedText ?? "title / location"}</span> },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
