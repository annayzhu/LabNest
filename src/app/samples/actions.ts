"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";
import {
  ancestorsOf, checkSampleRows, deductAmount, freePositions, isSampleStatus, matchKey, MAX_BOX_COLUMNS, MAX_BOX_ROWS, MAX_SAMPLE_BATCH, normalizePosition,
  positionProblem, sampleDeleteBlockers, sampleTypeRef, type SampleRowInput,
} from "@/lib/samples";
import { createSampleBatch, openExperiment, SampleBatchError, sampleBatchContext, sampleLocationOptions, sampleReferenceCounts, type SampleBatchProblem } from "@/lib/samples.server";
import type { BulkEntry } from "@/lib/inventory-bulk";
import type { BankImportUpdate } from "@/lib/sample-bank/import.server";

type Tx = Prisma.TransactionClient;

const text = (value: FormDataEntryValue | null) => String(value ?? "").trim() || undefined;
const cell = z.string().max(500).optional();
const rowSchema = z.object({
  code: z.string().max(80).optional(), name: z.string().max(200).optional(), typeId: cell, origin: cell, parentCode: z.string().max(80).optional(),
  locationId: cell, position: z.string().max(40).optional(), amount: z.string().max(40).optional(), amountUnit: z.string().max(40).optional(),
  concentration: z.string().max(40).optional(), concentrationUnit: z.string().max(40).optional(), collectedAt: z.string().max(40).optional(),
  biosafetyLevel: z.string().max(20).optional(), notes: z.string().max(5000).optional(), fields: z.record(z.string(), z.string().max(500)).optional(),
});
const batchSchema = z.object({
  rows: z.array(rowSchema).min(1, "Add at least one sample.").max(MAX_SAMPLE_BATCH, `One batch holds at most ${MAX_SAMPLE_BATCH} samples.`),
  projectId: z.string().trim().optional(),
  experimentId: z.string().trim().optional(),
  /** Aliquots (S9): what is split off can be subtracted from the parent, which can also be marked used up. */
  aliquotOf: z.object({ sampleId: z.string().min(1), subtract: z.boolean(), depleted: z.boolean() }).optional(),
});

export type SampleBatchResult = { error?: string; problems?: SampleBatchProblem[]; count?: number; href?: string };

function revalidateSamples(id?: string) {
  revalidatePath("/samples");
  revalidatePath("/samples/boxes");
  if (id) revalidatePath(`/samples/${id}`);
}

/** Checks a batch against the database without writing anything (S8). */
export async function checkSampleBatch(raw: unknown): Promise<SampleBatchResult> {
  try {
    const input = batchSchema.parse(raw);
    const result = await prisma.$transaction((tx) => sampleBatchContext(tx, input.rows as SampleRowInput[]).then((context) => checkSampleRows(input.rows as SampleRowInput[], context)));
    return { problems: result.rows.filter((row) => row.problems.length).map(({ index, problems }) => ({ index, problems })), count: input.rows.length };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The samples could not be checked.") };
  }
}

/** Saves a whole batch or nothing (S8); with an experiment the samples are its outputs (S11). */
export async function saveSampleBatch(raw: unknown): Promise<SampleBatchResult> {
  let href: string;
  let count: number;
  try {
    const input = batchSchema.parse(raw);
    const result = await prisma.$transaction(async (tx) => {
      const experiment = input.experimentId ? await openExperiment(tx, input.experimentId) : null;
      const batch = await createSampleBatch(tx, input.rows as SampleRowInput[], { projectId: input.projectId || experiment?.projectId || null, experimentId: experiment?.id ?? null });
      if (input.aliquotOf) await adjustAliquotParent(tx, input.aliquotOf, batch.samples.map((sample) => sample.id));
      return batch;
    }, { timeout: 60_000, maxWait: 10_000 });
    count = result.samples.length;
    href = input.experimentId ? `/experiments/${input.experimentId}#section-setup` : `/samples?batch=${encodeURIComponent(result.batchId)}`;
    if (input.experimentId) revalidatePath(`/experiments/${input.experimentId}`);
  } catch (error) {
    if (error instanceof SampleBatchError) return { error: error.message, problems: error.rows };
    return { error: formActionErrorMessage(error, "The samples could not be saved.", "Another save took one of these codes or positions just now; check again.") };
  }
  revalidateSamples();
  return { count, href };
}

/** After splitting a sample (S9): subtract the aliquots' total where the units compare, and mark it used up if asked. */
async function adjustAliquotParent(tx: Tx, options: { sampleId: string; subtract: boolean; depleted: boolean }, aliquotIds: string[]) {
  const parent = await tx.sample.findUnique({ where: { id: options.sampleId } });
  if (!parent) throw new Error("The parent sample no longer exists.");
  const aliquots = await tx.sample.findMany({ where: { id: { in: aliquotIds } }, select: { parentId: true, amount: true, amountUnit: true } });
  if (aliquots.some((aliquot) => aliquot.parentId !== parent.id)) throw new Error(`Every aliquot needs ${parent.code} as its parent sample.`);
  let amount: number | null = parent.amount;
  if (options.subtract && amount !== null) {
    for (const aliquot of aliquots) {
      const deduction: ReturnType<typeof deductAmount> = aliquot.amount ? deductAmount({ amount, amountUnit: parent.amountUnit }, { value: aliquot.amount, unit: aliquot.amountUnit ?? "" }) : null;
      if (deduction) amount = deduction.remaining;
    }
  }
  const data = { amount, ...(options.depleted ? { status: "depleted" as const, locationId: null, position: null } : {}) };
  if (amount === parent.amount && !options.depleted) return;
  await tx.sample.update({ where: { id: parent.id }, data });
  await tx.activityLog.create({ data: { action: "aliquot", targetType: "sample", targetId: parent.id, metadataJson: JSON.parse(JSON.stringify({ code: parent.code, aliquots: aliquotIds.length, amountBefore: parent.amount, amountAfter: amount, depleted: options.depleted, previousPlace: options.depleted ? { locationId: parent.locationId, position: parent.position } : undefined })) } });
}

const sampleFields = (formData: FormData) => {
  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (key.startsWith("field:") && typeof value === "string") fields[key.slice(6)] = value;
  return fields;
};

/** Edits one sample. Leaving storage frees its box position; the old place stays in the history (S5). */
export async function updateSample(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  let id: string;
  try {
    id = z.string().min(1).parse(formData.get("id"));
    const status = String(formData.get("status") ?? "available");
    if (!isSampleStatus(status)) throw new Error("Choose a status.");
    const row: SampleRowInput = {
      code: text(formData.get("code")), name: text(formData.get("name")), typeId: text(formData.get("typeId")), origin: text(formData.get("origin")),
      parentCode: text(formData.get("parentCode")), locationId: status === "available" ? text(formData.get("locationId")) : undefined,
      position: status === "available" ? text(formData.get("position")) : undefined, amount: text(formData.get("amount")), amountUnit: text(formData.get("amountUnit")),
      concentration: text(formData.get("concentration")), concentrationUnit: text(formData.get("concentrationUnit")), collectedAt: text(formData.get("collectedAt")),
      biosafetyLevel: text(formData.get("biosafetyLevel")), notes: text(formData.get("notes")), fields: sampleFields(formData),
    };
    if (!row.code) throw new Error("Code is required.");
    const projectId = text(formData.get("projectId")) ?? null;
    await prisma.$transaction(async (tx) => {
      const current = await tx.sample.findUnique({ where: { id }, include: { type: { select: { label: true } } } });
      if (!current) throw new Error("This sample no longer exists.");
      const context = await sampleBatchContext(tx, [row]);
      // The sample itself does not count against its own code or position.
      context.existingCodes.delete(matchKey(current.code));
      if (current.locationId && current.position) context.occupied.get(current.locationId)?.delete(normalizePosition(current.position));
      // A type turned off since stays valid on the samples that already have it.
      if (current.typeId === row.typeId && !context.types.has(current.typeId)) {
        const kept = await tx.scientificSchemaDefinition.findUnique({ where: { id: current.typeId } });
        if (kept) context.types.set(kept.id, sampleTypeRef(kept));
      }
      const [checked] = checkSampleRows([row], context).rows;
      if (checked.problems.length || !checked.value) throw new Error(checked.problems.join(" "));
      const value = checked.value;
      if (value.parentId) {
        const all = await tx.sample.findMany({ select: { id: true, parentId: true } });
        const byId = new Map(all.map((sample) => [sample.id, sample]));
        if (value.parentId === id || ancestorsOf(byId.get(value.parentId)!, byId).some((ancestor) => ancestor.id === id)) throw new Error("A sample cannot descend from itself.");
      }
      const next = {
        code: row.code!, name: value.name, typeId: value.typeId, origin: value.origin, parentId: value.parentId, projectId,
        locationId: value.locationId, position: value.position, amount: value.amount, amountUnit: value.amountUnit,
        concentration: value.concentration, concentrationUnit: value.concentrationUnit, status, biosafetyLevel: value.biosafetyLevel,
        collectedAt: value.collectedAt, notes: value.notes, fieldValues: value.fieldValues,
      };
      const changed = Object.fromEntries(Object.entries(next).filter(([key, after]) => JSON.stringify((current as Record<string, unknown>)[key] ?? null) !== JSON.stringify(after ?? null)));
      if (!Object.keys(changed).length) return;
      await tx.sample.update({ where: { id }, data: next });
      await tx.activityLog.create({ data: { action: "update", targetType: "sample", targetId: id, metadataJson: JSON.parse(JSON.stringify({ code: next.code, previous: Object.fromEntries(Object.keys(changed).map((key) => [key, (current as Record<string, unknown>)[key] ?? null])), next: changed })) } });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The sample could not be saved.", "Another sample already has this code or position.") };
  }
  revalidateSamples(id);
  redirect(`/samples/${id}`);
}

/** Deletes a sample nothing refers to, after its code is typed (S10); otherwise it is to be marked discarded. */
export async function deleteSample(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const id = z.string().min(1).parse(formData.get("id"));
    const confirmation = String(formData.get("confirmation") ?? "").trim();
    await prisma.$transaction(async (tx) => {
      const sample = await tx.sample.findUnique({ where: { id } });
      if (!sample) throw new Error("This sample no longer exists.");
      if (confirmation !== sample.code) throw new Error(`Enter ${sample.code} exactly to confirm permanent deletion.`);
      const blockers = sampleDeleteBlockers((await sampleReferenceCounts(tx, [id])).get(id)!);
      if (blockers.length) throw new Error(`This sample has ${blockers.join(", ")}, so it cannot be deleted. Mark it as discarded instead.`);
      await tx.sample.delete({ where: { id } });
      await tx.activityLog.create({ data: { action: "delete", targetType: "sample", targetId: id, metadataJson: JSON.parse(JSON.stringify({ code: sample.code, name: sample.name, batchId: sample.batchId, locationId: sample.locationId, position: sample.position })) } });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The sample could not be deleted.") };
  }
  revalidateSamples();
  redirect("/samples");
}

/** Removes a whole batch while none of it is used by an experiment or has children outside the batch (S8). */
export async function undoSampleBatch(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  let removed = 0, restored = 0;
  try {
    const batchId = z.string().min(1).parse(formData.get("batchId"));
    ({ removed, restored } = await prisma.$transaction(async (tx) => {
      const samples = await tx.sample.findMany({ where: { batchId }, select: { id: true } });
      // A bank import's batch also holds the samples it updated; undoing puts their bank-owned values back (S26).
      const bankImport = await tx.sampleBankImport.findUnique({ where: { id: batchId } });
      const updates = bankImport && !bankImport.undoneAt ? bankImport.updated as unknown as BankImportUpdate[] : [];
      if (!samples.length && !updates.length) throw new Error("This batch has no samples left.");
      const ids = samples.map((sample) => sample.id);
      const [outsideChildren, uses] = await Promise.all([
        tx.sample.count({ where: { parentId: { in: ids }, NOT: { batchId } } }),
        tx.experimentSample.count({ where: { sampleId: { in: ids }, role: "input" } }),
      ]);
      const blockers = sampleDeleteBlockers({ children: outsideChildren, experiments: uses });
      if (blockers.length) throw new Error(`This batch has ${blockers.join(", ")}, so it can no longer be undone.`);
      // Outputs registered with the batch go with it; parents inside the batch are released first.
      await tx.experimentSample.deleteMany({ where: { sampleId: { in: ids } } });
      await tx.sample.updateMany({ where: { id: { in: ids } }, data: { parentId: null } });
      await tx.sample.deleteMany({ where: { id: { in: ids } } });
      for (const { sampleId, before } of updates) {
        await tx.sample.updateMany({ where: { id: sampleId }, data: { ...before, collectedAt: before.collectedAt ? new Date(before.collectedAt) : null, fieldValues: before.fieldValues as Prisma.InputJsonValue } });
      }
      if (bankImport && !bankImport.undoneAt) await tx.sampleBankImport.update({ where: { id: batchId }, data: { undoneAt: new Date() } });
      await tx.activityLog.create({ data: { action: "undo_batch", targetType: "sample_batch", targetId: batchId, metadataJson: { count: ids.length, sampleIds: ids, restored: updates.map((update) => update.sampleId) } } });
      return { removed: ids.length, restored: updates.length };
    }));
  } catch (error) {
    return { error: formActionErrorMessage(error, "The batch could not be undone.") };
  }
  revalidateSamples();
  revalidatePath("/experiments");
  const removedText = `${removed} sample${removed === 1 ? "" : "s"} removed`;
  return { success: restored ? `${removedText}; ${restored} put back as they were.` : `${removedText}.` };
}

/** A box's rows and columns (S7); refused while a sample sits outside the new size. Empty clears the grid. */
export async function setBoxGrid(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const locationId = z.string().min(1).parse(formData.get("locationId"));
    const rows = text(formData.get("rows")), columns = text(formData.get("columns"));
    const geometry = rows || columns ? {
      rows: z.coerce.number().int().min(1).max(MAX_BOX_ROWS, `A box has at most ${MAX_BOX_ROWS} rows.`).parse(rows),
      columns: z.coerce.number().int().min(1).max(MAX_BOX_COLUMNS, `A box has at most ${MAX_BOX_COLUMNS} columns.`).parse(columns),
    } : null;
    await prisma.$transaction(async (tx) => {
      const location = await tx.inventoryLocation.findUnique({ where: { id: locationId }, select: { id: true, name: true } });
      if (!location) throw new Error("This storage location no longer exists.");
      if (geometry) {
        const placed = await tx.sample.findMany({ where: { locationId, position: { not: null } }, select: { code: true, position: true } });
        const outside = placed.filter((sample) => positionProblem(sample.position!, geometry));
        if (outside.length) throw new Error(`${outside.length} sample${outside.length === 1 ? " sits" : "s sit"} outside ${geometry.rows} × ${geometry.columns}: ${outside.slice(0, 5).map((sample) => `${sample.code} ${sample.position}`).join(", ")}.`);
      }
      await tx.inventoryLocation.update({ where: { id: locationId }, data: { gridRows: geometry?.rows ?? null, gridColumns: geometry?.columns ?? null } });
      await tx.activityLog.create({ data: { action: "set_grid", targetType: "inventory_location", targetId: locationId, metadataJson: { name: location.name, rows: geometry?.rows ?? null, columns: geometry?.columns ?? null } } });
    });
    revalidateSamples();
    return { success: geometry ? `Box size set to ${geometry.rows} × ${geometry.columns}.` : "Box size cleared." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The box size could not be saved.") };
  }
}

export type FoundSample = { id: string; code: string; name: string; type: string; place: string | null; status: string };

/** Samples to choose for an experiment (S12): by code, name or origin, type and box; at most 200, in storage first. */
export async function findSamples(raw: unknown): Promise<{ error?: string; samples?: FoundSample[] }> {
  try {
    const input = z.object({ query: z.string().max(200).optional(), typeId: z.string().optional(), locationId: z.string().optional(), inStorage: z.boolean().optional() }).parse(raw);
    const query = input.query?.trim();
    const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });
    const [samples, locations] = await Promise.all([
      prisma.sample.findMany({
        where: {
          ...(input.typeId ? { typeId: input.typeId } : {}),
          ...(input.locationId ? { locationId: input.locationId } : {}),
          ...(input.inStorage ? { status: "available" as const } : {}),
          ...(query ? { OR: [{ code: contains(query) }, { name: contains(query) }, { origin: contains(query) }] } : {}),
        },
        include: { type: { select: { label: true } } },
        orderBy: [{ status: "asc" }, { locationId: "asc" }, { position: "asc" }, { code: "asc" }],
        take: 200,
      }),
      sampleLocationOptions(prisma),
    ]);
    const place = new Map(locations.map((location) => [location.id, location.label]));
    return { samples: samples.map((sample) => ({ id: sample.id, code: sample.code, name: sample.name, type: sample.type.label, status: sample.status, place: sample.locationId ? `${place.get(sample.locationId) ?? ""}${sample.position ? ` ${sample.position}` : ""}` : null })) };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The samples could not be searched.") };
  }
}

// Bulk actions on the samples checked in the list (S10): shown record by record before anything is written.

export type SampleBulkState = { error?: string; entries?: BulkEntry[] };
const bulkSchema = z.object({
  action: z.enum(["status", "move", "project", "delete"]),
  ids: z.array(z.string().min(1)).min(1, "Select at least one sample.").max(MAX_SAMPLE_BATCH),
  status: z.string().optional(),
  locationId: z.string().nullable().optional(),
  start: z.string().max(10).optional(),
  projectId: z.string().nullable().optional(),
  confirmation: z.string().optional(),
});
type BulkInput = z.infer<typeof bulkSchema>;

async function bulkPlan(tx: Tx, input: BulkInput) {
  const samples = await tx.sample.findMany({ where: { id: { in: input.ids } }, orderBy: [{ locationId: "asc" }, { code: "asc" }] });
  const label = (sample: { code: string; name: string }) => `${sample.name} (${sample.code})`;
  const plan: Array<BulkEntry & { position?: string | null }> = [];
  if (input.action === "status") {
    if (!isSampleStatus(input.status)) throw new Error("Choose a status.");
    for (const sample of samples) plan.push(sample.status === input.status ? { id: sample.id, name: label(sample), outcome: "skip", reason: "Already has this status." } : { id: sample.id, name: label(sample), outcome: "change" });
  }
  if (input.action === "project") {
    for (const sample of samples) plan.push(sample.projectId === (input.projectId ?? null) ? { id: sample.id, name: label(sample), outcome: "skip", reason: "Already in this project." } : { id: sample.id, name: label(sample), outcome: "change" });
  }
  if (input.action === "move") {
    const box = input.locationId ? (await sampleLocationOptions(tx)).find((location) => location.id === input.locationId) : null;
    if (input.locationId && !box) throw new Error("Choose a storage location.");
    const free = box?.geometry ? freePositions(box.geometry, (await tx.sample.findMany({ where: { locationId: box.id, position: { not: null }, id: { notIn: input.ids } }, select: { position: true } })).map((sample) => sample.position!), input.start) : [];
    for (const sample of samples) {
      if (sample.status !== "available") { plan.push({ id: sample.id, name: label(sample), outcome: "skip", reason: "Only samples in storage have a place." }); continue; }
      if (box?.geometry) {
        const position = free.shift();
        plan.push(position ? { id: sample.id, name: label(sample), outcome: "change", position } : { id: sample.id, name: label(sample), outcome: "skip", reason: `No free position left in ${box.label}.` });
      } else plan.push({ id: sample.id, name: label(sample), outcome: "change", position: null });
    }
  }
  if (input.action === "delete") {
    const counts = await sampleReferenceCounts(tx, samples.map((sample) => sample.id));
    for (const sample of samples) {
      const blockers = sampleDeleteBlockers(counts.get(sample.id)!);
      plan.push(blockers.length ? { id: sample.id, name: label(sample), outcome: "skip", reason: `Has ${blockers.join(", ")}; mark it as discarded instead.` } : { id: sample.id, name: label(sample), outcome: "delete" });
    }
  }
  return { samples, plan };
}

const publicEntries = (plan: Array<BulkEntry & { position?: string | null }>) => plan.map((entry) => ({ id: entry.id, name: entry.position ? `${entry.name} → ${entry.position}` : entry.name, outcome: entry.outcome, ...(entry.reason ? { reason: entry.reason } : {}) }));

export async function previewSampleBulk(raw: unknown): Promise<SampleBulkState> {
  try {
    const input = bulkSchema.parse(raw);
    return { entries: publicEntries((await prisma.$transaction((tx) => bulkPlan(tx, input))).plan) };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The selection could not be checked.") };
  }
}

export async function applySampleBulk(raw: unknown): Promise<SampleBulkState> {
  try {
    const input = bulkSchema.parse(raw);
    if (input.action === "delete" && input.confirmation?.trim() !== String(input.ids.length)) throw new Error(`Type ${input.ids.length} to confirm deleting the selected samples.`);
    const entries = await prisma.$transaction(async (tx) => {
      const { samples, plan } = await bulkPlan(tx, input);
      const byId = new Map(samples.map((sample) => [sample.id, sample]));
      for (const entry of plan) {
        const sample = byId.get(entry.id)!;
        if (entry.outcome === "change" && input.action === "status") await tx.sample.update({ where: { id: entry.id }, data: { status: input.status as never, ...(input.status === "available" ? {} : { locationId: null, position: null }) } });
        if (entry.outcome === "change" && input.action === "project") await tx.sample.update({ where: { id: entry.id }, data: { projectId: input.projectId ?? null } });
        if (entry.outcome === "change" && input.action === "move") await tx.sample.update({ where: { id: entry.id }, data: { locationId: input.locationId ?? null, position: input.locationId ? entry.position ?? null : null } });
        if (entry.outcome === "delete") await tx.sample.delete({ where: { id: entry.id } });
        if (entry.outcome !== "skip") await tx.activityLog.create({ data: { action: input.action === "delete" ? "delete" : "update", targetType: "sample", targetId: entry.id, metadataJson: JSON.parse(JSON.stringify({ code: sample.code, bulk: input.action, previous: { status: sample.status, locationId: sample.locationId, position: sample.position, projectId: sample.projectId } })) } });
      }
      await tx.activityLog.create({ data: { action: `bulk_${input.action}`, targetType: "sample_bulk", targetId: randomUUID(), metadataJson: JSON.parse(JSON.stringify({ status: input.status ?? null, locationId: input.locationId ?? null, projectId: input.projectId ?? null, entries: plan })) } });
      return publicEntries(plan);
    }, { timeout: 60_000, maxWait: 10_000 });
    revalidateSamples();
    return { entries };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The samples could not be changed.", "Another sample took one of these positions just now; try again.") };
  }
}
