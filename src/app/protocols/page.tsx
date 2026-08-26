import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CollectionExportMenu } from "@/components/CollectionExportMenu";
import { CollectionToolbar, collectionPrimaryActionClass, collectionSecondaryActionClass } from "@/components/CollectionToolbar";
import { PageHeader } from "@/components/PageHeader";
import { BadgeLink, StatusPill } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { filterHref, firstOptionSearchParam, firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { protocolAvailabilityOptions, protocolReviewStageOptions, protocolScopeOptions } from "@/lib/status-options";

export const dynamic = "force-dynamic";

export default async function ProtocolsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const query = firstSearchParam(params, "q")?.trim();
  const availability = firstOptionSearchParam(params, "availability", protocolAvailabilityOptions) ?? firstOptionSearchParam(params, "status", protocolAvailabilityOptions);
  const scope = firstOptionSearchParam(params, "scope", protocolScopeOptions);
  const review = firstOptionSearchParam(params, "review", protocolReviewStageOptions);
  const sort = firstSearchParam(params, "sort") ?? "updated_desc";
  const orderBy = sort === "title_asc" ? [{ canonicalTitle: "asc" as const }, { title: "asc" as const }]
    : sort === "code_asc" ? { humanCode: "asc" as const }
      : { updatedAt: "desc" as const };
  const recycledIds = (await prisma.deletedRecord.findMany({ where: { targetType: "protocol", restoredAt: null }, select: { targetId: true } })).map((row) => row.targetId);
  const baseProtocols = await prisma.protocol.findMany({
    where: {
      id: { notIn: recycledIds },
      ...(availability ? { availability } : {}),
      ...(scope ? { scope } : {}),
      ...(query ? { OR: [
        { humanCode: { contains: query, mode: "insensitive" } },
        { title: { contains: query, mode: "insensitive" } },
        { canonicalTitle: { contains: query, mode: "insensitive" } },
        { englishTitle: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ] } : {}),
    },
    include: { versions: { orderBy: { revision: "desc" }, take: 1 }, project: true },
    orderBy,
  });
  const protocols = review ? baseProtocols.filter((protocol) => protocol.versions[0]?.reviewStage === review) : baseProtocols;
  const totalCount = await prisma.protocol.count({ where: { id: { notIn: recycledIds } } });
  const exportHref = filterHref("/protocols/export", { exportScope: "filtered", q: query, availability, scope, review, sort });

  return (
    <AppShell><div className="space-y-4">
      <PageHeader title="Protocols" />
      <CollectionToolbar
        path="/protocols"
        query={query}
        searchPlaceholder="Search protocol code, title, tags…"
        resultCount={protocols.length}
        totalCount={totalCount}
        sort={sort}
        defaultSort="updated_desc"
        filters={[
          { name: "scope", label: "scope", value: scope, options: protocolScopeOptions },
          { name: "availability", label: "availability", value: availability, options: protocolAvailabilityOptions },
          { name: "review", label: "review", value: review, options: protocolReviewStageOptions },
        ]}
        sortOptions={[
          { value: "updated_desc", label: "Recently updated" },
          { value: "code_asc", label: "Protocol code" },
          { value: "title_asc", label: "Title A–Z" },
        ]}
        actions={<>
          <Link href="/protocols/import" className={collectionSecondaryActionClass}><Upload className="h-4 w-4" aria-hidden />Import</Link>
          <CollectionExportMenu filteredHref={exportHref} exportPath="/protocols/export" />
          <Link href="/protocols/new" className={collectionPrimaryActionClass}><Plus className="h-4 w-4" aria-hidden />New Protocol</Link>
        </>}
      />
      <DataTable rows={protocols} getRowKey={(row) => row.id} emptyMessage="No Protocols match this view." selection={{ exportPath: "/protocols/export" }} columns={[
        { key: "protocol", header: "Protocol", render: (row) => <Link href={`/protocols/${row.id}`} className="block"><span className="font-mono text-xs text-muted">{row.humanCode ?? "—"}</span><span className="ml-2 font-semibold text-ink hover:text-moss">{row.canonicalTitle ?? row.title}</span></Link> },
        { key: "version", header: "Current version", render: (row) => row.versions[0] ? <span className="font-mono">{row.versions[0].displayVersion}</span> : "—" },
        { key: "review", header: "Review", render: (row) => row.versions[0] ? <StatusPill status={row.versions[0].reviewStage} href={filterHref("/protocols", { review: row.versions[0].reviewStage })} /> : "—" },
        { key: "availability", header: "Availability", render: (row) => <StatusPill status={row.availability} href={filterHref("/protocols", { availability: row.availability })} /> },
        { key: "scope", header: "Scope", render: (row) => <BadgeLink href={filterHref("/protocols", { scope: row.scope })} tone={row.scope === "general" ? "info" : "sage"}>{row.scope}</BadgeLink> },
        { key: "context", header: "Context", render: (row) => row.project ? <Link href={`/projects/${row.project.id}`} className="text-moss hover:underline">{row.project.name}</Link> : "Protocol library" },
      ]} />
    </div></AppShell>
  );
}
