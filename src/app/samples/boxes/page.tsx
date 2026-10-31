import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SampleBoxSizeForm } from "@/components/SampleBoxSizeForm";
import { SampleNav } from "@/components/SampleNav";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { comparePositions, normalizePosition, positionLabel, rowLabel } from "@/lib/samples";
import { sampleLocationOptions } from "@/lib/samples.server";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

/** Storage locations with their samples (S7): a box with rows and columns is drawn as its grid. */
export default async function SampleBoxesPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const [locations, counts] = await Promise.all([
    sampleLocationOptions(prisma),
    prisma.sample.groupBy({ by: ["locationId"], where: { locationId: { not: null } }, _count: { _all: true } }),
  ]);
  const countOf = new Map(counts.map((row) => [row.locationId!, row._count._all]));
  const selectedId = firstSearchParam(params, "location") ?? locations.find((location) => countOf.get(location.id))?.id ?? locations[0]?.id;
  const selected = locations.find((location) => location.id === selectedId);
  const samples = selected ? await prisma.sample.findMany({ where: { locationId: selected.id }, select: { id: true, code: true, name: true, position: true, type: { select: { label: true } } }, orderBy: { code: "asc" } }) : [];
  const byPosition = new Map(samples.filter((sample) => sample.position).map((sample) => [normalizePosition(sample.position), sample]));
  const geometry = selected?.geometry;
  const offGrid = geometry ? samples.filter((sample) => !sample.position) : [...samples].sort((a, b) => comparePositions(a.position ?? "", b.position ?? ""));

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title="Samples" />
        <SampleNav current="boxes" />
        {!locations.length ? <p className="text-sm text-muted">No storage locations yet. Add freezers, shelves and boxes under Inventory · Storage locations; samples share them.</p> : (
          <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <nav aria-label="Storage locations" className="max-h-[70vh] overflow-y-auto rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
              <ul className="divide-y divide-hairline text-sm">
                {locations.map((location) => (
                  <li key={location.id}>
                    <Link href={`/samples/boxes?location=${location.id}`} aria-current={location.id === selected?.id ? "page" : undefined} className={cn("flex items-center gap-2 px-3 py-2 hover:bg-warm", location.id === selected?.id && "bg-sage-surface text-moss")}>
                      <span className="min-w-0 flex-1 truncate" title={location.label}>{location.label}</span>
                      {location.geometry ? <span className="font-mono text-xs text-muted">{location.geometry.rows}×{location.geometry.columns}</span> : null}
                      <span className="tabular-nums text-xs text-graphite">{countOf.get(location.id) ?? 0}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            {selected ? (
              <section aria-label={selected.label} className="min-w-0 space-y-3 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4">
                <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h2 className="text-base font-semibold text-ink">{selected.label}</h2>
                  {selected.temperature ? <span className="text-xs text-muted">{selected.temperature}</span> : null}
                  <Link href={`/samples?location=${selected.id}`} className="ml-auto text-sm text-moss hover:underline"><span>List</span> · <span className="tabular-nums">{samples.length}</span></Link>
                </header>
                <SampleBoxSizeForm locationId={selected.id} rows={geometry?.rows ?? null} columns={geometry?.columns ?? null} />
                {geometry ? (
                  <div className="relative min-w-0 max-w-full overflow-x-auto editorial-scrollbar [contain:inline-size]">
                    <div className="grid w-max gap-px rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-hairline text-[11px]" style={{ gridTemplateColumns: `1.5rem repeat(${geometry.columns}, minmax(4.5rem, 1fr))` }}>
                      <span className="bg-warm" />
                      {Array.from({ length: geometry.columns }, (_, column) => <span key={column} className="bg-warm py-1 text-center font-mono text-muted">{column + 1}</span>)}
                      {Array.from({ length: geometry.rows }, (_, row) => [
                        <span key={`r${row}`} className="flex items-center justify-center bg-warm font-mono text-muted">{rowLabel(row)}</span>,
                        ...Array.from({ length: geometry.columns }, (_, column) => {
                          const position = positionLabel(row, column), sample = byPosition.get(position);
                          return sample
                            ? <Link key={position} href={`/samples/${sample.id}`} title={`${position} · ${sample.code} · ${sample.name} · ${sample.type.label}`} className="min-h-12 min-w-0 bg-sage-surface px-1 py-1 text-moss hover:bg-moss hover:text-white"><span className="block truncate font-medium">{sample.name}</span><span className="block truncate font-mono opacity-80">{sample.code}</span></Link>
                            : <span key={position} className="min-h-12 bg-surface px-1 py-1 font-mono text-muted/60">{position}</span>;
                        }),
                      ])}
                    </div>
                  </div>
                ) : <p className="text-xs text-muted">Set the box size to see it as a grid and place samples at A1-style positions.</p>}
                {offGrid.length ? (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted">{geometry ? "Here without a position" : "Samples here"}</p>
                    <ul className="divide-y divide-hairline text-sm">
                      {offGrid.map((sample) => <li key={sample.id} className="flex flex-wrap items-center gap-2 py-1.5"><Link href={`/samples/${sample.id}`} className="text-moss hover:underline"><span className="record-identifier">{sample.code}</span> {sample.name}</Link><span className="text-xs text-muted">{sample.type.label}</span>{sample.position ? <span className="ml-auto font-mono text-xs">{sample.position}</span> : null}</li>)}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}
