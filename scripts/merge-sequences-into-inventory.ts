// Moves the sequence library into inventory (docs/modules/inventory/sequence-merge-20261031, Q185–Q187): every primer
// pair and siRNA duplex becomes a product of type Primer or siRNA whose entity links its two strands; a single sequence
// becomes a product of its design's type. Sequence records stay as they are; only entities, products and links are added.
// Usage: DATABASE_URL=… npx tsx scripts/merge-sequences-into-inventory.ts [--apply] [--formal]
// Without --apply it only prints what it would do. The formal database (`labnest`) also needs --formal.
import { prisma } from "../src/lib/db";
import { sequenceKinds } from "../src/lib/product-sequences";

const apply = process.argv.includes("--apply");
const database = new URL(process.env.DATABASE_URL ?? "postgresql://x/none").pathname.slice(1);
if (apply && database === "labnest" && !process.argv.includes("--formal")) throw new Error("Writing to the formal database needs --formal.");

const pairTypeKey = { primer_pair: "primer", sirna_duplex: "sirna" } as const;
const designTypeKey: Record<string, string> = { primer: "primer", probe: "probe", siRNA: "sirna", gRNA: "grna", plasmid: "plasmid", protein: "protein", peptide: "protein" };
// Where a pair kept its gene and organism; primer and siRNA products keep them as type fields.
const addedFields = [{ key: "targetGene", label: "Target gene" }, { key: "organism", label: "Organism" }];

async function main() {
  console.log(`${apply ? "Applying to" : "Dry run on"} ${database}`);
  const types = new Map((await prisma.scientificSchemaDefinition.findMany({ where: { key: { in: Object.keys(sequenceKinds) } } })).map((type) => [type.key, type]));
  const linked = new Set((await prisma.entitySequenceLink.findMany({ where: { entity: { inventoryProducts: { some: {} } } }, select: { sequenceId: true } })).map((link) => link.sequenceId));
  const pairs = await prisma.sequencePair.findMany({ include: { members: { orderBy: { order: "asc" } } }, orderBy: { name: "asc" } });
  const singles = await prisma.sequence.findMany({ where: { pairMembership: null }, include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } }, orderBy: { name: "asc" } });

  const plan = [
    ...pairs.map((pair) => ({ name: pair.name, typeKey: pairTypeKey[pair.type], status: pair.status, values: { targetGene: pair.targetName, organism: pair.organism }, links: pair.members.map((member) => ({ sequenceId: member.sequenceId, versionId: member.sequenceVersionId, role: member.role, order: member.order })) })),
    ...singles.flatMap((sequence) => designTypeKey[sequence.designType] && sequence.versions[0]
      ? [{ name: sequence.name, typeKey: designTypeKey[sequence.designType], status: sequence.status, values: { targetGene: sequence.targetName, organism: sequence.organism }, links: [{ sequenceId: sequence.id, versionId: sequence.versions[0].id, role: sequenceKinds[designTypeKey[sequence.designType]].strands[0].role, order: 0 }] }]
      : []),
  ].filter((entry) => !entry.links.some((link) => linked.has(link.sequenceId)));
  const skipped = singles.filter((sequence) => !designTypeKey[sequence.designType]).map((sequence) => `${sequence.code} ${sequence.name} (${sequence.designType})`);

  for (const entry of plan) console.log(`${entry.typeKey.padEnd(7)} ${entry.name} · ${entry.links.map((link) => link.role).join(" + ")}`);
  if (skipped.length) console.log(`Left in the sequence records, no matching product type: ${skipped.join("; ")}`);
  console.log(`${plan.length} product${plan.length === 1 ? "" : "s"} to create.`);
  if (!apply || !plan.length) return;

  await prisma.$transaction(async (tx) => {
    for (const key of ["primer", "sirna"]) {
      const type = types.get(key);
      if (!type) continue;
      const fields = Array.isArray(type.fieldDefinitions) ? type.fieldDefinitions as { key: string }[] : [];
      const missing = addedFields.filter((field) => !fields.some((existing) => existing.key === field.key));
      if (missing.length) await tx.scientificSchemaDefinition.update({ where: { id: type.id }, data: { fieldDefinitions: [...fields, ...missing] } });
    }
    for (const entry of plan) {
      const type = types.get(entry.typeKey);
      if (!type?.inventoryGroupKey) throw new Error(`The inventory type “${entry.typeKey}” is missing.`);
      const entity = await tx.entity.create({ data: { name: entry.name, type: sequenceKinds[entry.typeKey].entity } });
      const values = Object.fromEntries(Object.entries(entry.values).filter((pair): pair is [string, string] => !!pair[1]));
      const product = await tx.inventoryProduct.create({ data: { name: entry.name, typeId: type.id, groupKey: type.inventoryGroupKey, entityId: entity.id, fieldValues: values, status: entry.status === "archived" ? "archived" : "active" } });
      for (const link of entry.links) await tx.entitySequenceLink.create({ data: { entityId: entity.id, sequenceId: link.sequenceId, sequenceVersionId: link.versionId, role: link.role, order: link.order, isPrimary: link.order === 0 } });
      await tx.activityLog.create({ data: { action: "create_from_sequences", targetType: "inventory_product", targetId: product.id, metadataJson: { name: entry.name, typeKey: entry.typeKey, sequenceIds: entry.links.map((link) => link.sequenceId) } } });
    }
  });
  console.log("Done.");
}

main().finally(() => prisma.$disconnect());
