import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { SequenceSourceType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { reserveRecordCode } from "@/lib/record-codes";
import { evidenceKinds, type Completeness, type ReadableFormat, type Segment, type SequenceFeature, type SequenceRecord, type Strand, type Topology } from "./model";

type Tx = Prisma.TransactionClient;

export type PlasmidChoice = Awaited<ReturnType<typeof listPlasmidProducts>>[number];
export type SavedFolder = Awaited<ReturnType<typeof listSequencingFolders>>[number];

type StoredFeature = {
  name: string;
  type: string;
  start: number;
  end: number;
  strand: string | null;
  note: string | null;
  segmentsJson?: Prisma.JsonValue | null;
  codonStart?: number | null;
  qualifiersJson?: Prisma.JsonValue | null;
  color?: string | null;
  evidence?: string | null;
};

/**
 * `segmentsJson` holds the exact parts (joins, origin crossing); rows written before it
 * keep only the overall span, 1-based and closed as GenBank writes it.
 */
export function storedFeature(row: StoredFeature): SequenceFeature {
  const strand: Strand | 0 = row.strand === "+" ? 1 : row.strand === "-" ? -1 : 0;
  const segments = Array.isArray(row.segmentsJson) && row.segmentsJson.length ? (row.segmentsJson as Segment[]) : [{ start: row.start - 1, end: row.end }];
  const qualifiers = row.qualifiersJson && typeof row.qualifiersJson === "object" && !Array.isArray(row.qualifiersJson)
    ? (row.qualifiersJson as Record<string, string[]>)
    : row.note ? { note: [row.note] } : {};
  const codonStart = row.codonStart === 1 || row.codonStart === 2 || row.codonStart === 3 ? row.codonStart : undefined;
  const evidence = evidenceKinds.find((value) => value === row.evidence) ?? "file";
  return { name: row.name, type: row.type, strand, segments, qualifiers, evidence, ...(codonStart ? { codonStart } : {}), ...(row.color ? { color: row.color } : {}) };
}

function featureRow(feature: SequenceFeature, order: number, sourceLabel: string | null) {
  return {
    name: feature.name,
    type: feature.type,
    start: Math.min(...feature.segments.map((segment) => segment.start)) + 1,
    end: Math.max(...feature.segments.map((segment) => segment.end)),
    strand: feature.strand === 1 ? "+" : feature.strand === -1 ? "-" : null,
    note: feature.qualifiers.note?.[0] ?? null,
    segmentsJson: feature.segments as Prisma.InputJsonValue,
    codonStart: feature.codonStart ?? null,
    qualifiersJson: feature.qualifiers as Prisma.InputJsonValue,
    color: feature.color ?? null,
    evidence: feature.evidence,
    sourceLabel,
    order,
  };
}

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
  const entityId = product.entityId ?? (await tx.entity.create({ data: { name: product.name, type: "plasmid" } })).id;
  if (!product.entityId) await tx.inventoryProduct.update({ where: { id: product.id }, data: { entityId } });

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

export async function createSequencingFolder(name: string, productId?: string) {
  const entityId = productId ? (await prisma.inventoryProduct.findUnique({ where: { id: productId }, select: { entityId: true } }))?.entityId ?? null : null;
  const folder = await prisma.sequencingFolder.create({ data: { name, entityId }, select: { id: true } });
  await prisma.activityLog.create({ data: { action: "create", targetType: "sequencing_folder", targetId: folder.id, metadataJson: { name } } });
  return folder.id;
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
