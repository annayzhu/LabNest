import Link from "next/link";
import { Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { AppShell } from "@/components/AppShell";
import { CollectionToolbar, collectionPrimaryActionClass } from "@/components/CollectionToolbar";
import { PageHeader } from "@/components/PageHeader";
import { SampleBatchBanner } from "@/components/SampleBatchBanner";
import { SamplePlace, SampleQuantity, SampleStatusBadge } from "@/components/SampleBits";
import { SampleBulkActions } from "@/components/SampleBulkActions";
import { SampleNav } from "@/components/SampleNav";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { buttonStyles } from "@/components/ui/Button";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { isSampleStatus, sampleStatuses, sampleStatusLabels } from "@/lib/samples";
import { sampleLocationOptions, sampleTypes } from "@/lib/samples.server";

export const dynamic = "force-dynamic";
const pageSize = 200;
const pageLink = buttonStyles({ size: "sm", variant: "ghost" });

export default async function SamplesPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const query = firstSearchParam(params, "q")?.trim();
  const typeId = firstSearchParam(params, "type");
  const statusParam = firstSearchParam(params, "status");
  const status = isSampleStatus(statusParam) ? statusParam : undefined;
  const locationId = firstSearchParam(params, "location");
  const projectId = firstSearchParam(params, "project");
  const batchId = firstSearchParam(params, "batch");
  const source = firstSearchParam(params, "source");
  const sort = firstSearchParam(params, "sort") ?? "created_desc";
  const page = Math.max(1, Number(firstSearchParam(params, "page")) || 1);
  const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });

  const where: Prisma.SampleWhereInput = {
    ...(typeId ? { typeId } : {}),
    ...(status ? { status } : {}),
    ...(locationId ? { locationId } : {}),
    ...(projectId ? { projectId: projectId === "none" ? null : projectId } : {}),
    ...(batchId ? { batchId } : {}),
    ...(source === "lab" ? { externalSource: null } : source === "bank" ? { externalSource: { not: null } } : {}),
    ...(query ? { OR: [{ code: contains(query) }, { name: contains(query) }, { origin: contains(query) }, { externalId: contains(query) }] } : {}),
  };
  const orderBy: Prisma.SampleOrderByWithRelationInput[] = sort === "code_asc" ? [{ code: "asc" }] : sort === "name_asc" ? [{ name: "asc" }, { code: "asc" }] : sort === "place_asc" ? [{ locationId: "asc" }, { position: "asc" }] : [{ createdAt: "desc" }, { code: "asc" }];
  const [samples, matching, total, types, locations, projects, batchUses, bankImport] = await Promise.all([
    prisma.sample.findMany({
      where, orderBy, skip: (page - 1) * pageSize, take: pageSize,
      include: {
        type: { select: { label: true } },
        parent: { select: { id: true, code: true } },
        experiments: { where: { role: "output" }, select: { experiment: { select: { id: true, runCode: true } } } },
      },
    }),
    prisma.sample.count({ where }),
    prisma.sample.count(),
    sampleTypes(prisma, { includeDisabled: true }),
    sampleLocationOptions(prisma),
    prisma.project.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    batchId ? Promise.all([
      prisma.experimentSample.count({ where: { sample: { batchId }, role: "input" } }),
      prisma.sample.count({ where: { parent: { batchId }, NOT: { batchId } } }),
    ]) : Promise.resolve([0, 0]),
    batchId ? prisma.sampleBankImport.findUnique({ where: { id: batchId }, select: { updated: true, undoneAt: true } }) : Promise.resolve(null),
  ]);
  const restoring = bankImport && !bankImport.undoneAt && Array.isArray(bankImport.updated) ? bankImport.updated.length : 0;
  const placeLabel = new Map(locations.map((location) => [location.id, location.label]));
  const pages = Math.max(1, Math.ceil(matching / pageSize));
  const pageHref = (nextPage: number) => {
    const search = new URLSearchParams(Object.entries(params ?? {}).flatMap(([key, value]) => typeof value === "string" && key !== "page" ? [[key, value]] : []));
    if (nextPage > 1) search.set("page", String(nextPage));
    return `/samples${search.size ? `?${search}` : ""}`;
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title="Samples" />
        <SampleNav current="samples" />
        {batchId && matching ? <SampleBatchBanner batchId={batchId} count={matching} restoring={restoring} undoable={batchUses[0] + batchUses[1] === 0} /> : null}
        <CollectionToolbar
          path="/samples"
          query={query}
          searchPlaceholder="Code, name, origin, external ID…"
          resultCount={matching}
          totalCount={total}
          sort={sort}
          defaultSort="created_desc"
          filters={[
            { name: "type", label: "types", value: typeId, options: types.map((type) => ({ value: type.id, label: type.label })) },
            { name: "status", label: "statuses", value: status, options: sampleStatuses.map((value) => ({ value, label: sampleStatusLabels[value] })) },
            { name: "source", label: "sources", value: source, options: [{ value: "lab", label: "This lab" }, { value: "bank", label: "External sample bank" }] },
            { name: "location", label: "places", value: locationId, options: locations.map((location) => ({ value: location.id, label: location.label })) },
            { name: "project", label: "projects", value: projectId, options: [...projects.map((project) => ({ value: project.id, label: project.name })), { value: "none", label: "No project" }] },
            ...(batchId ? [{ name: "batch", label: "batch", value: batchId, options: [{ value: batchId, label: "This batch" }] }] : []),
          ]}
          sortOptions={[{ value: "created_desc", label: "Recently added" }, { value: "code_asc", label: "Code A–Z" }, { value: "name_asc", label: "Name A–Z" }, { value: "place_asc", label: "By place" }]}
          actions={<Link href="/samples/new" className={collectionPrimaryActionClass}><Plus className="h-4 w-4" aria-hidden />New samples</Link>}
        />
        <DataTable
          rows={samples}
          getRowKey={(row) => row.id}
          emptyMessage={total ? "No samples match this view." : "No samples yet. Add them with New samples, or register what an experiment produced."}
          selection={{
            exportPath: "/api/exports/samples.csv",
            actions: <SampleBulkActions locations={locations.map((location) => ({ value: location.id, label: location.label, grid: Boolean(location.geometry) }))} projects={projects.map((project) => ({ value: project.id, label: project.name }))} />,
          }}
          columns={[
            {
              key: "sample", header: "Sample", width: 200, minWidth: 160,
              render: (row) => <div className="min-w-0"><Link href={`/samples/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.name}</Link><p className="record-identifier mt-0.5 text-xs text-muted">{row.code}{row.externalSource ? <span title={`${row.externalSource} · ${row.externalId}`}><Badge tone="info" className="ml-1.5 align-middle">Sample bank</Badge></span> : null}</p></div>,
            },
            { key: "type", header: "Type", width: 88, render: (row) => row.type.label },
            { key: "origin", header: "Origin", width: 140, render: (row) => row.origin ?? <span className="text-muted">—</span> },
            { key: "parent", header: "Parent sample", width: 112, render: (row) => row.parent ? <Link href={`/samples/${row.parent.id}`} className="record-identifier text-moss hover:underline">{row.parent.code}</Link> : <span className="text-muted">—</span> },
            { key: "place", header: "Place", width: 220, minWidth: 160, render: (row) => <SamplePlace location={row.locationId ? placeLabel.get(row.locationId) ?? null : null} position={row.position} /> },
            { key: "amount", header: "Amount", width: 88, render: (row) => <SampleQuantity value={row.amount} unit={row.amountUnit} /> },
            { key: "concentration", header: "Concentration", width: 110, render: (row) => <SampleQuantity value={row.concentration} unit={row.concentrationUnit} /> },
            { key: "status", header: "Status", width: 80, render: (row) => <SampleStatusBadge status={row.status} /> },
            {
              key: "source", header: "Produced by", width: 88,
              render: (row) => row.experiments[0] ? <Link href={`/experiments/${row.experiments[0].experiment.id}`} className="record-identifier text-moss hover:underline">{row.experiments[0].experiment.runCode}</Link> : <span className="text-muted">—</span>,
            },
          ]}
        />
        {pages > 1 ? (
          <nav aria-label="Pages" className="flex items-center justify-end gap-2 text-sm text-muted">
            {page > 1 ? <Link href={pageHref(page - 1)} className={pageLink}>Previous</Link> : null}
            <span className="tabular-nums">{page} / {pages}</span>
            {page < pages ? <Link href={pageHref(page + 1)} className={pageLink}>Next</Link> : null}
          </nav>
        ) : null}
      </div>
    </AppShell>
  );
}
