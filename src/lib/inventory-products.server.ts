import type { Prisma } from "@/generated/prisma/client";
import { deleteBlockers, isStrictlyControlled } from "./inventory";
import { inventoryClassFromCategory, inventoryGroupName, inventoryTypeDefaults, inventoryTypeFields, isInventoryGroupKey, type InventoryGroupKey } from "./inventory-types";

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
    ? await tx.inventoryProduct.findFirst({
      where: {
        catalogNumber: { equals: catalogNumber, mode: "insensitive" },
        // A catalogue number is only unique within a maker; without a maker, match only products without one.
        ...(maker ? { OR: [{ brand: { equals: maker, mode: "insensitive" } }, { brand: null }] } : { brand: null }),
      },
      orderBy: { createdAt: "asc" },
      include: withTypeKey,
    })
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
 * What still refers to a stock item ("2 stock movements"); it can be deleted only when nothing does. The opening balance
 * booked when it was registered or imported does not count.
 */
export async function stockItemBlockers(db: Pick<Tx, "inventoryTransaction" | "runMaterialUse" | "purchaseReceipt" | "purchaseRequest" | "inventoryContainerEvent" | "inventoryObservation" | "inventoryItem" | "sampleLifecycleEvent">, id: string) {
  return deleteBlockers({
    // A movement without a note is never an opening balance, and SQL's NOT LIKE alone would skip it.
    movements: await db.inventoryTransaction.count({ where: { inventoryItemId: id, OR: [{ notes: null }, { NOT: { notes: { startsWith: "Opening balance" } } }] } }),
    materialUses: await db.runMaterialUse.count({ where: { inventoryItemId: id } }),
    receipts: await db.purchaseReceipt.count({ where: { inventoryItemId: id } }),
    purchases: await db.purchaseRequest.count({ where: { linkedInventoryItemId: id } }),
    containerActions: await db.inventoryContainerEvent.count({ where: { container: { inventoryItemId: id } } }),
    observations: await db.inventoryObservation.count({ where: { container: { inventoryItemId: id } } }),
    aliquots: await db.inventoryItem.count({ where: { parentInventoryItemId: id } }),
    sampleEvents: await db.sampleLifecycleEvent.count({ where: { inventoryItemId: id } }),
  });
}

/** Products, types and 大类 the stock and product forms choose from; archived products only when already chosen. */
export async function inventoryFormOptions(prisma: Pick<Tx, "inventoryProduct" | "scientificSchemaDefinition" | "inventoryGroup">) {
  const [products, types, groups] = await Promise.all([
    prisma.inventoryProduct.findMany({ select: { id: true, name: true, brand: true, catalogNumber: true, typeId: true, groupKey: true, controlLevels: true, status: true }, orderBy: { name: "asc" } }),
    prisma.scientificSchemaDefinition.findMany({ where: { inventoryGroupKey: { not: null } }, select: { id: true, label: true, inventoryGroupKey: true, defaultSettings: true, fieldDefinitions: true, enabled: true }, orderBy: { label: "asc" } }),
    prisma.inventoryGroup.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const groupNames = new Map(groups.map((group) => [group.key, inventoryGroupName(group)]));
  return {
    products: products.map(({ controlLevels, ...product }) => ({ ...product, strict: isStrictlyControlled(controlLevels) })),
    types: types.map((type) => ({ id: type.id, label: type.label, groupKey: type.inventoryGroupKey!, groupName: groupNames.get(type.inventoryGroupKey!) ?? type.inventoryGroupKey!, defaults: inventoryTypeDefaults(type.defaultSettings), fields: inventoryTypeFields(type.fieldDefinitions), enabled: type.enabled })),
    groups: groups.map((group) => ({ key: group.key, name: inventoryGroupName(group), hidden: group.hidden })),
  };
}
