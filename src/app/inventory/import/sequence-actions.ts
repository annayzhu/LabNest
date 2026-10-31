"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { formActionErrorMessage } from "@/lib/form-actions";
import { sequenceKinds } from "@/lib/product-sequences";
import { saveProductSequences } from "@/lib/product-sequences.server";

const entries = z.object({
  typeKey: z.enum(Object.keys(sequenceKinds) as [string, ...string[]]),
  entries: z.array(z.object({
    name: z.string().trim().min(1).max(180),
    targetName: z.string().trim().max(120).optional(),
    organism: z.string().trim().max(120).optional(),
    description: z.string().trim().max(5000).optional(),
    // By role (forward, reverse, sense, antisense), or "sequence" for a single strand.
    members: z.array(z.object({ role: z.string(), sequence: z.string().max(200_000) })).min(1).max(2),
  })).min(1, "Nothing to import.").max(500),
});

/**
 * Sequences pasted or read from a file, imported as products of one sequence type (Q186): each entry becomes a product
 * whose strands are new sequence records. A product of this type with the same name already is skipped, not doubled.
 */
export async function importSequenceProducts(raw: unknown): Promise<{ created?: number; skipped?: string[]; error?: string }> {
  try {
    const input = entries.parse(raw);
    const kind = sequenceKinds[input.typeKey];
    const result = await prisma.$transaction(async (tx) => {
      const type = await tx.scientificSchemaDefinition.findUnique({ where: { key: input.typeKey } });
      if (!type?.inventoryGroupKey || !type.enabled) throw new Error("This sequence type is not in use in inventory.");
      const fields = Array.isArray(type.fieldDefinitions) ? (type.fieldDefinitions as { key: string }[]).map((field) => field.key) : [];
      const existing = new Set((await tx.inventoryProduct.findMany({ where: { typeId: type.id }, select: { name: true } })).map((product) => product.name.toLowerCase()));
      const skipped: string[] = [];
      let created = 0;
      for (const entry of input.entries) {
        if (existing.has(entry.name.toLowerCase())) { skipped.push(entry.name); continue; }
        existing.add(entry.name.toLowerCase());
        const typed = Object.fromEntries(entry.members.map((member) => [member.role === "sequence" ? kind.strands[0].role : member.role, member.sequence]));
        const entityId = await saveProductSequences(tx, { name: entry.name, entityId: null }, kind, typed);
        const values: Record<string, string> = {};
        if (entry.targetName && fields.includes("targetGene")) values.targetGene = entry.targetName;
        if (entry.organism && fields.includes("organism")) values.organism = entry.organism;
        const product = await tx.inventoryProduct.create({ data: { name: entry.name, typeId: type.id, groupKey: type.inventoryGroupKey, entityId, fieldValues: values, notes: entry.description } });
        await tx.activityLog.create({ data: { action: "import_sequences", targetType: "inventory_product", targetId: product.id, metadataJson: { name: entry.name, typeKey: input.typeKey, strands: entry.members.length } } });
        created++;
      }
      return { created, skipped };
    });
    revalidatePath("/inventory/products");
    return result;
  } catch (error) {
    return { error: formActionErrorMessage(error, "The sequences could not be imported.") };
  }
}
