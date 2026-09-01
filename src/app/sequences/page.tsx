import type { ReactNode } from "react";
import Link from "next/link";
import { Filter, Layers3, Plus, Search, Upload } from "lucide-react";
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
import { designTypeLabel, pairTypeLabel, sequenceDesignTypes, sequenceLifecycleStatuses, sequenceValidationStatuses } from "@/lib/sequence-registry";
import { gcPercent, sequenceLength } from "@/lib/sequence";
import { sequencePairDefinition, sequencePairTypeForDesignType } from "@/lib/sequence-entry";

export const dynamic = "force-dynamic";

export default async function SequencesPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const query = firstSearchParam(params, "q")?.trim();
  const designType = firstSearchParam(params, "designType");
  const moleculeType = firstSearchParam(params, "moleculeType");
  const status = firstSearchParam(params, "status");
  const validationStatus = firstSearchParam(params, "validationStatus");
  const sort = firstSearchParam(params, "sort") ?? "updated_desc";
  const pairTypeFilter = designType ? sequencePairTypeForDesignType(designType) : undefined;

  const [records, pairs, singleTotal, pairTotal, collectionCount, projects] = await Promise.all([
    prisma.sequence.findMany({
      where: {
        pairMembership: { is: null },
        ...(designType ? { designType: designType as never } : {}),
        ...(status ? { status: status as never } : { status: { not: "archived" as const } }),
        ...(query ? { OR: [{ code: { contains: query, mode: "insensitive" } }, { name: { contains: query, mode: "insensitive" } }, { targetName: { contains: query, mode: "insensitive" } }, { organism: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }] } : {}),
      },
      include: {
        project: { select: { id: true, name: true } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        _count: { select: { entityLinks: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.sequencePair.findMany({
      where: {
        ...(pairTypeFilter ? { type: pairTypeFilter } : designType ? { id: "__no_pair_matches__" } : {}),
        ...(status ? { status: status as never } : { status: { not: "archived" as const } }),
        ...(query ? { OR: [{ code: { contains: query, mode: "insensitive" } }, { name: { contains: query, mode: "insensitive" } }, { targetName: { contains: query, mode: "insensitive" } }, { organism: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }] } : {}),
      },
      include: { project: { select: { id: true, name: true } }, members: { include: { sequenceVersion: true }, orderBy: { order: "asc" } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.sequence.count({ where: { pairMembership: { is: null }, ...(status ? { status: status as never } : { status: { not: "archived" as const } }) } }),
    prisma.sequencePair.count({ where: status ? { status: status as never } : { status: { not: "archived" } } }),
    prisma.sequenceCollection.count({ where: { type: { notIn: ["primer_pair", "sirna_duplex"] } } }),
    prisma.project.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const singleRows = records.map((record) => ({ ...record, kind: "single" as const, href: `/sequences/${record.id}`, pairType: null, pairMembers: [] as typeof pairs[number]["members"], entityLinkCount: record._count.entityLinks }));
  const pairRows = pairs.map((pair) => ({ ...pair, kind: "paired" as const, href: `/sequences/pairs/${pair.id}`, pairType: pair.type, designType: sequencePairDefinition(pair.type).designType, versions: [] as typeof records[number]["versions"], pairMembers: pair.members, entityLinkCount: 0 }));
  const sequences = [...singleRows, ...pairRows].filter((record) => {
    const latest = record.versions[0];
    const versions = record.kind === "paired" ? record.pairMembers.map((member) => member.sequenceVersion) : latest ? [latest] : [];
    return versions.length > 0 && (!moleculeType || versions.every((version) => version.moleculeType === moleculeType)) && (!validationStatus || versions.some((version) => version.validationStatus === validationStatus));
  }).sort((a, b) => sort === "name_asc" ? a.name.localeCompare(b.name) : sort === "code_asc" ? a.code.localeCompare(b.code) : b.updatedAt.getTime() - a.updatedAt.getTime());
  const totalCount = singleTotal + pairTotal;
  const activeFilterCount = [query, designType, moleculeType, status, validationStatus].filter(Boolean).length;
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
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/sequences/collections" className={collectionSecondaryActionClass}><Layers3 className="h-4 w-4" aria-hidden />Collections</Link>
              <Link href="/sequences/workflows" className={collectionSecondaryActionClass}>Workflows</Link>
              <Link href="/sequences/import" className={collectionSecondaryActionClass}><Upload className="h-4 w-4" aria-hidden />Import</Link>
              <CollectionExportMenu filteredHref={exportHref} exportPath="/sequences/export" />
              <Link href="/sequences/new?category=dna-rna" className={collectionPrimaryActionClass}><Plus className="h-4 w-4" aria-hidden />New Sequence</Link>
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
                  header: <SequenceColumnFilter label="Sequence / apply" className="md:min-w-56"><div className="grid grid-cols-[1fr_auto] gap-1.5"><div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden /><input form={filterFormId} name="q" defaultValue={query ?? ""} placeholder="Name, code, target…" aria-label="Filter Sequences" className={`${tableFilterClass} pl-8`} /></div><button form={filterFormId} type="submit" className={filterApplyButtonClass}><Filter className="h-3.5 w-3.5" aria-hidden />Apply</button><select form={filterFormId} name="sort" defaultValue={sort} aria-label="Sort Sequences" className={`${tableFilterClass} col-span-2`}><option value="updated_desc">Recently updated</option><option value="name_asc">Name A–Z</option><option value="code_asc">Sequence code</option></select>{activeFilterCount > 0 || sort !== "updated_desc" ? <Link href="/sequences" className={`${filterClearButtonClass} col-span-2 justify-center`}>Clear filters</Link> : null}</div></SequenceColumnFilter>,
                  render: (row) => <div><div className="flex items-start justify-between gap-2"><Link href={row.href} className="font-semibold text-ink hover:text-moss">{row.name}</Link><span className="md:hidden"><StatusPill status={row.status} /></span></div><p className="mt-0.5 text-xs text-muted">{row.kind === "paired" ? `${pairTypeLabel(row.pairType ?? "paired")} · 2 members` : `v${row.versions[0]?.displayVersion}`}<span className="ml-2 font-mono text-[10px] text-muted/80">{row.code}</span></p>{row.kind === "paired" ? <p className="mt-1 font-mono text-[11px] text-muted md:hidden">{row.pairMembers.map((member) => `${member.role} ${sequenceLength(member.sequenceVersion.sequence)} nt`).join(" · ")}</p> : null}<p className="mt-1 text-[11px] text-muted md:hidden">{row.targetName ?? row.organism ?? row.project?.name ?? "Sequence library"}</p></div>,
                },
                {
                  key: "design",
                  className: "hidden md:table-cell",
                  header: <SequenceColumnFilter label="Design type" className="md:min-w-32"><select form={filterFormId} name="designType" defaultValue={designType ?? ""} aria-label="Filter Sequences by design type" className={tableFilterClass}><option value="">All design types</option>{sequenceDesignTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></SequenceColumnFilter>,
                  render: (row) => <Badge tone="sage">{designTypeLabel(row.designType)}</Badge>,
                },
                {
                  key: "molecule",
                  className: "hidden md:table-cell",
                  header: <SequenceColumnFilter label="Molecule" className="md:min-w-28"><select form={filterFormId} name="moleculeType" defaultValue={moleculeType ?? ""} aria-label="Filter Sequences by molecule type" className={tableFilterClass}><option value="">All molecules</option><option value="DNA">DNA</option><option value="RNA">RNA</option><option value="Protein">Amino acid</option></select></SequenceColumnFilter>,
                  render: (row) => {
                    if (row.kind === "paired") return <div><p>{pairTypeLabel(row.pairType ?? "paired")}</p><p className="font-mono text-xs text-muted">{row.pairMembers.map((member) => `${member.role} ${sequenceLength(member.sequenceVersion.sequence)} nt`).join(" · ")}</p></div>;
                    const version = row.versions[0];
                    return <div><p>{version?.moleculeType === "Protein" ? "Amino acid" : version?.moleculeType} · <span className="font-mono text-xs">{sequenceLength(version?.sequence ?? "")} {version?.moleculeType === "Protein" ? "aa" : "nt"}</span></p><p className="font-mono text-xs text-muted">{version?.topology} · {version?.strandedness}{version?.moleculeType === "Protein" ? "" : ` · GC ${gcPercent(version?.sequence ?? "")}%`}</p></div>;
                  },
                },
                { key: "target", className: "hidden md:table-cell", header: "Target / organism", render: (row) => <div><p>{row.targetName ?? "—"}</p><p className="text-xs text-muted">{row.organism ?? row.project?.name ?? "Sequence library"}</p></div> },
                {
                  key: "validation",
                  className: "hidden md:table-cell",
                  header: <SequenceColumnFilter label="Validation" className="md:min-w-40"><select form={filterFormId} name="validationStatus" defaultValue={validationStatus ?? ""} aria-label="Filter Sequences by validation" className={tableFilterClass}><option value="">All validation states</option>{sequenceValidationStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></SequenceColumnFilter>,
                  render: (row) => row.kind === "paired" ? <div className="flex flex-wrap gap-1">{row.pairMembers.map((member) => <StatusPill key={member.id} status={member.sequenceVersion.validationStatus} />)}</div> : <StatusPill status={row.versions[0]?.validationStatus ?? "unverified"} />,
                },
                {
                  key: "status",
                  className: "hidden md:table-cell",
                  header: <SequenceColumnFilter label="Lifecycle" className="md:min-w-28"><select form={filterFormId} name="status" defaultValue={status ?? ""} aria-label="Filter Sequences by lifecycle" className={tableFilterClass}><option value="">All lifecycle</option>{sequenceLifecycleStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></SequenceColumnFilter>,
                  render: (row) => <div className="space-y-1"><StatusPill status={row.status} /><p className="text-xs text-muted">{row.kind === "paired" ? "1 paired entry" : `${row.entityLinkCount} design ${row.entityLinkCount === 1 ? "link" : "links"}`}</p></div>,
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
              typeDisabledIds={pairRows.map((pair) => pair.id)}
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

const tableFilterClass = "focus-ring h-8 w-full rounded-[6px] border border-hairline bg-surface px-2 text-xs font-normal normal-case tracking-normal text-ink";
const filterApplyButtonClass = buttonStyles({ variant: "primary", size: "sm", className: "font-medium" });
const filterClearButtonClass = buttonStyles({ variant: "ghost", size: "sm", className: "font-medium text-muted" });

function SequenceColumnFilter({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <div className={`normal-case tracking-normal ${className}`}><span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</span><div className="mt-1.5 hidden md:block">{children}</div></div>;
}

function SequenceMobileFilters({ query, designType, moleculeType, status, validationStatus, sort, activeFilterCount }: { query?: string; designType?: string; moleculeType?: string; status?: string; validationStatus?: string; sort: string; activeFilterCount: number }) {
  return (
    <details className="relative md:hidden">
      <summary className="focus-ring flex h-9 cursor-pointer list-none items-center gap-2 rounded-[7px] border border-hairline bg-surface px-3 text-[13px] font-medium text-graphite"><Filter className="h-3.5 w-3.5" aria-hidden />Filters{activeFilterCount ? <span className="rounded-full bg-sage-surface px-1.5 py-0.5 font-mono text-[10px] text-moss">{activeFilterCount}</span> : null}</summary>
      <div className="absolute left-0 z-30 mt-2 w-[min(88vw,360px)] rounded-[10px] border border-hairline bg-surface p-3 shadow-soft">
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
