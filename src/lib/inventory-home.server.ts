import { PurchaseStatus } from "@/generated/prisma/enums";
import { prisma } from "./db";
import { isStrictlyControlled, lotRiskFlags, type InventoryRiskFlag } from "./inventory";
import { duplicateOverview } from "./inventory-products.server";
import { inventoryGroupName } from "./inventory-types";
import { labDate } from "./lab-time";

// The inventory home's side of things: what needs attention, the categories to browse and what people have taken
// out (Q182, Q183, Q196).

export type InventoryAlert = { label: string; value: number; href: string; tone: "danger" | "warning" | "info" };
export type InventoryCategory = { key: string; name: string; href: string; count: number; types: { id: string; label: string; href: string; count: number }[] };
export type HeldContainer = { id: string; itemId: string; name: string; lotNumber: string | null; label: string | null; holder: string; place: string | null; since: string };

/** What needs attention, each as a count that opens the stock or product list filtered to it. */
export async function inventoryAlerts(now = new Date()): Promise<InventoryAlert[]> {
  const [lots, inUse, openPurchases, strictProducts, duplicates] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { status: "active" }, select: { id: true, productId: true, currentQuantity: true, unit: true, quantityRecorded: true, status: true, lowThreshold: true, expiryDate: true, product: { select: { lowThreshold: true, lowThresholdUnit: true } } } }),
    // Containers, as the in-use list it opens counts them.
    prisma.inventoryContainer.count({ where: { state: "held", inventoryItem: { status: "active" } } }),
    prisma.purchaseRequest.count({ where: { status: { in: [PurchaseStatus.planned, PurchaseStatus.ordered, PurchaseStatus.received] } } }),
    prisma.inventoryProduct.findMany({ where: { controlLevels: { hasSome: ["highly_toxic", "precursor"] } }, select: { id: true, controlLevels: true } }),
    duplicateOverview(prisma),
  ]);
  const byProduct = Map.groupBy(lots, (lot) => lot.productId ?? lot.id);
  const flags = lots.map((lot) => lotRiskFlags(lot, lot.product, byProduct.get(lot.productId ?? lot.id) ?? [], now));
  const count = (flag: InventoryRiskFlag) => flags.filter((entry) => entry.includes(flag)).length;
  const strict = strictProducts.filter((product) => isStrictlyControlled(product.controlLevels));
  const sds = strict.length ? await prisma.attachmentLink.findMany({ where: { targetType: "inventory_product", linkType: "sds", targetId: { in: strict.map((product) => product.id) } }, select: { targetId: true } }) : [];
  const alerts: InventoryAlert[] = [
    { label: "Low stock", value: count("low"), href: "/inventory/list?flag=low", tone: "warning" },
    { label: "Out of stock", value: count("depleted"), href: "/inventory/list?flag=depleted", tone: "danger" },
    { label: "Expired", value: count("expired"), href: "/inventory/list?flag=expired", tone: "danger" },
    { label: "Expires in 30 days", value: count("expiring"), href: "/inventory/list?flag=expiring", tone: "warning" },
    { label: "In use", value: inUse, href: "/inventory#in-use", tone: "info" },
    { label: "SDS missing", value: strict.filter((product) => !sds.some((link) => link.targetId === product.id)).length, href: "/inventory/products?flag=sds", tone: "danger" },
    { label: "Possible duplicates", value: duplicates.productPairs.length + duplicates.lotGroups.length, href: "/inventory/products/duplicates", tone: "warning" },
    { label: "Open purchases", value: openPurchases, href: "/purchases", tone: "info" },
  ];
  return alerts.filter((alert) => alert.value > 0);
}

/**
 * The 大类 in their set order, each with its types, most stocked first. Counts are active lots, the rows the linked
 * stock list shows; empty 大类 and types are left out.
 */
export async function inventoryCategories(): Promise<{ groups: InventoryCategory[]; unclassified: number }> {
  const [groups, types, lots] = await Promise.all([
    prisma.inventoryGroup.findMany({ where: { hidden: false }, orderBy: { sortOrder: "asc" } }),
    prisma.scientificSchemaDefinition.findMany({ where: { inventoryGroupKey: { not: null } }, select: { id: true, label: true, inventoryGroupKey: true } }),
    prisma.inventoryItem.findMany({ where: { status: "active", productId: { not: null } }, select: { product: { select: { groupKey: true, typeId: true } } } }),
  ]);
  const listed = (filter: string) => `/inventory/list?${filter}&status=active`;
  const inGroup = (key: string) => lots.filter((lot) => lot.product?.groupKey === key);
  return {
    groups: groups.flatMap((group) => {
      const own = inGroup(group.key);
      if (!own.length) return [];
      const kinds = types
        .filter((type) => type.inventoryGroupKey === group.key)
        .map((type) => ({ id: type.id, label: type.label, href: listed(`type=${type.id}`), count: own.filter((lot) => lot.product?.typeId === type.id).length }))
        .filter((type) => type.count > 0)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
      return [{ key: group.key, name: inventoryGroupName(group), href: listed(`group=${group.key}`), count: own.length, types: kinds }];
    }),
    unclassified: lots.filter((lot) => !lot.product?.groupKey).length,
  };
}

/** Containers out of the store with someone, newest first, with the Beijing day they were taken out or handed over. */
export async function heldContainers(): Promise<HeldContainer[]> {
  const containers = await prisma.inventoryContainer.findMany({
    where: { state: "held", inventoryItem: { status: "active" } },
    select: {
      id: true,
      label: true,
      holder: true,
      location: true,
      updatedAt: true,
      inventoryItem: { select: { id: true, name: true, lotNumber: true } },
      events: { where: { action: { in: ["issue", "transfer"] } }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return containers.map((container) => ({
    id: container.id,
    itemId: container.inventoryItem.id,
    name: container.inventoryItem.name,
    lotNumber: container.inventoryItem.lotNumber,
    label: container.label,
    holder: container.holder ?? "",
    place: container.location,
    since: labDate(container.events[0]?.createdAt ?? container.updatedAt),
  }));
}
