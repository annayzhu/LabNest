import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { changedStretch, movedSegments } from "./plasmid/edits";
import { featureRow, storedFeature } from "./plasmid/feature-rows";
import { cleanStrands, sequenceKind, type SequenceKind } from "./product-sequences";
import { reserveRecordCode } from "./record-codes";

type Db = Pick<Prisma.TransactionClient, "entitySequenceLink">;
type Tx = Prisma.TransactionClient;

/** A product's strands in its type's order, each with the sequence of its linked version. */
export async function readProductSequences(db: Db, entityId: string | null, typeKey: string | null | undefined) {
  if (!entityId) return [];
  const kind = sequenceKind(typeKey);
  const links = await db.entitySequenceLink.findMany({
    where: { entityId },
    include: { sequenceVersion: { select: { sequence: true, moleculeType: true } } },
    orderBy: { order: "asc" },
  });
  const order = (role: string) => { const index = kind?.strands.findIndex((strand) => strand.role === role) ?? -1; return index < 0 ? 99 : index; };
  return links
    .map((link) => ({
      role: link.role,
      label: kind?.strands.find((strand) => strand.role === link.role)?.label ?? link.role,
      sequence: link.sequenceVersion.sequence,
      molecule: link.sequenceVersion.moleculeType,
    }))
    .sort((a, b) => order(a.role) - order(b.role));
}

/**
 * Saves the strands typed for a product of a sequence type. The first sequence makes the product's entity; a changed
 * strand becomes a new version of its sequence record, so earlier versions stay; an emptied strand is unlinked.
 * Only the bases change on this page, so the new version keeps the topology, the completeness and the features away
 * from the changed bases (moved with any change in length); features on the changed bases are dropped and counted.
 * Returns the entity the strands hang on, or the product's own when nothing was typed.
 */
export async function saveProductSequences(tx: Tx, product: { name: string; entityId: string | null }, kind: SequenceKind, typed: Record<string, string>) {
  const strands = cleanStrands(kind, typed);
  if (!product.entityId && strands.every((strand) => !strand.sequence)) return null;
  const entityId = product.entityId ?? (await tx.entity.create({ data: { name: product.name, type: kind.entity } })).id;
  const links = await tx.entitySequenceLink.findMany({
    where: { entityId },
    include: { sequenceVersion: { select: { sequence: true, topology: true, completeness: true, completenessSource: true, features: { orderBy: { order: "asc" } } } } },
  });
  for (const [order, strand] of strands.entries()) {
    const link = links.find((entry) => entry.role === strand.role);
    if (!strand.sequence) {
      if (link) await tx.entitySequenceLink.delete({ where: { id: link.id } });
      continue;
    }
    if (link?.sequenceVersion.sequence === strand.sequence) continue;
    const checksum = createHash("sha256").update(strand.sequence).digest("hex");
    if (link) {
      const before = link.sequenceVersion;
      const stretch = changedStretch(before.sequence, strand.sequence);
      const features = before.features.flatMap((row) => {
        const feature = storedFeature(row);
        const segments = movedSegments(feature.segments, stretch);
        return segments ? [featureRow({ ...feature, segments }, row.order, row.sourceLabel)] : [];
      });
      const dropped = before.features.length - features.length;
      const latest = await tx.sequenceVersion.findFirst({ where: { sequenceId: link.sequenceId }, orderBy: { versionNumber: "desc" }, select: { versionNumber: true } });
      const versionNumber = (latest?.versionNumber ?? 0) + 1;
      const version = await tx.sequenceVersion.create({
        data: {
          sequenceId: link.sequenceId,
          versionNumber,
          displayVersion: `${versionNumber}.0`,
          moleculeType: kind.molecule,
          sequence: strand.sequence,
          checksum,
          topology: before.topology,
          completeness: before.completeness,
          completenessSource: before.completenessSource,
          features: { create: features },
          changeSummary: dropped ? `Changed on the product page; ${dropped} feature(s) on the changed bases were dropped.` : "Changed on the product page.",
        },
      });
      await tx.entitySequenceLink.update({ where: { id: link.id }, data: { sequenceVersionId: version.id } });
    } else {
      const record = await tx.sequence.create({
        data: {
          code: await reserveRecordCode(tx, "sequence"),
          name: kind.strands.length > 1 ? `${product.name} ${strand.label}` : product.name,
          entryClass: kind.molecule === "Protein" ? "amino_acid" : "nucleic_acid",
          designType: kind.design,
          status: "active",
          versions: { create: { versionNumber: 1, moleculeType: kind.molecule, sequence: strand.sequence, checksum, changeSummary: "Entered on the product page." } },
        },
        include: { versions: { select: { id: true } } },
      });
      await tx.entitySequenceLink.create({ data: { entityId, sequenceId: record.id, sequenceVersionId: record.versions[0].id, role: strand.role, order, isPrimary: order === 0 } });
    }
  }
  await tx.entity.update({ where: { id: entityId }, data: { name: product.name } });
  return entityId;
}
