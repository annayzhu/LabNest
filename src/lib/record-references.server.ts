import { prisma } from "./db";
import { formatStockQuantity, heldCount, stockOnHand } from "./inventory";
import type { RecordReferenceKind } from "./record-references";
import { sampleLocationOptions, sampleTypes } from "./samples.server";

/** What "/样本" offers (Q251): this experiment's samples first, then the rest by when they last changed. */
export type SampleChoice = { kind: "sample"; id: string; code: string; name: string; type: string; status: string; place: string | null; role?: "input" | "output" };
export type LotChoice = { kind: "lot"; id: string; productName: string; lotNumber: string | null; place: string | null; quantity: string | null; expiry: string | null; usedUp: boolean };
/** What "/库存物品" offers (Q250): active products with their active lots. */
export type ProductChoice = { kind: "product"; id: string; name: string; brand: string | null; catalogNumber: string | null; stock: string | null; lots: LotChoice[] };

/** How a referenced record stands now, for the tag's card (Q252); `null` once it is deleted. */
export type ReferenceDetails =
  | { kind: "sample"; code: string; name: string; type: string; status: string; place: string | null; amount: string | null; concentration: string | null; origin: string | null; parentCode: string | null }
  | { kind: "product"; name: string; brand: string | null; catalogNumber: string | null; status: string; stock: string | null; lots: number }
  | { kind: "lot"; productName: string; lotNumber: string | null; place: string | null; quantity: string | null; expiry: string | null; status: string; usedUp: boolean };

const SEARCH_LIMIT = 50;
const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });

async function placeLabels() {
  return new Map((await sampleLocationOptions(prisma)).map((location) => [location.id, location.label]));
}

const placeOf = (places: Map<string, string>, locationId: string | null, position: string | null) =>
  locationId ? [places.get(locationId) ?? "", position ?? ""].filter(Boolean).join(" ") || null : position || null;

type LotRow = { id: string; name: string; lotNumber: string | null; locationId: string | null; positionCode: string | null; currentQuantity: number; unit: string; quantityRecorded: boolean; expiryDate: Date | null; status: string; _count?: { containers: number } };

function lotChoice(lot: LotRow, productName: string, places: Map<string, string>): LotChoice {
  const usedUp = lot.quantityRecorded && stockOnHand(lot) <= 0;
  return {
    kind: "lot", id: lot.id, productName, lotNumber: lot.lotNumber, place: placeOf(places, lot.locationId, lot.positionCode),
    quantity: lot.quantityRecorded ? `${formatStockQuantity(stockOnHand(lot), lot.unit)} ${lot.unit}` : null, expiry: lot.expiryDate?.toISOString().slice(0, 10) ?? null, usedUp,
  };
}

/** A product's active, counted lots added up per unit: "120 mL · 3 tube". */
function stockSummary(lots: LotRow[]) {
  const totals = new Map<string, number>();
  for (const lot of lots) if (lot.quantityRecorded && lot.status === "active") totals.set(lot.unit, (totals.get(lot.unit) ?? 0) + stockOnHand(lot));
  return totals.size ? [...totals].map(([unit, total]) => `${formatStockQuantity(total, unit)} ${unit}`).join(" · ") : null;
}

export async function searchSampleReferences(input: { query?: string; typeId?: string; inStorage?: boolean; experimentId?: string }) {
  const query = input.query?.trim().slice(0, 100);
  const where = {
    ...(input.typeId ? { typeId: input.typeId } : {}),
    ...(input.inStorage ? { status: "available" as const } : {}),
    ...(query ? { OR: [{ code: contains(query) }, { name: contains(query) }, { origin: contains(query) }] } : {}),
  };
  const include = { type: { select: { label: true } } };
  const [links, places, types] = await Promise.all([
    input.experimentId ? prisma.experimentSample.findMany({ where: { experimentId: input.experimentId, sample: where }, orderBy: [{ role: "asc" }, { sortOrder: "asc" }], include: { sample: { include }, group: { select: { sortOrder: true } } } }) : Promise.resolve([]),
    placeLabels(),
    sampleTypes(prisma),
  ]);
  // Used samples, then produced ones; within each, by design group (as the plate planner receives them), then the experiment's order.
  links.sort((a, b) => (a.role === b.role ? 0 : a.role === "input" ? -1 : 1) || (a.group?.sortOrder ?? Infinity) - (b.group?.sortOrder ?? Infinity) || a.sortOrder - b.sortOrder);
  const own = links.map((link) => link.sampleId);
  const others = await prisma.sample.findMany({ where: { ...where, ...(own.length ? { id: { notIn: own } } : {}) }, include, orderBy: [{ updatedAt: "desc" }, { code: "asc" }], take: SEARCH_LIMIT });
  const choice = (sample: (typeof others)[number], role?: "input" | "output"): SampleChoice => ({
    kind: "sample", id: sample.id, code: sample.code, name: sample.name, type: sample.type.label, status: sample.status, place: placeOf(places, sample.locationId, sample.position), ...(role ? { role } : {}),
  });
  return { experiment: links.map((link) => choice(link.sample, link.role)), others: others.map((sample) => choice(sample)), types: types.map((type) => ({ id: type.id, label: type.label })) };
}

export async function searchInventoryReferences(input: { query?: string }) {
  const query = input.query?.trim().slice(0, 100);
  const lotSelect = { id: true, name: true, lotNumber: true, locationId: true, positionCode: true, currentQuantity: true, unit: true, quantityRecorded: true, expiryDate: true, status: true, _count: heldCount };
  const [products, loose, places] = await Promise.all([
    prisma.inventoryProduct.findMany({
      where: { status: "active", ...(query ? { OR: [{ name: contains(query) }, { englishName: contains(query) }, { brand: contains(query) }, { catalogNumber: contains(query) }, { casNumber: contains(query) }, { items: { some: { status: "active", lotNumber: contains(query) } } }] } : {}) },
      select: { id: true, name: true, brand: true, catalogNumber: true, items: { where: { status: "active" }, select: lotSelect, orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }] } },
      orderBy: [{ name: "asc" }], take: SEARCH_LIMIT,
    }),
    // Stock saved before products has no product to stand under; it is offered as a lot on its own.
    prisma.inventoryItem.findMany({
      where: { productId: null, status: "active", ...(query ? { OR: [{ name: contains(query) }, { lotNumber: contains(query) }, { brand: contains(query) }, { catalogNumber: contains(query) }] } : {}) },
      select: lotSelect, orderBy: [{ name: "asc" }], take: 20,
    }),
    placeLabels(),
  ]);
  return {
    products: products.map((product): ProductChoice => ({ kind: "product", id: product.id, name: product.name, brand: product.brand, catalogNumber: product.catalogNumber, stock: stockSummary(product.items), lots: product.items.map((lot) => lotChoice(lot, product.name, places)) })),
    lots: loose.map((lot) => lotChoice(lot, lot.name, places)),
  };
}

/** The current state of each referenced record, keyed "kind:id"; deleted records come back as null. */
export async function referenceDetails(references: Array<{ kind: RecordReferenceKind; id: string }>) {
  const ids = (kind: RecordReferenceKind) => [...new Set(references.filter((reference) => reference.kind === kind).map((reference) => reference.id))];
  const [samples, products, lots, places] = await Promise.all([
    ids("sample").length ? prisma.sample.findMany({ where: { id: { in: ids("sample") } }, include: { type: { select: { label: true } }, parent: { select: { code: true } } } }) : Promise.resolve([]),
    ids("product").length ? prisma.inventoryProduct.findMany({ where: { id: { in: ids("product") } }, select: { id: true, name: true, brand: true, catalogNumber: true, status: true, items: { where: { status: "active" }, select: { id: true, name: true, lotNumber: true, locationId: true, positionCode: true, currentQuantity: true, unit: true, quantityRecorded: true, expiryDate: true, status: true, _count: heldCount } } } }) : Promise.resolve([]),
    ids("lot").length ? prisma.inventoryItem.findMany({ where: { id: { in: ids("lot") } }, select: { id: true, name: true, lotNumber: true, locationId: true, positionCode: true, currentQuantity: true, unit: true, quantityRecorded: true, expiryDate: true, status: true, _count: heldCount, product: { select: { name: true } } } }) : Promise.resolve([]),
    placeLabels(),
  ]);
  const results: Record<string, ReferenceDetails | null> = Object.fromEntries(references.map((reference) => [`${reference.kind}:${reference.id}`, null]));
  for (const sample of samples) results[`sample:${sample.id}`] = {
    kind: "sample", code: sample.code, name: sample.name, type: sample.type.label, status: sample.status, place: placeOf(places, sample.locationId, sample.position),
    amount: sample.amount != null ? `${sample.amount} ${sample.amountUnit ?? ""}`.trim() : null, concentration: sample.concentration != null ? `${sample.concentration} ${sample.concentrationUnit ?? ""}`.trim() : null,
    origin: sample.origin, parentCode: sample.parent?.code ?? null,
  };
  for (const product of products) results[`product:${product.id}`] = { kind: "product", name: product.name, brand: product.brand, catalogNumber: product.catalogNumber, status: product.status, stock: stockSummary(product.items), lots: product.items.length };
  for (const lot of lots) {
    const choice = lotChoice(lot, lot.product?.name ?? lot.name, places);
    results[`lot:${lot.id}`] = { kind: "lot", productName: choice.productName, lotNumber: lot.lotNumber, place: choice.place, quantity: choice.quantity, expiry: choice.expiry, status: lot.status, usedUp: choice.usedUp };
  }
  return results;
}
