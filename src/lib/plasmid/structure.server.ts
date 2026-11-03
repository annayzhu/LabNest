import { prisma } from "@/lib/db";

/** One element as stored: the accepted peptides are always a list (Q360). */
export type StoredStructureElement = { name: string; protein: string[]; maxGapBefore?: number };

/** A plasmid product's expected structure (Q277, Q360), or an empty list when none is written yet. */
export async function loadExpectedStructure(productId: string): Promise<StoredStructureElement[]> {
  const row = await prisma.plasmidExpectedStructure.findUnique({ where: { productId }, select: { elementsJson: true } });
  return Array.isArray(row?.elementsJson) ? (row.elementsJson as StoredStructureElement[]) : [];
}

/** Replaces the expected structure of a plasmid product; an empty list removes it. */
export async function saveExpectedStructure(productId: string, elements: StoredStructureElement[]) {
  await prisma.$transaction(async (tx) => {
    const product = await tx.inventoryProduct.findUnique({ where: { id: productId }, select: { type: { select: { key: true } } } });
    if (product?.type?.key !== "plasmid") throw new Error("Choose a plasmid in inventory.");
    if (!elements.length) await tx.plasmidExpectedStructure.deleteMany({ where: { productId } });
    else await tx.plasmidExpectedStructure.upsert({ where: { productId }, create: { productId, elementsJson: elements }, update: { elementsJson: elements } });
    await tx.activityLog.create({ data: { action: "plasmid_structure_saved", targetType: "inventory_product", targetId: productId, metadataJson: { elements: elements.map((element) => element.name) } } });
  });
}
