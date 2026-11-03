"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { keepAttachment } from "@/lib/attachment-files";
import { prisma } from "@/lib/db";
import { formActionErrorMessage } from "@/lib/form-actions";
import { completenessKinds, evidenceKinds, readableFormats, topologies } from "@/lib/plasmid/model";
import { createSequencingFolder, saveFolderReads, savePlasmidVersion } from "@/lib/plasmid/store.server";

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
  sourceFormat: z.enum(readableFormats).optional(),
  sourceFileName: z.string().max(500).optional(),
}).refine((input) => input.record.features.every((item) => item.segments.every((part) => part.start <= part.end && part.end <= input.record.sequence.length)), "A feature lies outside the sequence.");

export type PlasmidSaveResult = { error?: string; warning?: string; productId?: string; versionLabel?: string; unchanged?: boolean };

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
    return { productId: result.productId, versionLabel: result.versionLabel, unchanged: result.unchanged, ...(warning ? { warning } : {}) };
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
