import { AppShell } from "@/components/AppShell";
import { ActiveFilterBar, type ActiveFilter } from "@/components/ActiveFilterBar";
import { PageHeader } from "@/components/PageHeader";
import { BadgeLink, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { inventoryItems, inventoryTransactions, sampleProfiles } from "@/lib/demo-data";
import { filterHref, firstSearchParam, type PageSearchParams } from "@/lib/filters";

export default async function InventoryPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const status = firstSearchParam(params, "status");
  const flag = firstSearchParam(params, "flag");
  const txType = firstSearchParam(params, "txType");
  const sampleNameByEntityId = new Map(sampleProfiles.map((sample) => [sample.entityId, sample.name]));
  const filteredInventoryItems = inventoryItems.filter((item) => {
    const isLow = item.lowThreshold !== undefined && item.currentQuantity < item.lowThreshold;
    const isExpiring = item.expiryDate?.startsWith("2026-07") ?? false;
    return (
      (!status || item.status === status) &&
      (!flag || (flag === "low" && isLow) || (flag === "expiring" && isExpiring))
    );
  });
  const sampleAliquots = filteredInventoryItems.filter((item) => item.entityId && sampleNameByEntityId.has(item.entityId));
  const filteredTransactions = inventoryTransactions.filter((transaction) => !txType || transaction.type === txType);
  const itemFilters: ActiveFilter[] = [];
  const transactionFilters: ActiveFilter[] = [];

  if (status) itemFilters.push({ label: "status", value: status });
  if (flag) itemFilters.push({ label: "flag", value: flag });
  if (txType) transactionFilters.push({ label: "transaction", value: txType });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Scientific materials database"
          title="Inventory"
          description="Inventory quantity is transaction-derived. Direct quantity edits should become adjust transactions for auditability."
        />

        <Card>
          <CardHeader title="Inventory Items" eyebrow="Current stock" />
          <CardBody>
            <ActiveFilterBar
              filters={itemFilters}
              clearHref="/inventory"
              resultCount={filteredInventoryItems.length}
              totalCount={inventoryItems.length}
            />
            <DataTable
              rows={filteredInventoryItems}
              getRowKey={(row) => row.id}
              className="mt-4"
              columns={[
                { key: "name", header: "Item", render: (row) => <span className="font-semibold text-ink">{row.name}</span> },
                {
                  key: "barcode",
                  header: "Barcode",
                  render: (row) => <span className="font-mono text-xs">{row.aliquotCode ?? row.barcode ?? "not set"}</span>,
                },
                {
                  key: "quantity",
                  header: "Quantity",
                  render: (row) => (
                    <span className="font-mono">
                      {row.currentQuantity} {row.unit}
                    </span>
                  ),
                },
                { key: "lot", header: "Lot", render: (row) => <span className="font-mono text-xs">{row.lotNumber}</span> },
                { key: "location", header: "Location", render: (row) => row.location },
                { key: "position", header: "Position", render: (row) => row.positionCode ?? "not tracked" },
                { key: "expiry", header: "Expiry", render: (row) => row.expiryDate ?? "not set" },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => (
                    <div className="flex flex-wrap gap-2">
                      <StatusPill status={row.status} href={filterHref("/inventory", { status: row.status })} />
                      {row.lowThreshold !== undefined && row.currentQuantity < row.lowThreshold ? (
                        <BadgeLink href={filterHref("/inventory", { flag: "low" })} tone="warning">
                          low
                        </BadgeLink>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Sample-Linked Aliquots" eyebrow="Biological source separated from vial stock" />
          <CardBody>
            <DataTable
              rows={sampleAliquots}
              getRowKey={(row) => row.id}
              columns={[
                {
                  key: "sample",
                  header: "Sample",
                  render: (row) => (row.entityId ? sampleNameByEntityId.get(row.entityId) : "unlinked sample"),
                },
                { key: "aliquot", header: "Aliquot", render: (row) => <span className="font-mono text-xs">{row.aliquotCode}</span> },
                { key: "position", header: "Position", render: (row) => row.positionCode ?? "not set" },
                { key: "location", header: "Location", render: (row) => row.location },
                { key: "freezeThaw", header: "Freeze-thaw", render: (row) => row.freezeThawCount ?? 0 },
                {
                  key: "quantity",
                  header: "Remaining",
                  render: (row) => (
                    <span className="font-mono">
                      {row.currentQuantity} {row.unit}
                    </span>
                  ),
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Transaction History" eyebrow="Audit source" />
          <CardBody>
            <ActiveFilterBar
              filters={transactionFilters}
              clearHref="/inventory"
              resultCount={filteredTransactions.length}
              totalCount={inventoryTransactions.length}
            />
            <DataTable
              rows={filteredTransactions}
              getRowKey={(row) => row.id}
              className="mt-4"
              columns={[
                {
                  key: "type",
                  header: "Type",
                  render: (row) => (
                    <BadgeLink href={filterHref("/inventory", { txType: row.type })} tone="sage">
                      {row.type}
                    </BadgeLink>
                  ),
                },
                { key: "item", header: "Item ID", render: (row) => <span className="font-mono text-xs">{row.inventoryItemId}</span> },
                {
                  key: "change",
                  header: "Change",
                  render: (row) => (
                    <span className="font-mono">
                      {row.quantityChange > 0 ? "+" : ""}
                      {row.quantityChange} {row.unit}
                    </span>
                  ),
                },
                { key: "notes", header: "Notes", render: (row) => row.notes },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
