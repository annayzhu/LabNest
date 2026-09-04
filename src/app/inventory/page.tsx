import type { ReactNode } from "react";
import Link from "next/link";
import { Filter, MapPin, Plus, Search, ShoppingCart, Upload, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CollectionExportMenu } from "@/components/CollectionExportMenu";
import {
  collectionPrimaryActionClass,
  collectionSecondaryActionClass,
} from "@/components/CollectionToolbar";
import { InventoryRiskBadges } from "@/components/InventoryRiskBadges";
import { MobileInventoryBench } from "@/components/MobileInventoryBench";
import { PageHeader } from "@/components/PageHeader";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { PurchaseStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { filterHref, firstOptionSearchParam, firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { getInventoryRiskFlags, inventoryCategories, type InventoryRiskFlag } from "@/lib/inventory";
import { objectStatusOptions } from "@/lib/status-options";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const query = firstSearchParam(params, "q")?.trim();
  const status = firstOptionSearchParam(params, "status", objectStatusOptions);
  const locationId = firstSearchParam(params, "location");
  const category = firstSearchParam(params, "category");
  const principalInvestigator = firstSearchParam(params, "pi");
  const flag = firstSearchParam(params, "flag") as InventoryRiskFlag | undefined;
  const sort = firstSearchParam(params, "sort") ?? "updated_desc";
  const now = new Date();

  const where = {
    ...(status ? { status } : {}),
    ...(locationId ? { locationId } : {}),
    ...(category ? { category } : {}),
    ...(principalInvestigator ? { principalInvestigator } : {}),
    ...(query ? {
      OR: [
        { name: { contains: query, mode: "insensitive" as const } },
        { englishName: { contains: query, mode: "insensitive" as const } },
        { principalInvestigator: { contains: query, mode: "insensitive" as const } },
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

  const [matchedItems, totalCount, locations, principalInvestigators, allStock, openPurchaseCount] = await Promise.all([
    prisma.inventoryItem.findMany({ where, include: { location: true }, orderBy }),
    prisma.inventoryItem.count(),
    prisma.inventoryLocation.findMany({ select: { id: true, name: true, status: true }, orderBy: { name: "asc" } }),
    prisma.inventoryItem.findMany({
      where: { principalInvestigator: { not: null } },
      distinct: ["principalInvestigator"],
      select: { principalInvestigator: true },
      orderBy: { principalInvestigator: "asc" },
    }),
    prisma.inventoryItem.findMany({ select: { id: true, currentQuantity: true, lowThreshold: true, expiryDate: true } }),
    prisma.purchaseRequest.count({ where: { status: { in: [PurchaseStatus.planned, PurchaseStatus.ordered, PurchaseStatus.received] } } }),
  ]);

  const itemsWithRisk = matchedItems.map((item) => ({ ...item, riskFlags: getInventoryRiskFlags(item, now) }));
  const items = flag ? itemsWithRisk.filter((item) => item.riskFlags.includes(flag)) : itemsWithRisk;
  const stockRisk = allStock.map((item) => getInventoryRiskFlags(item, now));
  const lowCount = stockRisk.filter((flags) => flags.includes("low")).length;
  const depletedCount = stockRisk.filter((flags) => flags.includes("depleted")).length;
  const expiryRiskCount = stockRisk.filter((flags) => flags.includes("expired") || flags.includes("expiring")).length;
  const piOptions = principalInvestigators.flatMap((item) => item.principalInvestigator ? [item.principalInvestigator] : []);
  const activeFilterCount = [query, status, locationId, category, principalInvestigator, flag].filter(Boolean).length;
  const hasActiveView = activeFilterCount > 0 || sort !== "updated_desc";
  const exportHref = filterHref("/inventory/export", { exportScope: "filtered", q: query, status, location: locationId, category, pi: principalInvestigator, flag, sort });
  const filterFormId = "inventory-table-filters";

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="hidden lg:block"><PageHeader title="Inventory" /></div>

        <MobileInventoryBench
          query={query}
          attentionCount={lowCount + depletedCount + expiryRiskCount}
          items={items.slice(0, 12).map((item) => ({
            id: item.id,
            name: item.name,
            subtitle: item.brand ?? item.vendor ?? item.category ?? "Unclassified",
            code: item.aliquotCode ?? item.barcode ?? item.lotNumber ?? item.catalogNumber ?? "",
            quantity: item.currentQuantity,
            unit: item.unit,
            location: item.location?.name ?? "Unassigned",
            risk: item.riskFlags.length > 0,
          }))}
        />

        <div className="hidden min-w-0 gap-5 lg:grid xl:grid-cols-[minmax(0,1fr)_220px] 2xl:grid-cols-[minmax(0,1fr)_240px]">
          <section className="min-w-0 space-y-4">
            <form id={filterFormId} action="/inventory" method="get" className="hidden" aria-hidden="true" />

            <section className="border-y border-hairline bg-surface" aria-label="Inventory tools">
              <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <InventoryMobileFilters
                    query={query}
                    status={status}
                    category={category}
                    locationId={locationId}
                    principalInvestigator={principalInvestigator}
                    flag={flag}
                    sort={sort}
                    locations={locations}
                    principalInvestigators={piOptions}
                    activeFilterCount={activeFilterCount}
                  />
                  <span className="whitespace-nowrap font-mono text-xs text-muted">
                    {items.length === totalCount ? `${totalCount} records` : `${items.length} of ${totalCount}`}
                  </span>
                  <div className="hidden items-center gap-1.5 md:flex">
                    <button form={filterFormId} type="submit" className={filterApplyButtonClass}>
                      <Filter className="h-3.5 w-3.5" aria-hidden />Apply
                    </button>
                    {hasActiveView ? (
                      <Link href="/inventory" className={filterClearButtonClass}>
                        <X className="h-3.5 w-3.5" aria-hidden />Clear
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link href="/inventory/locations" className={collectionSecondaryActionClass}><MapPin className="h-4 w-4" aria-hidden />Locations</Link>
                  <Link href="/purchases" className={collectionSecondaryActionClass}><ShoppingCart className="h-4 w-4" aria-hidden />Purchases</Link>
                  <Link href="/inventory/import" className={collectionSecondaryActionClass}><Upload className="h-4 w-4" aria-hidden />Import</Link>
                  <CollectionExportMenu filteredHref={exportHref} exportPath="/inventory/export" />
                  <Link href="/inventory/new" className={collectionPrimaryActionClass}><Plus className="h-4 w-4" aria-hidden />New Item</Link>
                </div>
              </div>
            </section>

            <DataTable
              rows={items}
              getRowKey={(row) => row.id}
              emptyMessage="No Inventory Items match this view."
              selection={{ exportPath: "/inventory/export" }}
              columns={[
                {
                  key: "name",
                  header: (
                    <InventoryColumnFilter label="Item" className="md:min-w-48">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
                        <input form={filterFormId} name="q" defaultValue={query ?? ""} placeholder="Name, barcode, lot…" aria-label="Filter Inventory by item" className={`${tableFilterClass} pl-8`} />
                      </div>
                    </InventoryColumnFilter>
                  ),
                  render: (row) => (
                    <div>
                      <Link href={`/inventory/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.name}</Link>
                      <p className="mt-0.5 text-xs text-muted">{row.englishName ?? row.brand ?? row.vendor ?? "No supplier metadata"}</p>
                    </div>
                  ),
                },
                {
                  key: "category",
                  header: (
                    <InventoryColumnFilter label="Category" className="md:min-w-36">
                      <select form={filterFormId} name="category" defaultValue={category ?? ""} aria-label="Filter Inventory by category" className={tableFilterClass}>
                        <option value="">All categories</option>
                        {inventoryCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </InventoryColumnFilter>
                  ),
                  render: (row) => <Badge tone="sage">{inventoryCategories.find((item) => item.value === row.category)?.label ?? row.category ?? "unclassified"}</Badge>,
                },
                {
                  key: "principal-investigator",
                  header: (
                    <InventoryColumnFilter label="PI" className="md:min-w-36">
                      <select form={filterFormId} name="pi" defaultValue={principalInvestigator ?? ""} aria-label="Filter Inventory by principal investigator" className={tableFilterClass}>
                        <option value="">All PIs</option>
                        {piOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </InventoryColumnFilter>
                  ),
                  render: (row) => row.principalInvestigator ?? <span className="text-muted">Unassigned</span>,
                },
                {
                  key: "quantity",
                  header: (
                    <InventoryColumnFilter label="Stock" className="md:min-w-36">
                      <select form={filterFormId} name="flag" defaultValue={flag ?? ""} aria-label="Filter Inventory by stock attention" className={tableFilterClass}>
                        <option value="">All stock states</option>
                        <option value="low">Low stock</option>
                        <option value="depleted">Out of stock</option>
                        <option value="expired">Expired</option>
                        <option value="expiring">Expires in 30 days</option>
                      </select>
                    </InventoryColumnFilter>
                  ),
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
                {
                  key: "location",
                  header: (
                    <InventoryColumnFilter label="Location" className="md:min-w-40">
                      <select form={filterFormId} name="location" defaultValue={locationId ?? ""} aria-label="Filter Inventory by location" className={tableFilterClass}>
                        <option value="">All locations</option>
                        {locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.status === "archived" ? " (archived)" : ""}</option>)}
                      </select>
                    </InventoryColumnFilter>
                  ),
                  render: (row) => <div><p>{row.location?.name ?? "Unassigned"}</p><p className="text-xs text-muted">{row.positionCode ?? "No position"}</p></div>,
                },
                {
                  key: "expiry",
                  header: (
                    <InventoryColumnFilter label="Expiry" className="md:min-w-36">
                      <select form={filterFormId} name="sort" defaultValue={sort} aria-label="Sort Inventory" className={tableFilterClass}>
                        <option value="updated_desc">Recently updated</option>
                        <option value="name_asc">Name A–Z</option>
                        <option value="expiry_asc">Expiry date</option>
                      </select>
                    </InventoryColumnFilter>
                  ),
                  render: (row) => row.expiryDate?.toLocaleDateString() ?? "—",
                },
                {
                  key: "status",
                  header: (
                    <InventoryColumnFilter label="Status" className="md:min-w-36">
                      <select form={filterFormId} name="status" defaultValue={status ?? ""} aria-label="Filter Inventory by status" className={tableFilterClass}>
                        <option value="">All statuses</option>
                        {objectStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </InventoryColumnFilter>
                  ),
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

const tableFilterClass = "focus-ring h-8 w-full rounded-[var(--ln-radius-control-sm)] border border-hairline bg-surface px-2 text-xs font-normal normal-case tracking-normal text-ink";
const filterApplyButtonClass = buttonStyles({ variant: "primary", size: "sm", className: "font-medium" });
const filterClearButtonClass = buttonStyles({ variant: "ghost", size: "sm", className: "font-medium text-muted" });

function InventoryColumnFilter({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`normal-case tracking-normal ${className}`}>
      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</span>
      <div className="mt-1.5 hidden md:block">{children}</div>
    </div>
  );
}

function InventoryMobileFilters({
  query,
  status,
  category,
  locationId,
  principalInvestigator,
  flag,
  sort,
  locations,
  principalInvestigators,
  activeFilterCount,
}: {
  query?: string;
  status?: string;
  category?: string;
  locationId?: string;
  principalInvestigator?: string;
  flag?: string;
  sort: string;
  locations: Array<{ id: string; name: string; status: string }>;
  principalInvestigators: string[];
  activeFilterCount: number;
}) {
  return (
    <details className="relative md:hidden">
      <summary className="focus-ring flex h-9 cursor-pointer list-none items-center gap-2 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-3 text-[13px] font-medium text-graphite hover:bg-warm">
        <Filter className="h-3.5 w-3.5" aria-hidden />
        Filters
        {activeFilterCount ? <span className="rounded-full bg-sage-surface px-1.5 py-0.5 font-mono text-[10px] text-moss">{activeFilterCount}</span> : null}
      </summary>
      <form action="/inventory" method="get" className="absolute left-0 top-11 z-30 grid w-[min(22rem,calc(100vw-2rem))] gap-3 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface p-4 shadow-soft">
        <MobileFilterField label="Item">
          <input name="q" defaultValue={query ?? ""} placeholder="Name, PI, barcode, lot, catalog…" className={tableFilterClass} />
        </MobileFilterField>
        <MobileFilterField label="Category">
          <select name="category" defaultValue={category ?? ""} className={tableFilterClass}>
            <option value="">All categories</option>
            {inventoryCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </MobileFilterField>
        <MobileFilterField label="Principal investigator">
          <select name="pi" defaultValue={principalInvestigator ?? ""} className={tableFilterClass}>
            <option value="">All PIs</option>
            {principalInvestigators.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </MobileFilterField>
        <MobileFilterField label="Location">
          <select name="location" defaultValue={locationId ?? ""} className={tableFilterClass}>
            <option value="">All locations</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.status === "archived" ? " (archived)" : ""}</option>)}
          </select>
        </MobileFilterField>
        <div className="grid grid-cols-2 gap-3">
          <MobileFilterField label="Stock">
            <select name="flag" defaultValue={flag ?? ""} className={tableFilterClass}>
              <option value="">All states</option>
              <option value="low">Low stock</option>
              <option value="depleted">Out of stock</option>
              <option value="expired">Expired</option>
              <option value="expiring">Expiring</option>
            </select>
          </MobileFilterField>
          <MobileFilterField label="Status">
            <select name="status" defaultValue={status ?? ""} className={tableFilterClass}>
              <option value="">All statuses</option>
              {objectStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </MobileFilterField>
        </div>
        <MobileFilterField label="Order">
          <select name="sort" defaultValue={sort} className={tableFilterClass}>
            <option value="updated_desc">Recently updated</option>
            <option value="name_asc">Name A–Z</option>
            <option value="expiry_asc">Expiry date</option>
          </select>
        </MobileFilterField>
        <div className="flex items-center justify-end gap-2 border-t border-hairline pt-3">
          <Link href="/inventory" className={collectionSecondaryActionClass}><X className="h-3.5 w-3.5" aria-hidden />Clear</Link>
          <button type="submit" className={collectionPrimaryActionClass}><Filter className="h-3.5 w-3.5" aria-hidden />Apply</button>
        </div>
      </form>
    </details>
  );
}

function MobileFilterField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-muted"><span>{label}</span>{children}</label>;
}

function Metric({ label, value, href, tone = "neutral" }: { label: string; value: number; href: string; tone?: "neutral" | "warning" | "danger" | "info" }) {
  const toneClass = tone === "danger" ? "text-error" : tone === "warning" ? "text-warning" : tone === "info" ? "text-info" : "text-ink";
  return (
    <Link href={href} className="focus-ring rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface p-4 shadow-paper transition hover:border-border-strong hover:bg-warm">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className={`mt-2 font-serif text-2xl font-medium leading-none ${toneClass}`}>{value}</p>
    </Link>
  );
}
