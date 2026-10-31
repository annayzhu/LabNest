import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CollectionToolbar, collectionPrimaryActionClass } from "@/components/CollectionToolbar";
import { InventoryNav } from "@/components/InventoryNav";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { QuantityText } from "@/components/InventoryDetail";
import { prisma } from "@/lib/db";
import { firstOptionSearchParam, firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { controlLevelName, isStrictlyControlled, productSafetyStock } from "@/lib/inventory";
import { inventoryGroupName } from "@/lib/inventory-types";
import { objectStatusOptions } from "@/lib/status-options";

export const dynamic = "force-dynamic";


export default async function InventoryProductsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const query = firstSearchParam(params, "q")?.trim();
  const groupKey = firstSearchParam(params, "group");
  const typeId = firstSearchParam(params, "type");
  const flag = firstSearchParam(params, "flag");
  const status = firstOptionSearchParam(params, "status", objectStatusOptions);
  const sort = firstSearchParam(params, "sort") ?? "name_asc";
  const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });

  const [products, totalCount, groups, types, sdsLinks] = await Promise.all([
    prisma.inventoryProduct.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(groupKey ? { groupKey: groupKey === "none" ? null : groupKey } : {}),
        ...(typeId ? { typeId } : {}),
        ...(query ? { OR: [{ name: contains(query) }, { englishName: contains(query) }, { brand: contains(query) }, { catalogNumber: contains(query) }, { casNumber: contains(query) }] } : {}),
      },
      include: { type: { select: { label: true } }, items: { select: { currentQuantity: true, unit: true, quantityRecorded: true, status: true } } },
      orderBy: sort === "updated_desc" ? { updatedAt: "desc" } : { name: "asc" },
    }),
    prisma.inventoryProduct.count(),
    prisma.inventoryGroup.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.scientificSchemaDefinition.findMany({ where: { inventoryGroupKey: { not: null } }, select: { id: true, label: true }, orderBy: { label: "asc" } }),
    prisma.attachmentLink.findMany({ where: { targetType: "inventory_product", linkType: "sds" }, select: { targetId: true } }),
  ]);

  const withSds = new Set(sdsLinks.map((link) => link.targetId));
  const groupNames = new Map(groups.map((group) => [group.key, inventoryGroupName(group)]));
  const rows = products.map((product) => {
    return {
      ...product,
      ...productSafetyStock(product, product.items),
      sdsMissing: isStrictlyControlled(product.controlLevels) && !withSds.has(product.id),
      activeLots: product.items.filter((lot) => lot.status === "active").length,
    };
  }).filter((row) => flag === "sds" ? row.sdsMissing : flag === "low" ? row.low : true);

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title="Inventory" />
        <InventoryNav current="products" />
        <CollectionToolbar
          path="/inventory/products"
          query={query}
          searchPlaceholder="Name, brand, catalogue, CAS…"
          resultCount={rows.length}
          totalCount={totalCount}
          sort={sort}
          defaultSort="name_asc"
          filters={[
            { name: "group", label: "groups", value: groupKey, options: [...groups.map((group) => ({ value: group.key, label: inventoryGroupName(group) })), { value: "none", label: "To be classified" }] },
            { name: "type", label: "types", value: typeId, options: types.map((type) => ({ value: type.id, label: type.label })) },
            { name: "flag", label: "attention", value: flag, options: [{ value: "low", label: "Low stock" }, { value: "sds", label: "SDS missing" }] },
            { name: "status", label: "statuses", value: status, options: objectStatusOptions },
          ]}
          sortOptions={[{ value: "name_asc", label: "Name A–Z" }, { value: "updated_desc", label: "Recently updated" }]}
          actions={<Link href="/inventory/products/new" className={collectionPrimaryActionClass}><Plus className="h-4 w-4" aria-hidden />New product</Link>}
        />
        <DataTable
          rows={rows}
          getRowKey={(row) => row.id}
          emptyMessage="No products match this view."
          columns={[
            {
              key: "name",
              header: "Product",
              minWidth: 220,
              render: (row) => (
                <div className="min-w-0">
                  <Link href={`/inventory/products/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.name}</Link>
                  <p className="mt-0.5 truncate text-xs text-muted">{[row.brand, row.catalogNumber].filter(Boolean).join(" · ") || row.englishName || "—"}</p>
                </div>
              ),
            },
            {
              key: "type",
              header: "Type",
              render: (row) => row.groupKey ? <div><p>{row.type?.label ?? "Not subdivided"}</p><p className="mt-0.5 text-xs text-muted">{groupNames.get(row.groupKey)}</p></div> : <Badge tone="warning">To be classified</Badge>,
            },
            {
              key: "stock",
              header: "Stock",
              render: (row) => row.total !== undefined
                ? <div><QuantityText quantity={row.total} unit={row.lowThresholdUnit} /><p className="mt-0.5 text-xs text-muted"><span>Safety stock</span> <QuantityText quantity={row.lowThreshold ?? 0} unit={row.lowThresholdUnit} /></p></div>
                : <span className="text-muted">—</span>,
            },
            { key: "lots", header: "Lots", render: (row) => <span className="tabular-nums">{row.activeLots}</span> },
            {
              key: "control",
              header: "Control level",
              render: (row) => row.controlLevels.length ? <div className="flex flex-wrap gap-1">{row.controlLevels.map((level) => <Badge key={level} tone={isStrictlyControlled([level]) ? "danger" : "neutral"}>{controlLevelName(level)}</Badge>)}</div> : <span className="text-muted">—</span>,
            },
            {
              key: "attention",
              header: "Attention",
              render: (row) => row.status === "archived" ? <span className="text-xs text-muted">Archived</span> : <div className="flex flex-wrap gap-1">{row.low ? <Badge tone="warning">low stock</Badge> : null}{row.sdsMissing ? <Badge tone="danger">SDS missing</Badge> : null}</div>,
            },
          ]}
        />
      </div>
    </AppShell>
  );
}
