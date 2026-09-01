import type { ReactNode } from "react";
import Link from "next/link";
import { Filter, Layers3, Plus, Search, Upload, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CollectionExportMenu } from "@/components/CollectionExportMenu";
import { collectionPrimaryActionClass, collectionSecondaryActionClass } from "@/components/CollectionToolbar";
import { PageHeader } from "@/components/PageHeader";
import { SequenceCollectionBatchActions } from "@/components/SequenceCollectionBatchActions";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { bulkUpdateSequences } from "./actions";
import { prisma } from "@/lib/db";
import { filterHref, firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { designTypeLabel, sequenceDesignTypes, sequenceLifecycleStatuses, sequenceValidationStatuses } from "@/lib/sequence-registry";
import { gcPercent, sequenceLength } from "@/lib/sequence";

export const dynamic = "force-dynamic";

export default async function SequencesPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const query = firstSearchParam(params, "q")?.trim();
  const designType = firstSearchParam(params, "designType");
  const moleculeType = firstSearchParam(params, "moleculeType");
  const status = firstSearchParam(params, "status");
  const validationStatus = firstSearchParam(params, "validationStatus");
  const sort = firstSearchParam(params, "sort") ?? "updated_desc";

  const orderBy = sort === "name_asc" ? { name: "asc" as const } : sort === "code_asc" ? { code: "asc" as const } : { updatedAt: "desc" as const };
  const [records, totalCount, collectionCount, projects] = await Promise.all([
    prisma.sequence.findMany({
      where: {
        ...(designType ? { designType: designType as never } : {}),
        ...(status ? { status: status as never } : {}),
        ...(query ? { OR: [{ code: { contains: query, mode: "insensitive" } }, { name: { contains: query, mode: "insensitive" } }, { targetName: { contains: query, mode: "insensitive" } }, { organism: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }] } : {}),
      },
      include: {
        project: { select: { id: true, name: true } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        _count: { select: { entityLinks: true } },
      },
      orderBy,
    }),
    prisma.sequence.count(),
    prisma.sequenceCollection.count(),
    prisma.project.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const sequences = records.filter((record) => {
    const latest = record.versions[0];
    return latest && (!moleculeType || latest.moleculeType === moleculeType) && (!validationStatus || latest.validationStatus === validationStatus);
  });
  const activeFilterCount = [query, designType, moleculeType, status, validationStatus].filter(Boolean).length;
  const hasActiveView = activeFilterCount > 0 || sort !== "updated_desc";
  const filterFormId = "sequence-table-filters";
  const exportHref = filterHref("/sequences/export", { exportScope: "filtered", q: query, designType, moleculeType, status, validationStatus, sort });

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader title="Sequences" />
        <form id={filterFormId} action="/sequences" method="get" className="hidden" aria-hidden="true" />

        <section className="border-y border-hairline bg-surface" aria-label="Sequence tools">
          <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <SequenceMobileFilters query={query} designType={designType} moleculeType={moleculeType} status={status} validationStatus={validationStatus} sort={sort} activeFilterCount={activeFilterCount} />
              <span className="whitespace-nowrap font-mono text-xs text-muted">{sequences.length === totalCount ? `${totalCount} records` : `${sequences.length} of ${totalCount}`}</span>
              <span className="hidden whitespace-nowrap text-xs text-muted sm:inline">{`${collectionCount} ${collectionCount === 1 ? "collection" : "collections"}`}</span>
              <div className="hidden items-center gap-1.5 md:flex">
                <select form={filterFormId} name="sort" defaultValue={sort} aria-label="Sort Sequences" className={`${tableFilterClass} w-36`}><option value="updated_desc">Recently updated</option><option value="name_asc">Name A–Z</option><option value="code_asc">Sequence code</option></select>
                <button form={filterFormId} type="submit" className={filterApplyButtonClass}><Filter className="h-3.5 w-3.5" aria-hidden />Apply</button>
                {hasActiveView ? <Link href="/sequences" className={filterClearButtonClass}><X className="h-3.5 w-3.5" aria-hidden />Clear</Link> : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/sequences/collections" className={collectionSecondaryActionClass}><Layers3 className="h-4 w-4" aria-hidden />Collections</Link>
              <Link href="/sequences/import" className={collectionSecondaryActionClass}><Upload className="h-4 w-4" aria-hidden />Import</Link>
              <CollectionExportMenu filteredHref={exportHref} exportPath="/sequences/export" />
              <Link href="/sequences/new" className={collectionPrimaryActionClass}><Plus className="h-4 w-4" aria-hidden />New Sequence</Link>
            </div>
          </div>
        </section>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0">
            <DataTable
              rows={sequences}
              getRowKey={(row) => row.id}
              emptyMessage="No Sequences match this view."
              selection={{ exportPath: "/sequences/export" }}
              columns={[
                {
                  key: "identity",
                  header: <SequenceColumnFilter label="Sequence" className="md:min-w-48"><div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden /><input form={filterFormId} name="q" defaultValue={query ?? ""} placeholder="Name, code, target…" aria-label="Filter Sequences" className={`${tableFilterClass} pl-8`} /></div></SequenceColumnFilter>,
                  render: (row) => <div><Link href={`/sequences/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.name}</Link><p className="mt-0.5 font-mono text-xs text-muted">{row.code} · v{row.versions[0]?.displayVersion}</p></div>,
                },
                {
                  key: "design",
                  header: <SequenceColumnFilter label="Design type" className="md:min-w-32"><select form={filterFormId} name="designType" defaultValue={designType ?? ""} aria-label="Filter Sequences by design type" className={tableFilterClass}><option value="">All design types</option>{sequenceDesignTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></SequenceColumnFilter>,
                  render: (row) => <Badge tone="sage">{designTypeLabel(row.designType)}</Badge>,
                },
                {
                  key: "molecule",
                  header: <SequenceColumnFilter label="Molecule" className="md:min-w-28"><select form={filterFormId} name="moleculeType" defaultValue={moleculeType ?? ""} aria-label="Filter Sequences by molecule type" className={tableFilterClass}><option value="">All molecules</option><option value="DNA">DNA</option><option value="RNA">RNA</option><option value="Protein">Amino acid</option></select></SequenceColumnFilter>,
                  render: (row) => {
                    const version = row.versions[0];
                    return <div><p>{version?.moleculeType === "Protein" ? "Amino acid" : version?.moleculeType} · <span className="font-mono text-xs">{sequenceLength(version?.sequence ?? "")} {version?.moleculeType === "Protein" ? "aa" : "nt"}</span></p><p className="font-mono text-xs text-muted">{version?.topology} · {version?.strandedness}{version?.moleculeType === "Protein" ? "" : ` · GC ${gcPercent(version?.sequence ?? "")}%`}</p></div>;
                  },
                },
                { key: "target", header: "Target / organism", render: (row) => <div><p>{row.targetName ?? "—"}</p><p className="text-xs text-muted">{row.organism ?? row.project?.name ?? "Shared library"}</p></div> },
                {
                  key: "validation",
                  header: <SequenceColumnFilter label="Validation" className="md:min-w-40"><select form={filterFormId} name="validationStatus" defaultValue={validationStatus ?? ""} aria-label="Filter Sequences by validation" className={tableFilterClass}><option value="">All validation states</option>{sequenceValidationStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></SequenceColumnFilter>,
                  render: (row) => <StatusPill status={row.versions[0]?.validationStatus ?? "unverified"} />,
                },
                {
                  key: "status",
                  header: <SequenceColumnFilter label="Lifecycle" className="md:min-w-28"><select form={filterFormId} name="status" defaultValue={status ?? ""} aria-label="Filter Sequences by lifecycle" className={tableFilterClass}><option value="">All lifecycle</option>{sequenceLifecycleStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></SequenceColumnFilter>,
                  render: (row) => <div className="space-y-1"><StatusPill status={row.status} /><p className="text-xs text-muted">{row._count.entityLinks} design {row._count.entityLinks === 1 ? "link" : "links"}</p></div>,
                },
              ]}
            />
          </div>
          <aside className="lg:sticky lg:top-4 h-fit">
            <SequenceCollectionBatchActions
              selectionGroup="/sequences/export"
              targetName="序列条目"
              typeLabel="设计类型"
              typeOptions={sequenceDesignTypes}
              projects={projects}
              action={bulkUpdateSequences}
              layout="sidebar"
            />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

const tableFilterClass = "focus-ring h-8 w-full rounded-[var(--ln-radius-control-sm)] border border-hairline bg-surface px-2 text-xs font-normal normal-case tracking-normal text-ink";
const filterApplyButtonClass = buttonStyles({ variant: "primary", size: "sm", className: "font-medium" });
const filterClearButtonClass = buttonStyles({ variant: "ghost", size: "sm", className: "font-medium text-muted" });

function SequenceColumnFilter({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <div className={`normal-case tracking-normal ${className}`}><span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</span><div className="mt-1.5 hidden md:block">{children}</div></div>;
}

function SequenceMobileFilters({ query, designType, moleculeType, status, validationStatus, sort, activeFilterCount }: { query?: string; designType?: string; moleculeType?: string; status?: string; validationStatus?: string; sort: string; activeFilterCount: number }) {
  return (
    <details className="relative md:hidden">
      <summary className="focus-ring flex h-9 cursor-pointer list-none items-center gap-2 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-3 text-[13px] font-medium text-graphite"><Filter className="h-3.5 w-3.5" aria-hidden />Filters{activeFilterCount ? <span className="rounded-full bg-sage-surface px-1.5 py-0.5 font-mono text-[10px] text-moss">{activeFilterCount}</span> : null}</summary>
      <div className="absolute left-0 z-30 mt-2 w-[min(88vw,360px)] rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface p-3 shadow-soft">
        <form action="/sequences" className="grid gap-2">
          <input name="q" defaultValue={query ?? ""} placeholder="Name, code, target…" className={tableFilterClass} />
          <select name="designType" defaultValue={designType ?? ""} className={tableFilterClass}><option value="">All design types</option>{sequenceDesignTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          <select name="moleculeType" defaultValue={moleculeType ?? ""} className={tableFilterClass}><option value="">All molecules</option><option value="DNA">DNA</option><option value="RNA">RNA</option><option value="Protein">Amino acid</option></select>
          <select name="validationStatus" defaultValue={validationStatus ?? ""} className={tableFilterClass}><option value="">All validation states</option>{sequenceValidationStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          <select name="status" defaultValue={status ?? ""} className={tableFilterClass}><option value="">All lifecycle states</option>{sequenceLifecycleStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          <select name="sort" defaultValue={sort} className={tableFilterClass}><option value="updated_desc">Recently updated</option><option value="name_asc">Name A–Z</option><option value="code_asc">Sequence code</option></select>
          <div className="mt-1 flex justify-end gap-2"><Link href="/sequences" className={filterClearButtonClass}>Clear</Link><button type="submit" className={filterApplyButtonClass}>Apply</button></div>
        </form>
      </div>
    </details>
  );
}
