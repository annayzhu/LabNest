import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { SequenceSourceType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { reserveRecordCode } from "@/lib/record-codes";
import { featureRow, storedFeature } from "./feature-rows";
import type { Completeness, ReadableFormat, SequenceRecord, Topology } from "./model";

type Tx = Prisma.TransactionClient;

export type PlasmidChoice = Awaited<ReturnType<typeof listPlasmidProducts>>[number];
export type SavedFolder = Awaited<ReturnType<typeof listSequencingFolders>>[number];

/**
 * What makes two saves the same version: bases, topology, completeness and the features.
 * Qualifier keys are sorted because JSONB does not keep key order.
 */
export function versionFingerprint(record: Pick<SequenceRecord, "sequence" | "topology" | "features">, completeness: Completeness) {
  const features = record.features.map((feature) => [
    feature.name,
    feature.type,
    feature.strand,
    feature.segments.map((segment) => [segment.start, segment.end, Boolean(segment.openStart), Boolean(segment.openEnd)]),
    feature.codonStart ?? null,
    Object.keys(feature.qualifiers).sort().map((key) => [key, feature.qualifiers[key]]),
    feature.color ?? null,
    feature.evidence,
  ]);
  return createHash("sha256").update(JSON.stringify([record.sequence, record.topology, completeness, features])).digest("hex");
}

const sourceTypes: Record<ReadableFormat, SequenceSourceType> = {
  fasta: "fasta_import",
  genbank: "genbank_import",
  snapgene: "snapgene_import",
  abif: "abif_import",
  "seq-text": "seq_import",
};

export type PlasmidSaveInput = {
  target: { kind: "new"; name: string } | { kind: "existing"; productId: string };
  record: Pick<SequenceRecord, "sequence" | "topology" | "features">;
  completeness: Completeness;
  sourceFormat?: ReadableFormat;
  sourceFileName?: string;
};

/**
 * Saves a sequence onto a plasmid product (Q185, F10): a new product when asked, otherwise
 * a new version of its primary sequence — only when something changed, so saving twice
 * keeps one version. Earlier versions stay with their own features.
 */
export async function savePlasmidVersion(tx: Tx, input: PlasmidSaveInput) {
  let product: { id: string; name: string; entityId: string | null };
  if (input.target.kind === "new") {
    // Like the product form: the type decides the 大类, and a type that is turned off takes no new products.
    const type = await tx.scientificSchemaDefinition.findFirst({ where: { key: "plasmid" }, select: { id: true, enabled: true, inventoryGroupKey: true } });
    if (!type?.inventoryGroupKey) throw new Error("The plasmid inventory type is missing.");
    if (!type.enabled) throw new Error("The plasmid inventory type is turned off.");
    product = await tx.inventoryProduct.create({ data: { name: input.target.name, typeId: type.id, groupKey: type.inventoryGroupKey }, select: { id: true, name: true, entityId: true } });
    await tx.activityLog.create({ data: { action: "create", targetType: "inventory_product", targetId: product.id, metadataJson: { name: product.name, typeId: type.id, source: "plasmid_workbench" } } });
  } else {
    const found = await tx.inventoryProduct.findUnique({ where: { id: input.target.productId }, select: { id: true, name: true, entityId: true, type: { select: { key: true } } } });
    if (!found || found.type?.key !== "plasmid") throw new Error("Choose a plasmid in inventory.");
    product = found;
  }
  const entityId = await plasmidEntity(tx, product);

  const link = await primaryLink(tx, entityId);
  const current = link?.sequenceVersion;
  if (current && versionFingerprint({ sequence: current.sequence, topology: current.topology, features: current.features.map(storedFeature) }, current.completeness) === versionFingerprint(input.record, input.completeness)) {
    return { productId: product.id, versionId: current.id, versionLabel: `v${current.displayVersion}`, unchanged: true };
  }
  const data = {
    moleculeType: "DNA" as const,
    sequence: input.record.sequence,
    checksum: createHash("sha256").update(input.record.sequence).digest("hex"),
    topology: input.record.topology,
    completeness: input.completeness,
    sourceType: input.sourceFormat ? sourceTypes[input.sourceFormat] : ("manual" as const),
    sourceFileName: input.sourceFileName ?? null,
    changeSummary: input.sourceFileName ? `Saved from ${input.sourceFileName} in the plasmid workbench.` : "Saved in the plasmid workbench.",
    features: { create: input.record.features.map((feature, order) => featureRow(feature, order, input.sourceFileName ?? null)) },
  };
  let versionId: string;
  let versionNumber: number;
  if (link) {
    const latest = await tx.sequenceVersion.findFirst({ where: { sequenceId: link.sequenceId }, orderBy: { versionNumber: "desc" }, select: { versionNumber: true } });
    versionNumber = (latest?.versionNumber ?? 0) + 1;
    const version = await tx.sequenceVersion.create({ data: { ...data, sequenceId: link.sequenceId, versionNumber, displayVersion: `${versionNumber}.0` }, select: { id: true } });
    await tx.entitySequenceLink.update({ where: { id: link.id }, data: { sequenceVersionId: version.id } });
    versionId = version.id;
  } else {
    versionNumber = 1;
    const sequence = await tx.sequence.create({
      data: {
        code: await reserveRecordCode(tx, "sequence"),
        name: product.name,
        entryClass: "nucleic_acid",
        designType: "plasmid",
        status: "active",
        versions: { create: { ...data, versionNumber: 1 } },
      },
      include: { versions: { select: { id: true } } },
    });
    versionId = sequence.versions[0].id;
    await tx.entitySequenceLink.create({ data: { entityId, sequenceId: sequence.id, sequenceVersionId: versionId, role: "primary", order: 0, isPrimary: true } });
  }
  await tx.activityLog.create({ data: { action: "plasmid_sequence_saved", targetType: "inventory_product", targetId: product.id, metadataJson: { versionId, versionNumber, length: input.record.sequence.length, features: input.record.features.length, sourceFileName: input.sourceFileName ?? null } } });
  return { productId: product.id, versionId, versionLabel: `v${versionNumber}.0`, unchanged: false };
}

export type PlasmidProductView = {
  product: { id: string; name: string };
  version: { id: string; label: string; record: SequenceRecord; completeness: Completeness } | null;
};

/** The plasmid product's current sequence (its primary link), ready for the workbench. */
export async function loadPlasmidProduct(productId: string): Promise<PlasmidProductView | null> {
  const product = await prisma.inventoryProduct.findUnique({ where: { id: productId }, select: { id: true, name: true, entityId: true, type: { select: { key: true } } } });
  if (!product || product.type?.key !== "plasmid") return null;
  const version = product.entityId ? (await primaryLink(prisma, product.entityId))?.sequenceVersion : undefined;
  return {
    product: { id: product.id, name: product.name },
    version: version
      ? {
        id: version.id,
        label: `v${version.displayVersion}`,
        record: { name: product.name, sequence: version.sequence, topology: version.topology as Topology, features: version.features.map(storedFeature) },
        completeness: version.completeness,
      }
      : null,
  };
}

/** The entity a plasmid product's sequences and folders hang on, made on first use. */
async function plasmidEntity(tx: Tx, product: { id: string; name: string; entityId: string | null }) {
  if (product.entityId) return product.entityId;
  const { id } = await tx.entity.create({ data: { name: product.name, type: "plasmid" } });
  await tx.inventoryProduct.update({ where: { id: product.id }, data: { entityId: id } });
  return id;
}

function primaryLink(db: Pick<Tx, "entitySequenceLink">, entityId: string) {
  return db.entitySequenceLink.findFirst({ where: { entityId, role: "primary" }, include: { sequenceVersion: { include: { features: { orderBy: { order: "asc" } } } } } });
}

export async function listPlasmidProducts() {
  return prisma.inventoryProduct.findMany({ where: { type: { key: "plasmid" }, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 });
}

export type FolderReadInput = {
  attachmentId: string | null;
  relativePath: string;
  memberPath: string | null;
  format: string;
  name: string;
  bases: string;
  quality: number[] | null;
  peaks: number[] | null;
  fileSha256: string;
  basesSha256: string;
  evidenceGroup: string;
  metadata: Record<string, string>;
  warnings: string[];
  parserVersion: string;
};

/** A folder about a plasmid hangs on its entity, made here when the plasmid has no sequence yet. */
export async function createSequencingFolder(name: string, productId?: string) {
  return prisma.$transaction(async (tx) => {
    let entityId: string | null = null;
    if (productId) {
      const product = await tx.inventoryProduct.findUnique({ where: { id: productId }, select: { id: true, name: true, entityId: true, type: { select: { key: true } } } });
      if (!product || product.type?.key !== "plasmid") throw new Error("Choose a plasmid in inventory.");
      entityId = await plasmidEntity(tx, product);
    }
    const folder = await tx.sequencingFolder.create({ data: { name, entityId }, select: { id: true } });
    await tx.activityLog.create({ data: { action: "create", targetType: "sequencing_folder", targetId: folder.id, metadataJson: { name, entityId } } });
    return folder.id;
  });
}

/** Replaces a folder's reads with these, in order, so sending them again never doubles them. */
export async function saveFolderReads(folderId: string, reads: FolderReadInput[]) {
  await prisma.$transaction([
    prisma.sequencingRead.deleteMany({ where: { folderId } }),
    prisma.sequencingRead.createMany({
      data: reads.map((read, order) => ({
        folderId,
        attachmentId: read.attachmentId,
        relativePath: read.relativePath,
        memberPath: read.memberPath,
        format: read.format,
        name: read.name,
        bases: read.bases,
        qualityJson: read.quality ?? undefined,
        peaksJson: read.peaks ?? undefined,
        fileSha256: read.fileSha256,
        basesSha256: read.basesSha256,
        evidenceGroup: read.evidenceGroup,
        metadataJson: read.metadata,
        warningsJson: read.warnings,
        parserVersion: read.parserVersion,
        order,
      })),
    }),
  ]);
}

/** Saved folders with the files to fetch when one is opened again (the originals are re-read in the browser). */
export async function listSequencingFolders() {
  const folders = await prisma.sequencingFolder.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, name: true, createdAt: true, entity: { select: { name: true } }, _count: { select: { reads: true } } } });
  const links = await prisma.attachmentLink.findMany({
    where: { targetType: "sequencing_folder", targetId: { in: folders.map((folder) => folder.id) } },
    select: { targetId: true, order: true, attachment: { select: { id: true, originalFilename: true, metadataJson: true } } },
    orderBy: { order: "asc" },
  });
  return folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    createdAt: folder.createdAt.toISOString(),
    plasmid: folder.entity?.name ?? null,
    reads: folder._count.reads,
    files: links.filter((link) => link.targetId === folder.id).map((link) => {
      const metadata = (link.attachment.metadataJson ?? {}) as { relativePath?: string };
      return { attachmentId: link.attachment.id, path: metadata.relativePath ?? link.attachment.originalFilename };
    }),
  }));
}
