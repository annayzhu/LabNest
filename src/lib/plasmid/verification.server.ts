import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { allowedResults, choicesFor, confirmBlockers, type Disposition, type DraftItem, type ItemKind, type VerificationResult, type VerificationScope } from "./verification";

export type VerificationInput = {
  productId: string;
  sequenceVersionId: string;
  referenceSha256: string;
  inventoryItemId: string | null;
  sampleCode: string | null;
  scope: VerificationScope;
  settings: Record<string, unknown>;
  reads: unknown[];
  groups: unknown;
  structure: unknown;
  coverage: unknown;
  items: DraftItem[];
};

/**
 * Keeps a new check as a draft (C1). The page computes the alignment from files that may never be uploaded, so the server
 * checks what it can know: the version belongs to the plasmid and still holds the bases the page aligned to, the tube is
 * a lot of this plasmid, and the scope lies on the reference.
 */
export async function createVerification(input: VerificationInput) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.inventoryProduct.findUnique({ where: { id: input.productId }, select: { id: true, entityId: true, type: { select: { key: true } } } });
    if (product?.type?.key !== "plasmid" || !product.entityId) throw new Error("Choose a plasmid in inventory.");
    const version = await tx.sequenceVersion.findUnique({ where: { id: input.sequenceVersionId }, select: { id: true, sequence: true, sequenceId: true } });
    const linked = version && await tx.entitySequenceLink.findFirst({ where: { entityId: product.entityId, sequenceId: version.sequenceId }, select: { id: true } });
    if (!version || !linked) throw new Error("This sequence version does not belong to the plasmid.");
    if (createHash("sha256").update(version.sequence).digest("hex") !== input.referenceSha256) throw new Error("The saved version holds other bases than the open sequence. Save it first, then check again.");
    const length = version.sequence.length;
    if (!input.scope.segments.length || input.scope.segments.some((segment) => segment.start < 0 || segment.end > length || segment.start >= segment.end)) throw new Error("The scope lies outside the reference.");
    if (input.inventoryItemId) {
      const item = await tx.inventoryItem.findUnique({ where: { id: input.inventoryItemId }, select: { productId: true } });
      if (item?.productId !== product.id) throw new Error("Choose a tube of this plasmid.");
    }
    const sample = input.sampleCode ? await tx.sample.findUnique({ where: { code: input.sampleCode }, select: { id: true } }) : null;
    if (input.sampleCode && !sample) throw new Error(`No sample has the code ${input.sampleCode}.`);
    const created = await tx.plasmidVerification.create({
      data: {
        productId: product.id,
        sequenceVersionId: version.id,
        referenceSha256: input.referenceSha256,
        inventoryItemId: input.inventoryItemId,
        sampleId: sample?.id ?? null,
        scopeJson: input.scope as Prisma.InputJsonValue,
        settingsJson: input.settings as Prisma.InputJsonValue,
        readsJson: input.reads as Prisma.InputJsonValue,
        groupsJson: input.groups as Prisma.InputJsonValue,
        structureJson: (input.structure ?? undefined) as Prisma.InputJsonValue | undefined,
        coverageJson: input.coverage as Prisma.InputJsonValue,
        items: { create: input.items.map((item, order) => ({ order, kind: item.kind, start: item.start, end: item.end, readName: item.readName ?? null, detailJson: item.detail as Prisma.InputJsonValue })) },
      },
      select: { id: true },
    });
    await tx.activityLog.create({ data: { action: "plasmid_verification_created", targetType: "inventory_product", targetId: product.id, metadataJson: { verificationId: created.id, items: input.items.length, inventoryItemId: input.inventoryItemId } } });
    return created.id;
  });
}

export async function loadVerification(id: string) {
  const record = await prisma.plasmidVerification.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, name: true, entityId: true } },
      sequenceVersion: { select: { id: true, displayVersion: true, sequence: true, topology: true, sequenceId: true } },
      inventoryItem: { select: { id: true, name: true, lotNumber: true, barcode: true, aliquotCode: true } },
      sample: { select: { id: true, code: true, name: true } },
      supersedes: { select: { id: true, createdAt: true } },
      supersededBy: { select: { id: true, status: true } },
      items: { orderBy: { order: "asc" } },
    },
  });
  if (!record) return null;
  // Q378: a record speaks for the version it was made on; say so when the plasmid has moved on.
  const current = record.product.entityId ? await prisma.entitySequenceLink.findFirst({ where: { entityId: record.product.entityId, role: "primary" }, select: { sequenceVersionId: true } }) : null;
  return { ...record, currentVersion: current?.sequenceVersionId === record.sequenceVersionId };
}

export type LoadedVerification = NonNullable<Awaited<ReturnType<typeof loadVerification>>>;

/** Checks of a plasmid or of one tube, newest first, for the product and item pages (Q381). */
export async function listVerifications(where: { productId?: string; inventoryItemId?: string }) {
  return prisma.plasmidVerification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, status: true, result: true, confirmedBy: true, confirmedAt: true, createdAt: true, scopeJson: true, sequenceVersionId: true,
      sequenceVersion: { select: { displayVersion: true } },
      inventoryItem: { select: { id: true, name: true, lotNumber: true } },
    },
  });
}

async function editable(tx: Prisma.TransactionClient, id: string) {
  const record = await tx.plasmidVerification.findUnique({ where: { id }, select: { status: true } });
  if (!record) throw new Error("This check no longer exists.");
  if (record.status === "confirmed" || record.status === "superseded") throw new Error("A confirmed check cannot change. Revise it to make a new one.");
}

/** Records what a person decided about one item (Q374); every choice but "to check" needs a reason. */
export async function decideItem(itemId: string, disposition: Disposition, reason: string) {
  await prisma.$transaction(async (tx) => {
    const item = await tx.plasmidVerificationItem.findUnique({ where: { id: itemId }, select: { verificationId: true, kind: true } });
    if (!item) throw new Error("This item no longer exists.");
    await editable(tx, item.verificationId);
    if (!choicesFor(item.kind as ItemKind).includes(disposition)) throw new Error("That choice does not apply to this item.");
    if (disposition !== "pending" && !reason.trim()) throw new Error("Give a reason.");
    await tx.plasmidVerificationItem.update({ where: { id: itemId }, data: { disposition, reason: disposition === "pending" ? null : reason.trim(), decidedAt: disposition === "pending" ? null : new Date() } });
  });
}

export async function submitForReview(id: string) {
  await prisma.$transaction(async (tx) => {
    await editable(tx, id);
    await tx.plasmidVerification.update({ where: { id }, data: { status: "review" } });
  });
}

/**
 * Confirms a check with a result the items allow (Q377). The confirmer is typed by hand (Q376). A revision's predecessor
 * becomes superseded, and stays as it was (Q378).
 */
export async function confirmVerification(id: string, input: { result: VerificationResult; confirmedBy: string; note: string }) {
  await prisma.$transaction(async (tx) => {
    await editable(tx, id);
    const record = await tx.plasmidVerification.findUniqueOrThrow({ where: { id }, select: { productId: true, supersedesId: true, items: { select: { kind: true, disposition: true } } } });
    const items = record.items.map((item) => ({ kind: item.kind as ItemKind, disposition: item.disposition }));
    const blockers = confirmBlockers(items, input.result, input.confirmedBy, allowedResults(items));
    if (blockers.length) throw new Error(blockers.join("; "));
    await tx.plasmidVerification.update({ where: { id }, data: { status: "confirmed", result: input.result, confirmedBy: input.confirmedBy.trim(), confirmedAt: new Date(), note: input.note.trim() || null } });
    if (record.supersedesId) await tx.plasmidVerification.update({ where: { id: record.supersedesId }, data: { status: "superseded" } });
    await tx.activityLog.create({ data: { action: "plasmid_verification_confirmed", targetType: "inventory_product", targetId: record.productId, metadataJson: { verificationId: id, result: input.result, confirmedBy: input.confirmedBy.trim() } } });
  });
}

/** A revision (Q378): a new draft with the same frozen inputs and the earlier decisions to start from. */
export async function reviseVerification(id: string) {
  return prisma.$transaction(async (tx) => {
    const record = await tx.plasmidVerification.findUnique({ where: { id }, include: { items: { orderBy: { order: "asc" } }, supersededBy: { select: { id: true } } } });
    if (!record) throw new Error("This check no longer exists.");
    if (record.status !== "confirmed") throw new Error("Only a confirmed check is revised; change the draft itself.");
    if (record.supersededBy) return record.supersededBy.id;
    const json = (value: Prisma.JsonValue | null) => (value === null ? undefined : (value as Prisma.InputJsonValue));
    const created = await tx.plasmidVerification.create({
      data: {
        productId: record.productId,
        sequenceVersionId: record.sequenceVersionId,
        referenceSha256: record.referenceSha256,
        inventoryItemId: record.inventoryItemId,
        sampleId: record.sampleId,
        scopeJson: json(record.scopeJson)!,
        settingsJson: json(record.settingsJson)!,
        readsJson: json(record.readsJson)!,
        groupsJson: json(record.groupsJson)!,
        structureJson: json(record.structureJson),
        coverageJson: json(record.coverageJson)!,
        supersedesId: record.id,
        items: { create: record.items.map((item) => ({ order: item.order, kind: item.kind, start: item.start, end: item.end, readName: item.readName, detailJson: json(item.detailJson)!, disposition: item.disposition, reason: item.reason, decidedAt: item.decidedAt })) },
      },
      select: { id: true },
    });
    return created.id;
  });
}

/** Tubes of a plasmid to bind a check to (Q372). */
export async function listPlasmidTubes(productId: string) {
  return prisma.inventoryItem.findMany({ where: { productId, status: "active" }, select: { id: true, name: true, lotNumber: true, barcode: true, aliquotCode: true }, orderBy: { createdAt: "desc" }, take: 200 });
}
