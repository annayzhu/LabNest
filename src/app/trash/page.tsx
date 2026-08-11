import { format } from "date-fns";
import { AppShell } from "@/components/AppShell";
import { CollectionToolbar } from "@/components/CollectionToolbar";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { RecycleBinActions } from "@/components/RecycleBinActions";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { recyclableRecordTypes, recycleBinTypeLabel } from "@/lib/recycle-bin";

export const dynamic = "force-dynamic";

export default async function TrashPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const query = firstSearchParam(params, "q")?.trim();
  const type = firstSearchParam(params, "type");
  const where = {
    restoredAt: null,
    ...(type && recyclableRecordTypes.includes(type as (typeof recyclableRecordTypes)[number]) ? { targetType: type } : {}),
    ...(query ? { OR: [
      { identifier: { contains: query, mode: "insensitive" as const } },
      { title: { contains: query, mode: "insensitive" as const } },
    ] } : {}),
  };
  const [records, totalCount] = await Promise.all([
    prisma.deletedRecord.findMany({ where, orderBy: { deletedAt: "desc" } }),
    prisma.deletedRecord.count({ where: { restoredAt: null } }),
  ]);

  return (
    <AppShell><div className="space-y-5">
      <PageHeader title="Recycle Bin" description="Deleted draft records remain recoverable here until you explicitly delete their recovery snapshot forever." />
      <Card><CardBody><p className="text-sm leading-6 text-graphite">Restoring keeps the original record ID, code, scientific content, template snapshot, and recoverable links. Restore may be blocked if another record has reused the same unique code or a required parent record was later removed.</p></CardBody></Card>
      <CollectionToolbar
        path="/trash"
        query={query}
        searchPlaceholder="Search deleted records…"
        resultCount={records.length}
        totalCount={totalCount}
        filters={[{ name: "type", label: "record types", value: type, options: recyclableRecordTypes.map((value) => ({ value, label: recycleBinTypeLabel(value) })) }]}
      />
      {records.length ? <DataTable rows={records} getRowKey={(row) => row.id} columns={[
        { key: "record", header: "Deleted record", render: (row) => <div><p className="font-semibold text-ink">{row.title}</p><p className="mt-1 font-mono text-xs text-muted">{row.identifier}</p></div> },
        { key: "type", header: "Type", render: (row) => <Badge tone="sage">{recycleBinTypeLabel(row.targetType)}</Badge> },
        { key: "deleted", header: "Deleted", render: (row) => <time dateTime={row.deletedAt.toISOString()}>{format(row.deletedAt, "yyyy-MM-dd HH:mm")}</time> },
        { key: "actions", header: "Actions", className: "text-right", render: (row) => <RecycleBinActions id={row.id} identifier={row.identifier} title={row.title} /> },
      ]} /> : <EmptyState title="Recycle Bin is empty" body="Deleted draft records will appear here and can be restored." actionLabel="Browse results" actionHref="/results" />}
    </div></AppShell>
  );
}
