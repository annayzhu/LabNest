"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { matchSampleTokens, parseGroupAssignments, parseSampleList } from "@/lib/experiment-samples";
import { formActionErrorMessage } from "@/lib/form-actions";
import { deductAmount, matchKey, sampleUnit } from "@/lib/samples";
import { openExperiment } from "@/lib/samples.server";

type Tx = Prisma.TransactionClient;
export type ExperimentSampleState = { error?: string; success?: string; missing?: string[]; ambiguous?: string[] };

const experimentId = z.string().min(1);

/** One change to an open experiment's samples, in a transaction; the error comes back as the state. */
async function editSamples(id: string, fallback: string, work: (tx: Tx) => Promise<ExperimentSampleState | void>): Promise<ExperimentSampleState> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await openExperiment(tx, id);
      return work(tx);
    }, { timeout: 30_000, maxWait: 10_000 });
    revalidatePath(`/experiments/${id}`);
    revalidatePath(`/experiments/${id}/run`);
    revalidatePath("/samples");
    return result ?? {};
  } catch (error) {
    return { error: formActionErrorMessage(error, fallback) };
  }
}

/** Adds samples as inputs, by ID or from a pasted list of codes or names; samples already in the experiment are skipped. */
export async function addExperimentSamples(raw: unknown): Promise<ExperimentSampleState> {
  const input = z.object({ experimentId, sampleIds: z.array(z.string().min(1)).max(500).optional(), list: z.string().max(50_000).optional() }).safeParse(raw);
  if (!input.success) return { error: "Choose samples to add." };
  return editSamples(input.data.experimentId, "The samples could not be added.", async (tx) => {
    let ids = input.data.sampleIds ?? [];
    let missing: string[] = [], ambiguous: string[] = [];
    if (input.data.list?.trim()) {
      const tokens = parseSampleList(input.data.list);
      if (tokens.length > 500) throw new Error("Paste at most 500 codes or names at a time.");
      const insensitive = tokens.flatMap((token) => [{ code: { equals: token, mode: "insensitive" as const } }, { name: { equals: token, mode: "insensitive" as const } }]);
      const candidates = await tx.sample.findMany({ where: { OR: insensitive }, select: { id: true, code: true, name: true } });
      const matched = matchSampleTokens(tokens, candidates);
      ids = [...ids, ...matched.matched.map((sample) => sample.id)];
      missing = matched.missing;
      ambiguous = matched.ambiguous;
    }
    const existing = new Set((await tx.experimentSample.findMany({ where: { experimentId: input.data.experimentId }, select: { sampleId: true } })).map((link) => link.sampleId));
    const fresh = [...new Set(ids)].filter((id) => !existing.has(id));
    const found = await tx.sample.findMany({ where: { id: { in: fresh } }, select: { id: true } });
    const order = (await tx.experimentSample.aggregate({ where: { experimentId: input.data.experimentId, role: "input" }, _max: { sortOrder: true } }))._max.sortOrder ?? -1;
    const byOrder = fresh.filter((id) => found.some((sample) => sample.id === id));
    await tx.experimentSample.createMany({ data: byOrder.map((sampleId, index) => ({ experimentId: input.data.experimentId, sampleId, role: "input" as const, sortOrder: order + 1 + index })) });
    if (byOrder.length) await tx.activityLog.create({ data: { action: "samples_add", targetType: "experiment", targetId: input.data.experimentId, metadataJson: { sampleIds: byOrder } } });
    const skipped = ids.length - byOrder.length;
    return { success: `${byOrder.length} sample${byOrder.length === 1 ? "" : "s"} added${skipped > 0 ? `; ${skipped} already in this experiment` : ""}.`, missing, ambiguous };
  });
}

/** Takes an input back out; what its use subtracted is given back to the sample. Outputs leave with their sample or batch. */
export async function removeExperimentSample(raw: unknown): Promise<ExperimentSampleState> {
  const input = z.object({ experimentId, linkIds: z.array(z.string().min(1)).min(1).max(500) }).safeParse(raw);
  if (!input.success) return { error: "Choose samples to remove." };
  return editSamples(input.data.experimentId, "The samples could not be removed.", async (tx) => {
    const links = await tx.experimentSample.findMany({ where: { id: { in: input.data.linkIds }, experimentId: input.data.experimentId }, include: { sample: { select: { id: true, code: true, amount: true } } } });
    if (links.some((link) => link.role === "output")) throw new Error("Samples this experiment produced are removed by deleting them or undoing their batch.");
    for (const link of links) {
      if (link.deducted && link.sample.amount !== null) await tx.sample.update({ where: { id: link.sampleId }, data: { amount: Number((link.sample.amount + link.deducted).toPrecision(12)) } });
      await tx.experimentSample.delete({ where: { id: link.id } });
    }
    await tx.activityLog.create({ data: { action: "samples_remove", targetType: "experiment", targetId: input.data.experimentId, metadataJson: { sampleIds: links.map((link) => link.sampleId), givenBack: links.filter((link) => link.deducted).map((link) => ({ sampleId: link.sampleId, amount: link.deducted })) } } });
    return { success: `${links.length} sample${links.length === 1 ? "" : "s"} removed.` };
  });
}

/** Moves one sample up or down among the experiment's samples of the same role; plates are laid out in this order. */
export async function moveExperimentSample(raw: unknown): Promise<ExperimentSampleState> {
  const input = z.object({ experimentId, linkId: z.string().min(1), direction: z.union([z.literal(-1), z.literal(1)]) }).safeParse(raw);
  if (!input.success) return { error: "Choose a sample to move." };
  return editSamples(input.data.experimentId, "The order could not be changed.", async (tx) => {
    const link = await tx.experimentSample.findFirst({ where: { id: input.data.linkId, experimentId: input.data.experimentId } });
    if (!link) throw new Error("This sample is no longer in the experiment.");
    const siblings = await tx.experimentSample.findMany({ where: { experimentId: input.data.experimentId, role: link.role }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
    const index = siblings.findIndex((sibling) => sibling.id === link.id), target = index + input.data.direction;
    if (target < 0 || target >= siblings.length) return;
    [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
    for (const [order, sibling] of siblings.entries()) await tx.experimentSample.update({ where: { id: sibling.id }, data: { sortOrder: order } });
  });
}

/** The experiment's groups in order (S13): renamed and reordered in place; a group left out is removed and its samples ungrouped. */
export async function saveExperimentSampleGroups(raw: unknown): Promise<ExperimentSampleState> {
  const input = z.object({ experimentId, groups: z.array(z.object({ id: z.string().optional(), label: z.string().trim().min(1, "A group needs a name.").max(60) })).max(48) }).safeParse(raw);
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Check the groups." };
  if (new Set(input.data.groups.map((group) => matchKey(group.label))).size !== input.data.groups.length) return { error: "Two groups have the same name." };
  return editSamples(input.data.experimentId, "The groups could not be saved.", async (tx) => {
    const current = await tx.experimentSampleGroup.findMany({ where: { experimentId: input.data.experimentId } });
    const kept = new Set(input.data.groups.flatMap((group) => group.id ? [group.id] : []));
    await tx.experimentSampleGroup.deleteMany({ where: { experimentId: input.data.experimentId, id: { notIn: [...kept] } } });
    // Names are unique per experiment, so renames go through a temporary name first.
    for (const group of current.filter((group) => kept.has(group.id))) await tx.experimentSampleGroup.update({ where: { id: group.id }, data: { label: `\u0000${group.id}` } });
    for (const [order, group] of input.data.groups.entries()) {
      if (group.id && current.some((existing) => existing.id === group.id)) await tx.experimentSampleGroup.update({ where: { id: group.id }, data: { label: group.label, sortOrder: order } });
      else await tx.experimentSampleGroup.create({ data: { experimentId: input.data.experimentId, label: group.label, sortOrder: order } });
    }
    await tx.activityLog.create({ data: { action: "sample_groups", targetType: "experiment", targetId: input.data.experimentId, metadataJson: { groups: input.data.groups.map((group) => group.label) } } });
    return { success: "Groups saved." };
  });
}

async function groupNamed(tx: Tx, id: string, label: string) {
  const existing = await tx.experimentSampleGroup.findFirst({ where: { experimentId: id, label: { equals: label, mode: "insensitive" } } });
  if (existing) return existing;
  const order = (await tx.experimentSampleGroup.aggregate({ where: { experimentId: id }, _max: { sortOrder: true } }))._max.sortOrder ?? -1;
  return tx.experimentSampleGroup.create({ data: { experimentId: id, label, sortOrder: order + 1 } });
}

/** Puts the chosen samples in a group, a new one by name, or in none (S13). */
export async function setExperimentSampleGroup(raw: unknown): Promise<ExperimentSampleState> {
  const input = z.object({ experimentId, linkIds: z.array(z.string().min(1)).min(1).max(500), groupId: z.string().nullable().optional(), newGroup: z.string().trim().max(60).optional() }).safeParse(raw);
  if (!input.success) return { error: "Choose samples and a group." };
  return editSamples(input.data.experimentId, "The group could not be set.", async (tx) => {
    let groupId = input.data.groupId ?? null;
    if (input.data.newGroup) groupId = (await groupNamed(tx, input.data.experimentId, input.data.newGroup)).id;
    else if (groupId && !await tx.experimentSampleGroup.findFirst({ where: { id: groupId, experimentId: input.data.experimentId } })) throw new Error("This group no longer exists.");
    const { count } = await tx.experimentSample.updateMany({ where: { id: { in: input.data.linkIds }, experimentId: input.data.experimentId }, data: { groupId } });
    return { success: `${count} sample${count === 1 ? "" : "s"} ${groupId ? "grouped" : "ungrouped"}.` };
  });
}

/** Pasted "sample⇥group" lines (S13); groups are created as named, samples matched by code or name within the experiment. */
export async function assignExperimentGroups(raw: unknown): Promise<ExperimentSampleState> {
  const input = z.object({ experimentId, text: z.string().max(50_000) }).safeParse(raw);
  if (!input.success) return { error: "Paste two columns: sample and group." };
  const lines = parseGroupAssignments(input.data.text);
  if (!lines.length) return { error: "Paste two columns: sample and group." };
  return editSamples(input.data.experimentId, "The groups could not be set.", async (tx) => {
    const links = await tx.experimentSample.findMany({ where: { experimentId: input.data.experimentId }, include: { sample: { select: { code: true, name: true } } } });
    // Matched as samples, identified by their link to this experiment.
    const candidates = links.map((link) => ({ id: link.id, code: link.sample.code, name: link.sample.name }));
    const missing: string[] = [], ambiguous: string[] = [];
    let count = 0;
    for (const line of lines) {
      const matched = matchSampleTokens([line.sample], candidates);
      missing.push(...matched.missing);
      ambiguous.push(...matched.ambiguous);
      if (!matched.matched.length) continue;
      const group = await groupNamed(tx, input.data.experimentId, line.group);
      await tx.experimentSample.update({ where: { id: matched.matched[0].id }, data: { groupId: group.id } });
      count += 1;
    }
    return { success: `${count} sample${count === 1 ? "" : "s"} grouped.`, missing, ambiguous };
  });
}

/**
 * What the experiment took from an input (S12). Subtracted from the sample when the units compare, after giving back
 * what an earlier entry took; an empty amount clears the use.
 */
export async function setExperimentSampleUse(raw: unknown): Promise<ExperimentSampleState> {
  const input = z.object({ experimentId, linkId: z.string().min(1), amount: z.string().max(40), unit: z.string().max(40) }).safeParse(raw);
  if (!input.success) return { error: "Enter an amount." };
  const amount = input.data.amount.trim() ? Number(input.data.amount.trim().replace(",", ".")) : null;
  if (amount !== null && !(Number.isFinite(amount) && amount > 0)) return { error: "Enter an amount above 0." };
  const unit = sampleUnit(input.data.unit);
  if (amount !== null && !unit) return { error: "Give the amount a unit." };
  return editSamples(input.data.experimentId, "The amount could not be saved.", async (tx) => {
    const link = await tx.experimentSample.findFirst({ where: { id: input.data.linkId, experimentId: input.data.experimentId }, include: { sample: true } });
    if (!link || link.role !== "input") throw new Error("Only samples this experiment takes have an amount used.");
    const restored = link.deducted && link.sample.amount !== null ? Number((link.sample.amount + link.deducted).toPrecision(12)) : link.sample.amount;
    const deduction = amount === null ? null : deductAmount({ amount: restored, amountUnit: link.sample.amountUnit }, { value: amount, unit });
    if (deduction && restored !== null && deduction.deducted > restored) throw new Error(`${link.sample.code} has only ${restored} ${link.sample.amountUnit} left.`);
    await tx.sample.update({ where: { id: link.sampleId }, data: { amount: deduction ? deduction.remaining : restored } });
    await tx.experimentSample.update({ where: { id: link.id }, data: { usedAmount: amount, usedUnit: amount === null ? null : unit, deducted: deduction?.deducted ?? null } });
    await tx.activityLog.create({ data: { action: "use", targetType: "sample", targetId: link.sampleId, metadataJson: { code: link.sample.code, experimentId: input.data.experimentId, used: amount === null ? null : `${amount} ${unit}`, amountBefore: link.sample.amount, amountAfter: deduction ? deduction.remaining : restored } } });
    return { success: deduction ? `${link.sample.code} now has ${deduction.remaining} ${link.sample.amountUnit} left.` : amount === null ? "Use cleared." : "Recorded; the units do not compare with the sample's, so nothing was subtracted." };
  });
}
