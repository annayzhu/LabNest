import Link from "next/link";
import { MapPin, Plus, ShoppingCart } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CollectionExportMenu } from "@/components/CollectionExportMenu";
import { CollectionToolbar, collectionPrimaryActionClass, collectionSecondaryActionClass } from "@/components/CollectionToolbar";
import { InventoryBulkActions } from "@/components/InventoryBulkActions";
import { InventoryNav } from "@/components/InventoryNav";
import { InventoryReturnPoint } from "@/components/InventoryBackLink";
import { InventoryRiskBadges } from "@/components/InventoryRiskBadges";
import { MobileInventoryBench } from "@/components/MobileInventoryBench";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { filterHref, firstOptionSearchParam, firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { lotRiskFlags, type InventoryRiskFlag } from "@/lib/inventory";
import { QuantityText } from "@/components/InventoryDetail";
import { locationWithin } from "@/lib/inventory-location-lifecycle";
import { stockFormLocations } from "@/lib/inventory-products.server";
import { stockSearchWhere } from "@/lib/inventory-search";
import { inventoryGroupName } from "@/lib/inventory-types";
import { objectStatusOptions } from "@/lib/status-options";

export const dynamic = "force-dynamic";

const flagOptions = [
  { value: "low", label: "Low stock" },
  { value: "depleted", label: "Out of stock" },
  { value: "expired", label: "Expired" },
  { value: "expiring", label: "Expires in 30 days" },
  { value: "held", label: "In use" },
];

/** Every lot in the lab, one row each, with search, filters and bulk actions; the inventory home finds single things faster. */
export default async function InventoryListPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const query = firstSearchParam(params, "q")?.trim();
  const status = firstOptionSearchParam(params, "status", objectStatusOptions);
  const locationId = firstSearchParam(params, "location");
  const groupKey = firstSearchParam(params, "group");
  const typeId = firstSearchParam(params, "type");
  const principalInvestigator = firstSearchParam(params, "pi");
  const flag = firstSearchParam(params, "flag") as InventoryRiskFlag | "held" | undefined;
  const sort = firstSearchParam(params, "sort") ?? "updated_desc";
  const now = new Date();
  // A location's stock includes what sits in the places inside it (Q194).
  const within = locationId ? locationWithin(await prisma.inventoryLocation.findMany({ select: { id: true, parentLocationId: true } }), locationId) : [];

  const where = {
    ...(status ? { status } : {}),
    ...(locationId ? { locationId: { in: within } } : {}),
    ...(groupKey || typeId ? { product: { ...(groupKey ? { groupKey: groupKey === "none" ? null : groupKey } : {}), ...(typeId ? { typeId } : {}) } } : {}),
    ...(principalInvestigator ? { principalInvestigator } : {}),
    // In use: a container of it is out of the store with someone.
    ...(flag === "held" ? { containers: { some: { state: "held" } } } : {}),
    ...(query ? stockSearchWhere(query) : {}),
  };
  const orderBy = sort === "name_asc" ? { name: "asc" as const } : sort === "expiry_asc" ? { expiryDate: { sort: "asc" as const, nulls: "last" as const } } : { updatedAt: "desc" as const };

  const [matchedItems, totalCount, locations, groups, types, principalInvestigators, allStock] = await Promise.all([
    prisma.inventoryItem.findMany({ where, include: { location: true, product: { include: { type: { select: { label: true } } } } }, orderBy }),
    prisma.inventoryItem.count(),
    stockFormLocations(prisma),
    prisma.inventoryGroup.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.scientificSchemaDefinition.findMany({ where: { inventoryGroupKey: { not: null } }, select: { id: true, label: true }, orderBy: { label: "asc" } }),
    prisma.inventoryItem.findMany({ where: { principalInvestigator: { not: null } }, distinct: ["principalInvestigator"], select: { principalInvestigator: true }, orderBy: { principalInvestigator: "asc" } }),
    prisma.inventoryItem.findMany({ select: { id: true, productId: true, currentQuantity: true, unit: true, quantityRecorded: true, status: true, lowThreshold: true, expiryDate: true, product: { select: { lowThreshold: true, lowThresholdUnit: true } } } }),
  ]);

  const lotsByProduct = Map.groupBy(allStock, (lot) => lot.productId ?? lot.id);
  const flagsOf = (lot: (typeof allStock)[number] | (typeof matchedItems)[number]) => lotRiskFlags(lot, lot.product, lotsByProduct.get(lot.productId ?? lot.id) ?? [], now);
  const itemsWithRisk = matchedItems.map((item) => ({ ...item, riskFlags: flagsOf(item) }));
  const items = flag && flag !== "held" ? itemsWithRisk.filter((item) => item.riskFlags.includes(flag)) : itemsWithRisk;
  const stockRisk = allStock.filter((lot) => lot.status === "active").map(flagsOf);
  const count = (wanted: InventoryRiskFlag) => stockRisk.filter((flags) => flags.includes(wanted)).length;
  const groupNames = new Map(groups.map((group) => [group.key, inventoryGroupName(group)]));
  const piOptions = principalInvestigators.flatMap((item) => item.principalInvestigator ? [item.principalInvestigator] : []);
  const exportHref = filterHref("/inventory/export", { exportScope: "filtered", q: query, status, location: locationId, group: groupKey, type: typeId, pi: principalInvestigator, flag, sort });
  const scopeLocation = locations.find((location) => location.id === locationId);
  const scope = scopeLocation ? <LocationScope name={scopeLocation.name} temperature={scopeLocation.temperature} inside={within.length - 1} clearHref={filterHref("/inventory/list", { q: query, status, group: groupKey, type: typeId, pi: principalInvestigator, flag, sort: sort === "updated_desc" ? undefined : sort })} /> : null;

  return (
    <AppShell>
      <div className="space-y-4">
        <MobileInventoryBench
          query={query}
          scope={scope}
          key={JSON.stringify([query, status, locationId, groupKey, typeId, principalInvestigator, flag, sort])}
          totalCount={totalCount}
          filters={{ status, location: locationId, group: groupKey, type: typeId, pi: principalInvestigator, flag, sort: sort === "updated_desc" ? undefined : sort }}
          riskCounts={{ low: count("low"), depleted: count("depleted"), expired: count("expired"), expiring: count("expiring") }}
          items={items.map((item) => ({
            id: item.id,
            name: item.name,
            subtitle: item.product?.type?.label ?? (item.product?.groupKey ? groupNames.get(item.product.groupKey) : undefined) ?? item.brand ?? item.vendor ?? "To be classified",
            code: item.aliquotCode ?? item.barcode ?? item.lotNumber ?? item.catalogNumber ?? "",
            quantity: item.currentQuantity,
            quantityRecorded: item.quantityRecorded,
            lot: item.lotNumber ?? "",
            unit: item.unit,
            location: [item.location?.name, item.positionCode].filter(Boolean).join(" · "),
            riskFlags: item.riskFlags,
          }))}
        />

        <div className="hidden space-y-4 lg:block">
          <PageHeader title="Inventory" />
          <InventoryNav current="list" />
          {scope}
          <InventoryReturnPoint href={filterHref("/inventory/list", { q: query, status, location: locationId, group: groupKey, type: typeId, pi: principalInvestigator, flag, sort: sort === "updated_desc" ? undefined : sort })} label="Stock list" />
          <CollectionToolbar
            path="/inventory/list"
            query={query}
            searchPlaceholder="Name, lot, barcode, catalogue, PI…"
            resultCount={items.length}
            totalCount={totalCount}
            sort={sort}
            defaultSort="updated_desc"
            filters={[
              { name: "group", label: "groups", value: groupKey, options: [...groups.map((group) => ({ value: group.key, label: inventoryGroupName(group) })), { value: "none", label: "To be classified" }] },
              { name: "type", label: "types", value: typeId, options: types.map((type) => ({ value: type.id, label: type.label })) },
              { name: "flag", label: "stock states", value: flag, options: flagOptions },
              { name: "location", label: "locations", value: locationId, options: locations.map((location) => ({ value: location.id, label: location.status === "archived" ? `${location.name} (archived)` : location.name })) },
              { name: "pi", label: "PIs", value: principalInvestigator, options: piOptions.map((value) => ({ value, label: value })) },
              { name: "status", label: "statuses", value: status, options: objectStatusOptions },
            ]}
            sortOptions={[
              { value: "updated_desc", label: "Recently updated" },
              { value: "name_asc", label: "Name A–Z" },
              { value: "expiry_asc", label: "Expiry date" },
            ]}
            actions={<>
              <Link href="/purchases" className={collectionSecondaryActionClass}><ShoppingCart className="h-4 w-4" aria-hidden />Purchases</Link>
              <CollectionExportMenu filteredHref={exportHref} exportPath="/inventory/export" importHref="/inventory/import" />
              <Link href="/inventory/new" className={collectionPrimaryActionClass}><Plus className="h-4 w-4" aria-hidden />Register stock</Link>
            </>}
          />


          <DataTable
            rows={items}
            getRowKey={(row) => row.id}
            emptyMessage="No stock matches this view."
            selection={{ exportPath: "/inventory/export", actions: <InventoryBulkActions kind="stock" locations={locations.filter((location) => location.status !== "archived").map((location) => ({ value: location.id, label: location.name }))} /> }}
            columns={[
              {
                key: "name",
                header: "Item",
                minWidth: 220,
                render: (row) => (
                  <div className="min-w-0">
                    <Link href={`/inventory/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.name}</Link>
                    <p className="mt-0.5 truncate text-xs text-muted">{[row.brand, row.catalogNumber].filter(Boolean).join(" · ") || row.englishName || row.vendor || "—"}</p>
                  </div>
                ),
              },
              {
                key: "class",
                header: "Type",
                render: (row) => row.product?.groupKey ? (
                  <div>
                    <p>{row.product.type?.label ?? "Not subdivided"}</p>
                    <p className="mt-0.5 text-xs text-muted">{groupNames.get(row.product.groupKey)}</p>
                  </div>
                ) : <Badge tone="warning">To be classified</Badge>,
              },
              {
                key: "quantity",
                header: "Stock",
                render: (row) => (
                  <div>
                    <QuantityText quantity={row.currentQuantity} unit={row.unit} recorded={row.quantityRecorded} />
                    {row.product?.lowThreshold != null ? <p className="mt-0.5 text-xs text-muted"><span>Safety stock</span> <QuantityText quantity={row.product.lowThreshold} unit={row.product.lowThresholdUnit} /></p> : null}
                  </div>
                ),
              },
              {
                key: "lot",
                header: "Lot / expiry",
                render: (row) => <div className="font-mono text-xs"><p>{row.lotNumber ?? "—"}</p><p className="text-muted">{row.expiryDate?.toISOString().slice(0, 10) ?? "—"}</p></div>,
              },
              {
                key: "location",
                header: "Location",
                render: (row) => <div><p>{row.location?.name ?? "Unassigned"}</p>{row.positionCode ? <p className="text-xs text-muted">{row.positionCode}</p> : null}</div>,
              },
              {
                key: "principal-investigator",
                header: "PI",
                render: (row) => row.principalInvestigator ?? <span className="text-muted">—</span>,
              },
              {
                key: "status",
                header: "Attention",
                render: (row) => row.status === "archived" ? <span className="text-xs text-muted">Archived</span> : <InventoryRiskBadges flags={row.riskFlags} linkToFilters />,
              },
            ]}
          />
        </div>
      </div>
    </AppShell>
  );
}

/** The location the list is filtered to, with its path and temperature, and a way back to all stock (Q194). */
function LocationScope({ name, temperature, inside, clearHref }: { name: string; temperature: string | null; inside: number; clearHref: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface px-3 py-2 text-sm text-graphite">
      <MapPin className="h-4 w-4 shrink-0 text-moss" aria-hidden />
      <span className="font-medium text-ink">{name}</span>
      {temperature ? <span className="text-muted">{temperature}</span> : null}
      {inside ? <span className="text-muted">{`With ${inside} places inside`}</span> : null}
      <Link href={clearHref} className="ml-auto font-medium text-moss hover:underline">Every location</Link>
    </p>
  );
}
