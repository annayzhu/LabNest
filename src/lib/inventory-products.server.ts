import type { Prisma } from "@/generated/prisma/client";
import { deleteBlockers, isStrictlyControlled, stockUnits } from "./inventory";
import { locationPaths, temperatureLabel } from "./inventory-location-lifecycle";
import { catalogKey, duplicateLotGroups, duplicateProductPairs, pairKey } from "./inventory-duplicates";
import { inventoryClassFromCategory, inventoryGroupKeys, inventoryGroupName, inventoryGroupNames, inventoryTypeDefaults, inventoryTypeFields, isInventoryGroupKey, type InventoryGroupKey } from "./inventory-types";

type Tx = Prisma.TransactionClient;

export type ProductIdentity = {
  name: string;
  englishName?: string | null;
  brand?: string | null;
  vendor?: string | null;
  catalogNumber?: string | null;
  casNumber?: string | null;
  entityId?: string | null;
  /** An old category or an import file's category column. */
  category?: string | null;
  /** Chosen in a form; a type decides the 大类. */
  typeId?: string | null;
  groupKey?: string | null;
};

const blank = (value?: string | null) => value?.trim() || null;
const withTypeKey = { type: { select: { key: true } } } as const;

/** What every lot copies from its product; `category` keeps the type key, or the 大类 key, for exports. */
export function lotIdentity(product: { name: string; englishName: string | null; brand: string | null; catalogNumber: string | null; casNumber: string | null; entityId?: string | null; groupKey: string | null; type?: { key: string } | null }) {
  return {
    name: product.name,
    entityId: product.entityId ?? null,
    englishName: product.englishName,
    brand: product.brand,
    catalogNumber: product.catalogNumber,
    casNumber: product.casNumber,
    category: product.type?.key ?? product.groupKey,
  };
}

/** Writes a product's identity onto all of its lots, so lists, search, exports and run materials read the same names. */
export async function syncProductLots(tx: Tx, productId: string) {
  const product = await tx.inventoryProduct.findUniqueOrThrow({ where: { id: productId }, include: withTypeKey });
  await tx.inventoryItem.updateMany({ where: { productId }, data: lotIdentity(product) });
  return product;
}

/**
 * The product new stock belongs to: the same brand + catalogue number, or the same self-made design, is the same
 * product; anything else becomes a new product, classified from its category when one is given.
 */
export async function linkInventoryProduct(tx: Tx, identity: ProductIdentity) {
  const catalogNumber = blank(identity.catalogNumber);
  const maker = blank(identity.brand) ?? blank(identity.vendor);
  const existing = catalogNumber
    ? await productWithCatalog(tx, { brand: maker, catalogNumber }, { orUnbranded: true })
    : identity.entityId
      ? await tx.inventoryProduct.findFirst({ where: { entityId: identity.entityId, catalogNumber: null }, orderBy: { createdAt: "asc" }, include: withTypeKey })
      : null;
  if (existing) return existing;
  const types = await tx.scientificSchemaDefinition.findMany({ where: { inventoryGroupKey: { not: null } }, select: { id: true, key: true, label: true, inventoryGroupKey: true, enabled: true } });
  const chosen = identity.typeId ? types.find((type) => type.id === identity.typeId && type.enabled) : undefined;
  if (identity.typeId && !chosen) throw new Error("Choose an inventory type that is in use.");
  const { groupKey, typeKey } = chosen
    ? { groupKey: chosen.inventoryGroupKey, typeKey: chosen.key }
    : identity.groupKey !== undefined
      ? { groupKey: isInventoryGroupKey(identity.groupKey) ? identity.groupKey : null, typeKey: null }
      : inventoryClassFromCategory(identity.category, types);
  return tx.inventoryProduct.create({
    data: {
      name: identity.name.trim(),
      englishName: blank(identity.englishName),
      brand: blank(identity.brand),
      catalogNumber,
      casNumber: blank(identity.casNumber),
      entityId: identity.entityId || null,
      groupKey: groupKey as InventoryGroupKey | null,
      typeId: types.find((type) => type.key === typeKey)?.id ?? null,
    },
    include: withTypeKey,
  });
}

/**
 * The product with this brand and catalogue number, compared without case, spaces or hyphens. A catalogue number is only
 * unique within a maker: without a brand, only products without one match; `orUnbranded` lets a branded search also find
 * a product saved without a brand.
 */
export async function productWithCatalog(tx: Tx, identity: { brand: string | null; catalogNumber: string | null }, options: { orUnbranded?: boolean; excludeId?: string } = {}) {
  const key = catalogKey(identity.catalogNumber);
  if (!key) return null;
  const brand = blank(identity.brand);
  const brands = brand ? [{ brand: { equals: brand, mode: "insensitive" as const } }, ...(options.orUnbranded ? [{ brand: null }] : [])] : [{ brand: null }];
  const candidates = await tx.inventoryProduct.findMany({
    where: { catalogNumber: { not: null }, OR: brands, ...(options.excludeId ? { id: { not: options.excludeId } } : {}) },
    orderBy: { createdAt: "asc" },
    include: withTypeKey,
  });
  return candidates.find((product) => catalogKey(product.catalogNumber) === key) ?? null;
}

/** Removes a stock item nothing refers to (see stockItemBlockers): its opening balance, containers and document links go with it. */
export async function deleteStockItem(tx: Tx, id: string) {
  await tx.inventoryTransaction.deleteMany({ where: { inventoryItemId: id } });
  await tx.inventoryContainer.deleteMany({ where: { inventoryItemId: id } });
  await tx.attachmentLink.deleteMany({ where: { targetType: "inventory_item", targetId: id } });
  await tx.inventoryItem.delete({ where: { id } });
}

/** Removes a product without lots; its document links go with it and its kit components cascade. */
export async function deleteProduct(tx: Tx, id: string) {
  await tx.attachmentLink.deleteMany({ where: { targetType: "inventory_product", targetId: id } });
  await tx.inventoryProduct.delete({ where: { id } });
}

/**
 * What still refers to a stock item ("2 stock movements"); it can be deleted only when nothing does. The opening balance
 * booked when it was registered or imported does not count.
 */
export async function stockItemBlockers(db: Pick<Tx, "inventoryTransaction" | "runMaterialUse" | "purchaseReceipt" | "purchaseRequest" | "inventoryContainerEvent" | "inventoryObservation" | "inventoryItem">, id: string) {
  return deleteBlockers({
    // A movement without a note is never an opening balance, and SQL's NOT LIKE alone would skip it.
    movements: await db.inventoryTransaction.count({ where: { inventoryItemId: id, OR: [{ notes: null }, { NOT: { notes: { startsWith: "Opening balance" } } }] } }),
    materialUses: await db.runMaterialUse.count({ where: { inventoryItemId: id } }),
    receipts: await db.purchaseReceipt.count({ where: { inventoryItemId: id } }),
    purchases: await db.purchaseRequest.count({ where: { linkedInventoryItemId: id } }),
    containerActions: await db.inventoryContainerEvent.count({ where: { container: { inventoryItemId: id } } }),
    observations: await db.inventoryObservation.count({ where: { container: { inventoryItemId: id } } }),
    aliquots: await db.inventoryItem.count({ where: { parentInventoryItemId: id } }),
  });
}

/** Every location for the stock form, named by its full path and sorted by it; callers drop the archived ones they do not need. */
export async function stockFormLocations(db: Pick<Tx, "inventoryLocation">) {
  const locations = await db.inventoryLocation.findMany({ select: { id: true, name: true, parentLocationId: true, temperature: true, status: true } });
  const paths = locationPaths(locations);
  return locations
    .map((location) => ({ id: location.id, name: paths.get(location.id) ?? location.name, temperature: temperatureLabel(location.temperature), status: location.status }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The choices the inventory import template offers: types and 大类 by the names the import reads, units, locations. */
export async function inventoryTemplateLists(db: Pick<Tx, "scientificSchemaDefinition" | "inventoryGroup" | "inventoryLocation">) {
  const [types, groups, locations] = await Promise.all([
    db.scientificSchemaDefinition.findMany({ where: { inventoryGroupKey: { not: null }, enabled: true }, select: { label: true, inventoryGroupKey: true }, orderBy: { label: "asc" } }),
    db.inventoryGroup.findMany({ where: { hidden: false }, select: { key: true }, orderBy: { sortOrder: "asc" } }),
    db.inventoryLocation.findMany({ where: { status: "active" }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const shown = new Set(groups.map((group) => group.key));
  return {
    category: [...inventoryGroupKeys.filter((key) => shown.has(key)).map((key) => inventoryGroupNames[key]), ...types.filter((type) => shown.has(type.inventoryGroupKey!)).map((type) => type.label)],
    unit: stockUnits,
    location: locations.map((location) => location.name),
  };
}

/** Products, types and 大类 the stock and product forms choose from; archived products only when already chosen. */
export async function inventoryFormOptions(prisma: Pick<Tx, "inventoryProduct" | "scientificSchemaDefinition" | "inventoryGroup">) {
  const [products, types, groups] = await Promise.all([
    prisma.inventoryProduct.findMany({
      select: {
        id: true, name: true, brand: true, catalogNumber: true, typeId: true, groupKey: true, controlLevels: true, status: true,
        items: { where: { status: { not: "archived" } }, select: { id: true, lotNumber: true, currentQuantity: true, unit: true, quantityRecorded: true, locationId: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.scientificSchemaDefinition.findMany({ where: { inventoryGroupKey: { not: null } }, select: { id: true, key: true, label: true, inventoryGroupKey: true, defaultSettings: true, fieldDefinitions: true, enabled: true }, orderBy: { label: "asc" } }),
    prisma.inventoryGroup.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const groupNames = new Map(groups.map((group) => [group.key, inventoryGroupName(group)]));
  return {
    products: products.map(({ controlLevels, items, ...product }) => ({ ...product, strict: isStrictlyControlled(controlLevels), lots: items })),
    types: types.map((type) => ({ id: type.id, key: type.key, label: type.label, groupKey: type.inventoryGroupKey!, groupName: groupNames.get(type.inventoryGroupKey!) ?? type.inventoryGroupKey!, defaults: inventoryTypeDefaults(type.defaultSettings), fields: inventoryTypeFields(type.fieldDefinitions), enabled: type.enabled })),
    groups: groups.map((group) => ({ key: group.key, name: inventoryGroupName(group), hidden: group.hidden })),
  };
}

/** Products and stock lots that may be duplicates, oldest first, without the pairs someone marked as not duplicates. */
export async function duplicateOverview(db: Pick<Tx, "inventoryProduct" | "inventoryItem" | "inventoryDuplicateDismissal">) {
  const [products, lots, dismissals] = await Promise.all([
    db.inventoryProduct.findMany({ select: { id: true, name: true, englishName: true, brand: true, catalogNumber: true, casNumber: true, status: true, _count: { select: { items: true } } }, orderBy: { createdAt: "asc" } }),
    db.inventoryItem.findMany({
      where: { status: "active", productId: { not: null }, lotNumber: { not: null } },
      select: { id: true, name: true, productId: true, lotNumber: true, locationId: true, status: true, currentQuantity: true, unit: true, quantityRecorded: true, location: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.inventoryDuplicateDismissal.findMany({ select: { firstId: true, secondId: true } }),
  ]);
  const dismissed = new Set(dismissals.map((pair) => pairKey(pair.firstId, pair.secondId)));
  return { products, productPairs: duplicateProductPairs(products, dismissed), lotGroups: duplicateLotGroups(lots, dismissed) };
}
