import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { collectionPrimaryActionClass, collectionSecondaryActionClass, CollectionToolbar } from "@/components/CollectionToolbar";
import { SequenceCollectionBatchActions } from "@/components/SequenceCollectionBatchActions";
import { PageHeader } from "@/components/PageHeader";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { bulkUpdateSequenceCollections } from "../actions";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { collectionTypeLabel, sequenceCollectionTypes, sequenceLifecycleStatuses } from "@/lib/sequence-registry";

export const dynamic = "force-dynamic";

export default async function SequenceCollectionsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const query = firstSearchParam(params, "q")?.trim();
  const type = firstSearchParam(params, "type");
  const status = firstSearchParam(params, "status");
  const [collections, totalCount, projects] = await Promise.all([
    prisma.sequenceCollection.findMany({
      where: { ...(type ? { type: type as never } : {}), ...(status ? { status: status as never } : {}), ...(query ? { OR: [{ code: { contains: query, mode: "insensitive" } }, { name: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }] } : {}) },
      include: { project: { select: { name: true } }, members: { include: { sequenceVersion: { include: { sequenceRecord: { select: { name: true } } } } }, orderBy: { order: "asc" } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.sequenceCollection.count(),
    prisma.project.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title="Sequence Collections" />
        <CollectionToolbar
          path="/sequences/collections"
          query={query}
          searchPlaceholder="Collection name or code…"
          filters={[
            { name: "type", label: "types", value: type, options: sequenceCollectionTypes.map((item) => ({ value: item.value, label: item.label })) },
            { name: "status", label: "statuses", value: status, options: sequenceLifecycleStatuses.map((item) => ({ value: item.value, label: item.label })) },
          ]}
          resultCount={collections.length}
          totalCount={totalCount}
          actions={<><Link href="/sequences" className={collectionSecondaryActionClass}><ArrowLeft className="h-4 w-4" aria-hidden />Sequences</Link><Link href="/sequences/collections/new" className={collectionPrimaryActionClass}><Plus className="h-4 w-4" aria-hidden />New Collection</Link></>}
        />
        <SequenceCollectionBatchActions
          selectionGroup="/sequences/collections/export"
          targetName="组合条目"
          typeLabel="类型"
          typeOptions={sequenceCollectionTypes}
          projects={projects}
          action={bulkUpdateSequenceCollections}
        />
        <DataTable
          rows={collections}
          getRowKey={(row) => row.id}
          emptyMessage="No Sequence Collections match this view."
          selection={{ exportPath: "/sequences/collections/export" }}
          columns={[
            { key: "name", header: "Collection", render: (row) => <div><Link href={`/sequences/collections/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.name}</Link><p className="font-mono text-xs text-muted">{row.code}</p></div> },
            { key: "type", header: "Type", render: (row) => <Badge tone="sage">{collectionTypeLabel(row.type)}</Badge> },
            { key: "members", header: "Exact members", render: (row) => <div><p>{row.members.length} {row.members.length === 1 ? "member" : "members"}</p><p className="max-w-96 truncate text-xs text-muted">{row.members.map((member) => `${member.role}: ${member.sequenceVersion.sequenceRecord.name} v${member.sequenceVersion.displayVersion}`).join(" · ") || "—"}</p></div> },
            { key: "project", header: "Project", render: (row) => row.project?.name ?? "Shared library" },
            { key: "status", header: "Lifecycle", render: (row) => <StatusPill status={row.status} /> },
          ]}
        />
      </div>
    </AppShell>
  );
}
