import Link from "next/link";
import { Download, Plus, ShoppingCart, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  CollectionToolbar,
  collectionPrimaryActionClass,
  collectionSecondaryActionClass,
} from "@/components/CollectionToolbar";
import { InventoryRiskBadges } from "@/components/InventoryRiskBadges";
import { PageHeader } from "@/components/PageHeader";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { filterHref, firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { getInventoryRiskFlags, inventoryCategories, type InventoryRiskFlag } from "@/lib/inventory";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const query = firstSearchParam(params, "q")?.trim();
  const status = firstSearchParam(params, "status");
  const locationId = firstSearchParam(params, "location");
  const category = firstSearchParam(params, "category");
  const flag = firstSearchParam(params, "flag") as InventoryRiskFlag | undefined;
  const sort = firstSearchParam(params, "sort") ?? "updated_desc";
  const now = new Date();

  const where = {
    ...(status ? { status: status as "active" | "inactive" | "archived" } : {}),
    ...(locationId ? { locationId } : {}),
    ...(category ? { category } : {}),
    ...(query ? {
      OR: [
        { name: { contains: query, mode: "insensitive" as const } },
        { englishName: { contains: query, mode: "insensitive" as const } },
        { barcode: { contains: query, mode: "insensitive" as const } },
        { aliquotCode: { contains: query, mode: "insensitive" as const } },
        { lotNumber: { contains: query, mode: "insensitive" as const } },
        { vendor: { contains: query, mode: "insensitive" as const } },
        { brand: { contains: query, mode: "insensitive" as const } },
        { catalogNumber: { contains: query, mode: "insensitive" as const } },
        { casNumber: { contains: query, mode: "insensitive" as const } },
      ],
    } : {}),
  };
  const orderBy = sort === "name_asc"
    ? { name: "asc" as const }
    : sort === "expiry_asc"
      ? { expiryDate: { sort: "asc" as const, nulls: "last" as const } }
      : { updatedAt: "desc" as const };

  const [matchedItems, totalCount, locations, allStock, openPurchaseCount] = await Promise.all([
    prisma.inventoryItem.findMany({ where, include: { location: true }, orderBy }),
    prisma.inventoryItem.count(),
    prisma.inventoryLocation.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.inventoryItem.findMany({ select: { id: true, currentQuantity: true, lowThreshold: true, expiryDate: true } }),
    prisma.purchaseRequest.count({ where: { status: { in: ["planned", "ordered", "received"] } } }),
  ]);

  const itemsWithRisk = matchedItems.map((item) => ({ ...item, riskFlags: getInventoryRiskFlags(item, now) }));
  const items = flag ? itemsWithRisk.filter((item) => item.riskFlags.includes(flag)) : itemsWithRisk;
  const stockRisk = allStock.map((item) => getInventoryRiskFlags(item, now));
  const lowCount = stockRisk.filter((flags) => flags.includes("low")).length;
  const depletedCount = stockRisk.filter((flags) => flags.includes("depleted")).length;
  const expiryRiskCount = stockRisk.filter((flags) => flags.includes("expired") || flags.includes("expiring")).length;
  const exportHref = filterHref("/inventory/export", { exportScope: "filtered", q: query, status, location: locationId, category, flag, sort });

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader title="Inventory" />

        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_220px] 2xl:grid-cols-[minmax(0,1fr)_240px]">
          <section className="min-w-0 space-y-4">
            <CollectionToolbar
              path="/inventory"
              query={query}
              searchPlaceholder="Search name, barcode, lot, catalog, CAS…"
              resultCount={items.length}
              totalCount={totalCount}
              sort={sort}
              defaultSort="updated_desc"
              filters={[
                { name: "status", label: "status", value: status, options: ["active", "inactive", "archived"].map((value) => ({ value, label: value })) },
                { name: "category", label: "categories", value: category, options: inventoryCategories.map((item) => ({ value: item.value, label: item.label })) },
                { name: "location", label: "locations", value: locationId, options: locations.map((location) => ({ value: location.id, label: location.name })) },
                {
                  name: "flag",
                  label: "stock flags",
                  value: flag,
                  options: [
                    { value: "low", label: "low stock" },
                    { value: "depleted", label: "out of stock" },
                    { value: "expired", label: "expired" },
                    { value: "expiring", label: "expires within 30 days" },
                  ],
                },
              ]}
              sortOptions={[
                { value: "updated_desc", label: "Recently updated" },
                { value: "name_asc", label: "Name A–Z" },
                { value: "expiry_asc", label: "Expiry date" },
              ]}
              actions={(
                <>
                  <Link href="/purchases" className={collectionSecondaryActionClass}><ShoppingCart className="h-4 w-4" aria-hidden />Purchases</Link>
                  <Link href="/inventory/import" className={collectionSecondaryActionClass}><Upload className="h-4 w-4" aria-hidden />Import</Link>
                  <Link href={exportHref} className={collectionSecondaryActionClass}><Download className="h-4 w-4" aria-hidden />Export…</Link>
                  <Link href="/inventory/new" className={collectionPrimaryActionClass}><Plus className="h-4 w-4" aria-hidden />New Item</Link>
                </>
              )}
            />

            <DataTable
              rows={items}
              getRowKey={(row) => row.id}
              emptyMessage="No Inventory Items match this view."
              selection={{ exportPath: "/inventory/export" }}
              columns={[
                {
                  key: "name",
                  header: "Item",
                  render: (row) => (
                    <div>
                      <Link href={`/inventory/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.name}</Link>
                      <p className="mt-0.5 text-xs text-muted">{row.englishName ?? row.brand ?? row.vendor ?? "No supplier metadata"}</p>
                    </div>
                  ),
                },
                {
                  key: "category",
                  header: "Category",
                  render: (row) => <Badge tone="sage">{inventoryCategories.find((item) => item.value === row.category)?.label ?? row.category ?? "unclassified"}</Badge>,
                },
                {
                  key: "quantity",
                  header: "Stock",
                  render: (row) => (
                    <div>
                      <span className="font-mono">{row.currentQuantity} {row.unit}</span>
                      {row.lowThreshold == null ? null : <p className="mt-0.5 text-xs text-muted">safety {row.lowThreshold} {row.unit}</p>}
                    </div>
                  ),
                },
                {
                  key: "identity",
                  header: "Lot / catalog",
                  render: (row) => <div className="font-mono text-xs"><p>{row.lotNumber ?? "—"}</p><p className="text-muted">{row.catalogNumber ?? row.casNumber ?? "—"}</p></div>,
                },
                { key: "location", header: "Location", render: (row) => <div><p>{row.location?.name ?? "Unassigned"}</p><p className="text-xs text-muted">{row.positionCode ?? "No position"}</p></div> },
                { key: "expiry", header: "Expiry", render: (row) => row.expiryDate?.toLocaleDateString() ?? "—" },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <div className="space-y-1.5"><StatusPill status={row.status} /><InventoryRiskBadges flags={row.riskFlags} linkToFilters /></div>,
                },
              ]}
            />
          </section>

          <aside aria-label="Inventory dashboard" className="grid gap-3 sm:grid-cols-2 xl:sticky xl:top-24 xl:grid-cols-1 xl:self-start">
            <Metric label="Registered items" value={totalCount} href="/inventory" />
            <Metric label="Low stock" value={lowCount} href="/inventory?flag=low" tone={lowCount ? "warning" : "neutral"} />
            <Metric label="Out of stock" value={depletedCount} href="/inventory?flag=depleted" tone={depletedCount ? "danger" : "neutral"} />
            <Metric label="Expiry attention" value={expiryRiskCount} href="/inventory?sort=expiry_asc" tone={expiryRiskCount ? "warning" : "neutral"} />
            <Metric label="Open purchases" value={openPurchaseCount} href="/purchases" tone={openPurchaseCount ? "info" : "neutral"} />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ label, value, href, tone = "neutral" }: { label: string; value: number; href: string; tone?: "neutral" | "warning" | "danger" | "info" }) {
  const toneClass = tone === "danger" ? "text-error" : tone === "warning" ? "text-warning" : tone === "info" ? "text-info" : "text-ink";
  return (
    <Link href={href} className="focus-ring rounded-[10px] border border-hairline bg-surface p-4 shadow-paper transition hover:border-border-strong hover:bg-warm">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className={`mt-2 font-serif text-2xl font-medium leading-none ${toneClass}`}>{value}</p>
    </Link>
  );
}
