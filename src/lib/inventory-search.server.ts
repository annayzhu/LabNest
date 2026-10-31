import { prisma } from "./db";
import { isStrictlyControlled, lotRiskFlags } from "./inventory";
import { locationPaths } from "./inventory-location-lifecycle";
import { stockRows, stockSearchWhere, type StockSearch } from "./inventory-search";
import { inventoryGroupName } from "./inventory-types";

/**
 * The inventory home's rows: active stock matching the search, or the stock changed most recently when nothing is
 * searched. Each matched product brings all its active lots, so a quick movement can use any of them.
 */
export async function findStock(query: string, limit = 8): Promise<StockSearch> {
  const search = query.trim().slice(0, 120);
  const matched = await prisma.inventoryItem.findMany({
    where: { status: "active", ...(search ? stockSearchWhere(search) : {}) },
    select: { id: true, productId: true },
    orderBy: { updatedAt: "desc" },
    take: search ? 200 : limit * 4,
  });
  if (!matched.length) return { rows: [], total: 0 };
  const order = new Map<string, number>();
  matched.forEach((lot, index) => { if (!order.has(lot.productId ?? lot.id)) order.set(lot.productId ?? lot.id, index); });
  const [lots, locations] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { status: "active", OR: [{ productId: { in: matched.flatMap((lot) => lot.productId ? [lot.productId] : []) } }, { id: { in: matched.filter((lot) => !lot.productId).map((lot) => lot.id) } }] },
      include: {
        product: { include: { type: { select: { label: true } }, group: true, items: { where: { status: "active" }, select: { currentQuantity: true, unit: true, quantityRecorded: true, status: true } } } },
        containers: { where: { state: "warehouse" }, select: { id: true } },
      },
    }),
    prisma.inventoryLocation.findMany({ select: { id: true, name: true, parentLocationId: true } }),
  ]);
  const paths = locationPaths(locations);
  const now = new Date();
  const products = new Map(lots.flatMap((lot) => lot.product ? [[lot.product.id, { kind: lot.product.type?.label ?? (lot.product.group ? inventoryGroupName(lot.product.group) : null), strict: isStrictlyControlled(lot.product.controlLevels) }] as const] : []));
  const rows = stockRows(
    lots
      .sort((a, b) => (order.get(a.productId ?? a.id) ?? 0) - (order.get(b.productId ?? b.id) ?? 0))
      .map((lot) => ({
        id: lot.id, productId: lot.productId, name: lot.name, brand: lot.brand, catalogNumber: lot.catalogNumber,
        lotNumber: lot.lotNumber, barcode: lot.barcode, aliquotCode: lot.aliquotCode,
        managementMode: lot.managementMode, currentQuantity: lot.currentQuantity, unit: lot.unit, quantityRecorded: lot.quantityRecorded,
        expiryDate: lot.expiryDate, location: [lot.locationId ? paths.get(lot.locationId) : null, lot.positionCode].filter(Boolean).join(" · ") || null,
        inStore: lot.containers.length, flags: lotRiskFlags(lot, lot.product, lot.product?.items ?? [], now),
      })),
    products,
    search,
  );
  return { rows: rows.slice(0, limit), total: rows.length };
}
