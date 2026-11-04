"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { keepAttachment } from "@/lib/attachment-files";
import { prisma } from "@/lib/db";
import { formActionErrorMessage } from "@/lib/form-actions";
import { completenessKinds, completenessSources, evidenceKinds, readableFormats, topologies } from "@/lib/plasmid/model";
import { createSequencingFolder, loadPlasmidProduct, saveFolderReads, savePlasmidVersion } from "@/lib/plasmid/store.server";
import type { InventoryDocument } from "@/lib/plasmid/workbench";
import { addLibraryEntry, removeLibraryEntry } from "@/lib/plasmid/library.server";
import { loadExpectedStructure, saveExpectedStructure } from "@/lib/plasmid/structure.server";
import { dispositions, results } from "@/lib/plasmid/verification";
import { confirmVerification, createVerification, decideItem, listPlasmidTubes, reviseVerification, submitForReview } from "@/lib/plasmid/verification.server";

const segment = z.object({ start: z.number().int().min(0), end: z.number().int().min(0), openStart: z.boolean().optional(), openEnd: z.boolean().optional() });
const feature = z.object({
  name: z.string().max(500),
  type: z.string().min(1).max(100),
  strand: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
  segments: z.array(segment).min(1).max(200),
  codonStart: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  color: z.string().max(40).optional(),
  qualifiers: z.record(z.string(), z.array(z.string().max(50_000))),
  evidence: z.enum(evidenceKinds),
});
const savePayload = z.object({
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("new"), name: z.string().trim().min(1, "Give the plasmid a name.").max(200) }),
    z.object({ kind: z.literal("existing"), productId: z.string().min(1) }),
  ]),
  record: z.object({
    sequence: z.string().regex(/^[ACGTRYSWKMBDHVN]+$/, "The sequence holds characters that are not DNA.").max(2_000_000),
    topology: z.enum(topologies),
    features: z.array(feature).max(5_000),
  }),
  completeness: z.enum(completenessKinds),
  completenessSource: z.enum(completenessSources).nullable().optional(),
  sourceFormat: z.enum(readableFormats).optional(),
  sourceFileName: z.string().max(500).optional(),
}).refine((input) => input.record.features.every((item) => item.segments.every((part) => part.start <= part.end && part.end <= input.record.sequence.length)), "A feature lies outside the sequence.");

export type PlasmidSaveResult = { error?: string; warning?: string; productId?: string; versionId?: string; versionLabel?: string; unchanged?: boolean };

/**
 * Saves the open sequence onto a plasmid product; the original file is kept with that version (Q275, F10). The file is
 * kept after the version is saved, so when keeping it fails the version stays and the result carries a warning.
 */
export async function savePlasmidSequence(formData: FormData): Promise<PlasmidSaveResult> {
  try {
    const input = savePayload.parse(JSON.parse(String(formData.get("payload") ?? "null")));
    const result = await prisma.$transaction((tx) => savePlasmidVersion(tx, input));
    const file = formData.get("file");
    let warning: string | undefined;
    if (!result.unchanged && file instanceof File && file.size) {
      try {
        await keepAttachment(file, { targetType: "sequence_version", targetId: result.versionId, linkType: "source_file" });
      } catch (error) {
        warning = formActionErrorMessage(error, "The original file was not kept.");
      }
    }
    revalidatePath("/inventory");
    revalidatePath(`/inventory/products/${result.productId}`);
    revalidatePath("/tools/plasmid");
    return { productId: result.productId, versionId: result.versionId, versionLabel: result.versionLabel, unchanged: result.unchanged, ...(warning ? { warning } : {}) };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The sequence was not saved.") };
  }
}

export async function startSequencingFolder(name: string, productId?: string): Promise<{ error?: string; folderId?: string }> {
  try {
    const folderName = z.string().trim().min(1, "Give the folder a name.").max(200).parse(name);
    return { folderId: await createSequencingFolder(folderName, productId) };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The folder was not created.") };
  }
}

const fileMeta = z.object({
  relativePath: z.string().max(1_000),
  format: z.string().max(40),
  status: z.string().max(40),
  parser: z.string().max(100),
  unsupported: z.array(z.string().max(1_000)).max(200),
  warnings: z.array(z.string().max(1_000)).max(200),
});

/** Keeps one original file of a folder, with its relative path, parser version and what was not read (Q273). */
export async function addSequencingFile(folderId: string, formData: FormData): Promise<{ error?: string; attachmentId?: string }> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) throw new Error("The file is empty.");
    const meta = fileMeta.parse(JSON.parse(String(formData.get("meta") ?? "null")));
    if (!await prisma.sequencingFolder.findUnique({ where: { id: folderId }, select: { id: true } })) throw new Error("This folder no longer exists.");
    const attachmentId = await keepAttachment(file, { targetType: "sequencing_folder", targetId: folderId, linkType: "sequencing_file" });
    const kept = await prisma.attachment.findUnique({ where: { id: attachmentId }, select: { metadataJson: true } });
    const previous = kept?.metadataJson && typeof kept.metadataJson === "object" && !Array.isArray(kept.metadataJson) ? kept.metadataJson : {};
    await prisma.attachment.update({ where: { id: attachmentId }, data: { metadataJson: { ...previous, ...meta } as Prisma.InputJsonValue } });
    return { attachmentId };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The file was not kept.") };
  }
}

const readPayload = z.array(z.object({
  attachmentId: z.string().nullable(),
  relativePath: z.string().max(1_000),
  memberPath: z.string().max(1_000).nullable(),
  format: z.string().max(40),
  name: z.string().max(500),
  bases: z.string().regex(/^[ACGTRYSWKMBDHVN]*$/).max(200_000),
  quality: z.array(z.number().int().min(0).max(255)).nullable(),
  peaks: z.array(z.number().int().min(0)).nullable(),
  fileSha256: z.string().length(64),
  basesSha256: z.string().length(64),
  evidenceGroup: z.string().max(1_200),
  metadata: z.record(z.string(), z.string().max(2_000)),
  warnings: z.array(z.string().max(1_000)),
  parserVersion: z.string().max(100),
})).max(5_000);

export async function saveSequencingReads(folderId: string, raw: unknown): Promise<{ error?: string; saved?: number }> {
  try {
    const reads = readPayload.parse(raw);
    await saveFolderReads(folderId, reads);
    await prisma.activityLog.create({ data: { action: "sequencing_reads_saved", targetType: "sequencing_folder", targetId: folderId, metadataJson: { reads: reads.length, groups: new Set(reads.map((read) => read.evidenceGroup)).size } } });
    revalidatePath("/tools/plasmid");
    return { saved: reads.length };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The reads were not saved.") };
  }
}

const peptide = z.string().trim().toUpperCase().regex(/^[ACDEFGHIKLMNPQRSTVWY]+$/, "A peptide uses the 20 amino-acid letters only.").min(2).max(5_000);
const structurePayload = z.array(z.object({
  name: z.string().trim().min(1, "Give each element a name.").max(200),
  protein: z.array(peptide).min(1).max(10),
  maxGapBefore: z.number().int().min(0).max(10_000).optional(),
})).max(30);

/** Writes a plasmid product's expected structure (Q360); the elements come in N→C order. */
export async function saveStructure(productId: string, raw: unknown): Promise<{ error?: string; saved?: boolean }> {
  try {
    await saveExpectedStructure(z.string().min(1).parse(productId), structurePayload.parse(raw));
    revalidatePath(`/inventory/products/${productId}`);
    revalidatePath("/tools/plasmid");
    return { saved: true };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The expected structure was not saved.") };
  }
}

const libraryPayload = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("dna"), sequence: z.string().trim().toUpperCase().regex(/^[ACGT]+$/, "DNA entries use A, C, G and T only.").min(8, "A DNA entry needs at least 8 bases.").max(10_000) }),
  z.object({ kind: z.literal("protein"), sequence: peptide }),
]).and(z.object({ name: z.string().trim().min(1, "Give the entry a name.").max(200), type: z.string().trim().min(1).max(60), note: z.string().trim().max(500).optional() }));

/** Adds the lab's own element to the feature library (Q362); everyone's detection finds it from then on. */
export async function addToLibrary(raw: unknown): Promise<{ error?: string; id?: string }> {
  try {
    const id = await addLibraryEntry(libraryPayload.parse(raw));
    revalidatePath("/tools/plasmid");
    return { id };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The entry was not added.") };
  }
}

export async function removeFromLibrary(id: string): Promise<{ error?: string }> {
  try {
    await removeLibraryEntry(z.string().min(1).parse(id));
    revalidatePath("/tools/plasmid");
    return {};
  } catch (error) {
    return { error: formActionErrorMessage(error, "The entry was not removed.") };
  }
}

const verificationPayload = z.object({
  productId: z.string().min(1),
  sequenceVersionId: z.string().min(1),
  referenceSha256: z.string().regex(/^[0-9a-f]{64}$/),
  inventoryItemId: z.string().min(1).nullable(),
  sampleCode: z.string().trim().max(100).nullable(),
  scope: z.object({ kind: z.enum(["whole", "feature", "range"]), label: z.string().max(500), segments: z.array(z.object({ start: z.number().int().min(0), end: z.number().int().min(0) })).min(1).max(4) }),
  settings: z.record(z.string(), z.unknown()),
  reads: z.array(z.unknown()).min(1, "Align at least one read first.").max(500),
  groups: z.unknown(),
  structure: z.unknown().nullable(),
  coverage: z.unknown(),
  items: z.array(z.object({ kind: z.enum(["difference", "gap"]), start: z.number().int().min(0), end: z.number().int().min(0), readName: z.string().max(500).optional(), detail: z.record(z.string(), z.unknown()) })).max(5_000, "Over 5,000 items: narrow the scope or raise the quality threshold."),
});

/** Keeps a new check of a saved plasmid version as a draft (C1, Q372–Q375). */
export async function saveVerification(raw: unknown): Promise<{ error?: string; id?: string }> {
  try {
    const input = verificationPayload.parse(raw);
    const id = await createVerification({ ...input, items: input.items.map((item) => ({ ...item, detail: item.detail as never })) });
    revalidatePath(`/inventory/products/${input.productId}`);
    if (input.inventoryItemId) revalidatePath(`/inventory/${input.inventoryItemId}`);
    return { id };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The check was not saved.") };
  }
}

export async function decideVerificationItem(itemId: string, disposition: string, reason: string): Promise<{ error?: string }> {
  try {
    await decideItem(z.string().min(1).parse(itemId), z.enum(dispositions).parse(disposition), z.string().max(2_000).parse(reason));
    return {};
  } catch (error) {
    return { error: formActionErrorMessage(error, "The decision was not saved.") };
  }
}

export async function submitVerification(id: string): Promise<{ error?: string }> {
  try {
    await submitForReview(z.string().min(1).parse(id));
    revalidatePath(`/tools/plasmid/verifications/${id}`);
    return {};
  } catch (error) {
    return { error: formActionErrorMessage(error, "The check was not sent for review.") };
  }
}

export async function confirmVerificationAction(id: string, raw: unknown): Promise<{ error?: string }> {
  try {
    const input = z.object({ result: z.enum(results), confirmedBy: z.string().max(200), note: z.string().max(5_000) }).parse(raw);
    await confirmVerification(z.string().min(1).parse(id), input);
    revalidatePath(`/tools/plasmid/verifications/${id}`);
    revalidatePath("/inventory", "layout");
    return {};
  } catch (error) {
    return { error: formActionErrorMessage(error, "The check was not confirmed.") };
  }
}

export async function reviseVerificationAction(id: string): Promise<{ error?: string; id?: string }> {
  try {
    return { id: await reviseVerification(z.string().min(1).parse(id)) };
  } catch (error) {
    return { error: formActionErrorMessage(error, "No revision was made.") };
  }
}

/** The tubes of a plasmid, to bind a new check to (Q372). */
export async function plasmidTubes(productId: string) {
  return listPlasmidTubes(z.string().min(1).parse(productId));
}

/** A plasmid's current sequence, to open in a new tab of the workbench. */
export async function openPlasmid(productId: string): Promise<{ error?: string; document?: InventoryDocument }> {
  try {
    const id = z.string().min(1).parse(productId);
    const opened = await loadPlasmidProduct(id);
    if (!opened) return { error: "Choose a plasmid in inventory." };
    if (!opened.version) return { error: "This plasmid has no saved sequence yet." };
    return {
      document: {
        record: opened.version.record,
        label: `${opened.version.label} · From inventory`,
        productId: opened.product.id,
        versionId: opened.version.id,
        completeness: opened.version.completeness,
        completenessSource: opened.version.completenessSource,
        structure: await loadExpectedStructure(id),
      },
    };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The plasmid could not be opened.") };
  }
}
