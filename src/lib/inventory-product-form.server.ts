import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { assertPrecision, inventoryControlKeys, isStrictlyControlled } from "./inventory";
import { productWithCatalog, syncProductLots } from "./inventory-products.server";
import { inventoryTypeFields, isInventoryGroupKey, type InventoryTypeField } from "./inventory-types";
import { sequenceKind } from "./product-sequences";
import { readProductSequences, saveProductSequences } from "./product-sequences.server";

// A product as its form sends it. The product page's form sends the fields as they are; the lot edit page sends the
// same fields prefixed `product.`, beside the lot's own (Q192).

type Tx = Prisma.TransactionClient;
type Read = { one: (name: string) => FormDataEntryValue | null; all: (name: string) => FormDataEntryValue[] };

const text = (value: FormDataEntryValue | null) => String(value ?? "").trim() || undefined;
const number = (value: FormDataEntryValue | null) => (text(value) === undefined ? undefined : Number(text(value)));

const productSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, "Product name is required.").max(180),
  englishName: z.string().trim().max(180).optional(),
  brand: z.string().trim().max(120).optional(),
  catalogNumber: z.string().trim().max(120).optional(),
  casNumber: z.string().trim().max(64).optional(),
  typeId: z.string().trim().optional(),
  groupKey: z.string().trim().optional(),
  entityId: z.string().trim().optional(),
  lowThreshold: z.number().finite().nonnegative().optional(),
  lowThresholdUnit: z.string().trim().max(32).optional(),
  notes: z.string().trim().max(5000).optional(),
  controlLevels: z.array(z.string().refine((key) => inventoryControlKeys.includes(key), "Unknown control level.")),
});
type Parsed = z.infer<typeof productSchema>;
type Classified = Awaited<ReturnType<typeof classify>>;

/**
 * Creates the product the form describes, or updates the one named by its id and writes the new identity, name
 * included, to every lot of it (Q191). Returns the product's id.
 */
export async function saveProductForm(tx: Tx, formData: FormData, prefix = "") {
  const read: Read = { one: (name) => formData.get(prefix + name), all: (name) => formData.getAll(prefix + name) };
  const parsed = parseProduct(read);
  if (!parsed.id) {
    const classified = await classify(tx, parsed);
    await assertNoDuplicate(tx, parsed);
    const entityId = await productEntity(tx, parsed, classified, read, null);
    const product = await tx.inventoryProduct.create({ data: { ...productData(parsed, classified, fieldValues(read, classified.fields)), entityId } });
    await tx.activityLog.create({ data: { action: "create", targetType: "inventory_product", targetId: product.id, metadataJson: { name: product.name, typeId: product.typeId, groupKey: product.groupKey } } });
    return product.id;
  }
  const id = parsed.id;
  const current = await tx.inventoryProduct.findUnique({ where: { id } });
  if (!current) throw new Error("This product no longer exists.");
  const classified = await classify(tx, parsed, current.typeId);
  await assertNoDuplicate(tx, parsed);
  await assertControlFits(tx, id, parsed.controlLevels);
  const entityId = await productEntity(tx, parsed, classified, read, current.entityId);
  await tx.inventoryProduct.update({ where: { id }, data: { ...productData(parsed, classified, fieldValues(read, classified.fields)), entityId } });
  await syncProductLots(tx, id);
  await tx.activityLog.create({ data: { action: "update", targetType: "inventory_product", targetId: id, metadataJson: { previous: { name: current.name, typeId: current.typeId, groupKey: current.groupKey, controlLevels: current.controlLevels }, next: { name: parsed.name, typeId: classified.typeId, groupKey: classified.groupKey, controlLevels: parsed.controlLevels } } } });
  return id;
}

function parseProduct(read: Read) {
  return productSchema.parse({
    id: text(read.one("id")),
    name: read.one("name"),
    englishName: text(read.one("englishName")),
    brand: text(read.one("brand")),
    catalogNumber: text(read.one("catalogNumber")),
    casNumber: text(read.one("casNumber")),
    typeId: text(read.one("typeId")),
    groupKey: text(read.one("groupKey")),
    entityId: text(read.one("entityId")),
    lowThreshold: number(read.one("lowThreshold")),
    lowThresholdUnit: text(read.one("lowThresholdUnit")),
    notes: text(read.one("notes")),
    controlLevels: [...new Set([...read.all("controlLevel"), read.one("biosafety")].map(text).filter((key): key is string => !!key))],
  });
}

/** Values of the type's fields (`field:<key>`); a number, date or choice must read as one. Fields of other types are not kept. */
function fieldValues(read: Read, fields: InventoryTypeField[]) {
  const values: Record<string, string> = {};
  for (const field of fields) {
    const value = text(read.one(`field:${field.key}`));
    if (value === undefined) continue;
    if (field.kind === "number" && !Number.isFinite(Number(value))) throw new Error(`${field.label} must be a number.`);
    if (field.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field.label} must be a date.`);
    if (field.kind === "choice" && field.options && !field.options.includes(value)) throw new Error(`Choose one of the options for ${field.label}.`);
    values[field.key] = value;
  }
  return values;
}

/** The type decides the 大类; without one, the chosen 大类 (or none: 待归类). A disabled type stays only where it already is. */
async function classify(tx: Tx, parsed: Parsed, currentTypeId?: string | null) {
  if (!parsed.typeId) return { typeId: null, typeKey: null, groupKey: parsed.groupKey && isInventoryGroupKey(parsed.groupKey) ? parsed.groupKey : null, fields: [] as InventoryTypeField[] };
  const type = await tx.scientificSchemaDefinition.findUnique({ where: { id: parsed.typeId } });
  if (!type?.inventoryGroupKey || (!type.enabled && type.id !== currentTypeId)) throw new Error("Choose an inventory type that is in use.");
  return { typeId: type.id, typeKey: type.key, groupKey: type.inventoryGroupKey, fields: inventoryTypeFields(type.fieldDefinitions) };
}

async function assertNoDuplicate(tx: Tx, parsed: Parsed) {
  const duplicate = await productWithCatalog(tx, { brand: parsed.brand ?? null, catalogNumber: parsed.catalogNumber ?? null }, { excludeId: parsed.id });
  if (duplicate) throw new Error(`“${duplicate.name}” already has this brand and catalogue number.`);
}

/** Highly toxic and drug-precursor stock is only recorded precisely. */
async function assertControlFits(tx: Tx, productId: string, levels: string[]) {
  if (!isStrictlyControlled(levels)) return;
  const loose = await tx.inventoryItem.count({ where: { productId, managementMode: { not: "precise" } } });
  if (loose) throw new Error(`Highly toxic and drug-precursor stock must be recorded with precise use; switch ${loose} lot${loose === 1 ? "" : "s"} to precise use first.`);
}

/**
 * The entity a product points at. A product of a sequence type points at the entity its strands hang on, made with
 * the first strand (Q185); any other product keeps the entity chosen in the form.
 */
async function productEntity(tx: Tx, parsed: Parsed, classified: Classified, read: Read, currentEntityId: string | null) {
  const kind = sequenceKind(classified.typeKey);
  if (!kind) return parsed.entityId ?? null;
  const typed = Object.fromEntries(kind.strands.map((strand) => [strand.role, String(read.one(`sequence:${strand.role}`) ?? "")]));
  return saveProductSequences(tx, { name: parsed.name, entityId: currentEntityId }, kind, typed);
}

function productData(parsed: Parsed, classified: Classified, values: Record<string, string>) {
  // "Remind when it is used up" (0) counts every unit, so only an amount needs one.
  if (parsed.lowThreshold && !parsed.lowThresholdUnit) throw new Error("Choose the unit of the safety stock.");
  if (parsed.lowThreshold !== undefined && parsed.lowThresholdUnit) assertPrecision(parsed.lowThreshold, parsed.lowThresholdUnit);
  return {
    name: parsed.name,
    englishName: parsed.englishName ?? null,
    brand: parsed.brand ?? null,
    catalogNumber: parsed.catalogNumber ?? null,
    casNumber: parsed.casNumber ?? null,
    typeId: classified.typeId,
    groupKey: classified.groupKey,
    fieldValues: values,
    controlLevels: parsed.controlLevels,
    lowThreshold: parsed.lowThreshold ?? null,
    lowThresholdUnit: parsed.lowThreshold === undefined ? null : parsed.lowThresholdUnit,
    notes: parsed.notes ?? null,
  };
}

/**
 * What a product's form starts from: its values and strands, how many lots share it, and the entities it may be made
 * from. The product edit page and the lot edit page (Q192) both use it.
 */
export async function productFormStart(db: Pick<Tx, "inventoryProduct" | "entity" | "entitySequenceLink">, productId: string) {
  const [product, entities] = await Promise.all([
    db.inventoryProduct.findUnique({ where: { id: productId }, include: { type: { select: { key: true } }, _count: { select: { items: true } } } }),
    db.entity.findMany({ where: { OR: [{ status: "active" }, { inventoryProducts: { some: { id: productId } } }] }, select: { id: true, name: true, type: true, code: true }, orderBy: [{ type: "asc" }, { name: "asc" }] }),
  ]);
  if (!product) return null;
  const sequences = await readProductSequences(db, product.entityId, product.type?.key);
  return {
    product,
    lots: product._count.items,
    entities,
    initial: { ...product, fieldValues: product.fieldValues as Record<string, string>, sequences: Object.fromEntries(sequences.map((strand) => [strand.role, strand.sequence])) },
  };
}
