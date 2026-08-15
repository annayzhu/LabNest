"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readSheet } from "read-excel-file/node";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";
import { reserveRecordCode } from "@/lib/record-codes";
import { designMetadataFields } from "@/lib/sequence-registry";
import { parseFasta, validateSequence, type MoleculeType } from "@/lib/sequence";

const designTypes = ["plasmid", "primer", "probe", "siRNA", "shRNA", "gRNA", "oligo", "peptide", "protein", "fragment", "other"] as const;
const lifecycleStatuses = ["draft", "active", "inactive", "archived"] as const;
const validationStatuses = ["unverified", "validation_in_progress", "validated_recommended", "validated_limited", "validated_not_recommended", "inconclusive"] as const;
const moleculeTypes = ["DNA", "RNA", "Protein"] as const;
const topologies = ["linear", "circular"] as const;
const strandednessValues = ["single", "double", "unknown"] as const;
const collectionTypes = ["primer_pair", "sirna_duplex", "shrna_construct", "probe_panel", "plasmid_construct", "peptide_set", "other"] as const;

const featureSchema = z.object({
  name: z.string().trim().min(1, "Feature name is required.").max(160),
  type: z.string().trim().min(1, "Feature type is required.").max(80),
  start: z.coerce.number().int().min(1),
  end: z.coerce.number().int().min(1),
  strand: z.enum(["+", "-", ""]).optional(),
  note: z.string().trim().max(500).optional(),
});

const modificationSchema = z.object({
  position: z.string().trim().min(1, "Modification position is required.").max(40),
  modification: z.string().trim().min(1, "Modification name is required.").max(120),
  note: z.string().trim().max(500).optional(),
});

const sequenceInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Sequence name is required.").max(180),
  designType: z.enum(designTypes),
  status: z.enum(lifecycleStatuses),
  description: z.string().trim().max(5000).optional(),
  projectId: z.string().trim().optional(),
  targetName: z.string().trim().max(180).optional(),
  organism: z.string().trim().max(180).optional(),
  moleculeType: z.enum(moleculeTypes),
  sequence: z.string().max(10_000_000),
  topology: z.enum(topologies),
  strandedness: z.enum(strandednessValues),
  displayVersion: z.string().trim().min(1).max(30),
  validationStatus: z.enum(validationStatuses),
  validationSummary: z.string().trim().max(5000).optional(),
  changeSummary: z.string().trim().max(1000).optional(),
  features: z.array(featureSchema).max(500),
  modifications: z.array(modificationSchema).max(500),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});

type SequenceInput = z.infer<typeof sequenceInputSchema>;

export type SequenceManageState = FormActionState & { success?: string };

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function parseJsonArray(value: FormDataEntryValue | null, label: string) {
  const text = String(value ?? "[]").trim() || "[]";
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error(`${label} data is malformed. Reload the page and try again.`);
  }
}

function metadataFromForm(formData: FormData) {
  const fields = [...new Map(Object.values(designMetadataFields).flat().map((field) => [field.key, field])).values()];
  const entries: Array<[string, string | number | boolean]> = [];
  for (const field of fields) {
    const value = optionalText(formData.get(`meta_${field.key}`));
    if (value === undefined) continue;
    if (field.type === "number") {
      const number = Number(value);
      if (!Number.isFinite(number)) throw new Error(`${field.label} must be a number.`);
      entries.push([field.key, number]);
    } else {
      entries.push([field.key, value]);
    }
  }
  return Object.fromEntries(entries);
}

function parseSequenceForm(formData: FormData) {
  return prepareSequenceInput({
    id: optionalText(formData.get("id")),
    name: formData.get("name"),
    designType: formData.get("designType") ?? "other",
    status: formData.get("status") ?? "draft",
    description: optionalText(formData.get("description")),
    projectId: optionalText(formData.get("projectId")),
    targetName: optionalText(formData.get("targetName")),
    organism: optionalText(formData.get("organism")),
    moleculeType: formData.get("moleculeType") ?? "DNA",
    sequence: formData.get("sequence") ?? "",
    topology: formData.get("topology") ?? "linear",
    strandedness: formData.get("strandedness") ?? "unknown",
    displayVersion: formData.get("displayVersion") ?? "1.0",
    validationStatus: formData.get("validationStatus") ?? "unverified",
    validationSummary: optionalText(formData.get("validationSummary")),
    changeSummary: optionalText(formData.get("changeSummary")),
    features: parseJsonArray(formData.get("featuresJson"), "Feature"),
    modifications: parseJsonArray(formData.get("modificationsJson"), "Modification"),
    metadata: metadataFromForm(formData),
  });
}

function prepareSequenceInput(value: unknown): SequenceInput {
  const parsed = sequenceInputSchema.parse(value);
  const validation = validateSequence(parsed.sequence, parsed.moleculeType as MoleculeType, {
    allowTerminalDeoxythymidineOverhang: parsed.designType === "siRNA",
  });
  if (validation.errors.length) throw new Error(validation.errors.join(" "));
  for (const feature of parsed.features) {
    if (feature.start > feature.end) throw new Error(`${feature.name}: feature start must not exceed its end.`);
    if (feature.end > validation.normalized.length) throw new Error(`${feature.name}: feature end exceeds the sequence length (${validation.normalized.length}).`);
  }
  if (parsed.status === "active" && parsed.validationStatus === "validated_not_recommended") {
    throw new Error("A sequence marked not recommended cannot remain active. Choose Inactive or Archived.");
  }
  if (["validated_recommended", "validated_limited", "validated_not_recommended", "inconclusive"].includes(parsed.validationStatus) && !parsed.validationSummary) {
    throw new Error("Record a validation summary for this validation conclusion.");
  }
  return { ...parsed, sequence: validation.normalized };
}

function checksum(sequence: string) {
  return createHash("sha256").update(sequence).digest("hex");
}

function versionRelations(input: SequenceInput) {
  return {
    features: {
      create: input.features.map((feature) => ({
        name: feature.name,
        type: feature.type,
        start: feature.start,
        end: feature.end,
        strand: feature.strand || null,
        note: feature.note || null,
      })),
    },
    modifications: {
      create: input.modifications.map((modification, order) => ({
        position: modification.position,
        modification: modification.modification,
        note: modification.note || null,
        order,
      })),
    },
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => JSON.parse(stableJson(item))));
  if (value && typeof value === "object") {
    return JSON.stringify(Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, JSON.parse(stableJson(item))])));
  }
  return JSON.stringify(value ?? null);
}

function currentVersionShape(version: {
  sequence: string;
  moleculeType: string;
  topology: string;
  strandedness: string;
  features: Array<{ name: string; type: string; start: number; end: number; strand: string | null; note: string | null }>;
  modifications: Array<{ position: string; modification: string; note: string | null }>;
}) {
  return {
    sequence: version.sequence,
    moleculeType: version.moleculeType,
    topology: version.topology,
    strandedness: version.strandedness,
    features: version.features.map((feature) => ({ ...feature, strand: feature.strand ?? "", note: feature.note ?? undefined })),
    modifications: version.modifications.map((modification) => ({ ...modification, note: modification.note ?? undefined })),
  };
}

function inputVersionShape(input: SequenceInput) {
  return {
    sequence: input.sequence,
    moleculeType: input.moleculeType,
    topology: input.topology,
    strandedness: input.strandedness,
    features: input.features.map((feature) => ({ ...feature, strand: feature.strand ?? "", note: feature.note ?? undefined })),
    modifications: input.modifications.map((modification) => ({ ...modification, note: modification.note ?? undefined })),
  };
}

async function createSequenceInTransaction(
  tx: Prisma.TransactionClient,
  input: SequenceInput,
  source: { type?: "manual" | "fasta_import" | "csv_import" | "xlsx_import"; fileName?: string } = {},
) {
  const code = await reserveRecordCode(tx, "sequence");
  const record = await tx.sequence.create({
    data: {
      code,
      name: input.name,
      designType: input.designType,
      status: input.status,
      description: input.description,
      projectId: input.projectId,
      targetName: input.targetName,
      organism: input.organism,
      metadataJson: input.metadata,
      versions: {
        create: {
          versionNumber: 1,
          displayVersion: input.displayVersion,
          moleculeType: input.moleculeType,
          sequence: input.sequence,
          checksum: checksum(input.sequence),
          topology: input.topology,
          strandedness: input.strandedness,
          validationStatus: input.validationStatus,
          validationSummary: input.validationSummary,
          validatedAt: ["validated_recommended", "validated_limited", "validated_not_recommended", "inconclusive"].includes(input.validationStatus) ? new Date() : undefined,
          changeSummary: input.changeSummary || "Initial sequence version",
          sourceType: source.type ?? "manual",
          sourceFileName: source.fileName,
          ...versionRelations(input),
        },
      },
    },
  });
  await tx.activityLog.create({ data: { action: "create", targetType: "sequence", targetId: record.id, metadataJson: { code, designType: input.designType, sourceType: source.type ?? "manual" } } });
  return record;
}

export async function createSequence(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  let id: string;
  try {
    const input = parseSequenceForm(formData);
    const autoCreateEntity = formData.get("autoCreateEntity") === "on";
    const record = await prisma.$transaction(async (tx) => {
      const created = await createSequenceInTransaction(tx, input);
      if (autoCreateEntity) {
        const version = await tx.sequenceVersion.findFirst({ where: { sequenceId: created.id }, orderBy: { versionNumber: "desc" } });
        if (!version) throw new Error("The initial Sequence version could not be resolved.");
        const entity = await tx.entity.create({
          data: {
            name: input.name,
            type: entityTypeForDesign(input.designType),
            code: created.code,
            projectId: input.projectId,
            status: input.status === "active" ? "active" : "inactive",
            description: input.description,
            sequenceId: created.id,
            metadataJson: { sequenceManaged: true, designType: input.designType },
          },
        });
        await tx.entitySequenceLink.create({ data: { entityId: entity.id, sequenceId: created.id, sequenceVersionId: version.id, role: "primary", isPrimary: true } });
      }
      return created;
    });
    id = record.id;
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Sequence could not be created.") };
  }
  revalidatePath("/sequences");
  redirect(`/sequences/${id}`);
}

function entityTypeForDesign(designType: SequenceInput["designType"]): "plasmid" | "primer" | "oligo" | "protein" | "other" {
  if (designType === "plasmid") return "plasmid";
  if (designType === "primer") return "primer";
  if (["probe", "siRNA", "shRNA", "gRNA", "oligo"].includes(designType)) return "oligo";
  if (["peptide", "protein"].includes(designType)) return "protein";
  return "other";
}

export async function updateSequence(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  let id: string;
  try {
    const input = parseSequenceForm(formData);
    if (!input.id) throw new Error("Sequence ID is required.");
    id = input.id;
    await prisma.$transaction(async (tx) => {
      const current = await tx.sequence.findUnique({
        where: { id },
        include: { versions: { include: { features: { orderBy: { start: "asc" } }, modifications: { orderBy: { order: "asc" } } }, orderBy: { versionNumber: "desc" }, take: 1 } },
      });
      const latest = current?.versions[0];
      if (!current || !latest) throw new Error("This Sequence no longer exists.");
      const contentChanged = stableJson(currentVersionShape(latest)) !== stableJson(inputVersionShape(input));
      const validationConclusionChanged = input.validationStatus !== latest.validationStatus;
      if (contentChanged && !input.changeSummary) throw new Error("Describe why a new sequence version is being created.");
      if (contentChanged && input.displayVersion === latest.displayVersion) throw new Error("Choose a new version label when sequence content, features, or modifications change.");

      await tx.sequence.update({
        where: { id },
        data: {
          name: input.name,
          designType: input.designType,
          status: input.status,
          description: input.description,
          projectId: input.projectId || null,
          targetName: input.targetName || null,
          organism: input.organism || null,
          metadataJson: input.metadata,
        },
      });
      await tx.entity.updateMany({
        where: { sequenceId: id },
        data: { status: input.status === "active" ? "active" : input.status === "archived" ? "archived" : "inactive" },
      });

      if (contentChanged) {
        await tx.sequenceVersion.create({
          data: {
            sequenceId: id,
            versionNumber: latest.versionNumber + 1,
            displayVersion: input.displayVersion,
            moleculeType: input.moleculeType,
            sequence: input.sequence,
            checksum: checksum(input.sequence),
            topology: input.topology,
            strandedness: input.strandedness,
            validationStatus: input.validationStatus,
            validationSummary: input.validationSummary,
            validatedAt: ["validated_recommended", "validated_limited", "validated_not_recommended", "inconclusive"].includes(input.validationStatus) ? new Date() : undefined,
            changeSummary: input.changeSummary,
            ...versionRelations(input),
          },
        });
      } else {
        await tx.sequenceVersion.update({
          where: { id: latest.id },
          data: {
            validationStatus: input.validationStatus,
            validationSummary: input.validationSummary || null,
            validatedAt: ["validated_recommended", "validated_limited", "validated_not_recommended", "inconclusive"].includes(input.validationStatus) ? (validationConclusionChanged ? new Date() : latest.validatedAt ?? new Date()) : null,
          },
        });
      }
      await tx.activityLog.create({ data: { action: contentChanged ? "create_version" : "update", targetType: "sequence", targetId: id, metadataJson: { contentChanged, previousStatus: current.status, status: input.status, previousValidationStatus: latest.validationStatus, validationStatus: input.validationStatus } } });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Sequence could not be saved.", "This exact sequence content already exists as a version of this record.") };
  }
  revalidatePath("/sequences");
  revalidatePath(`/sequences/${id}`);
  redirect(`/sequences/${id}`);
}

const entityLinkSchema = z.object({
  sequenceId: z.string().min(1),
  sequenceVersionId: z.string().min(1),
  entityId: z.string().min(1),
  role: z.string().trim().min(1).max(80),
  isPrimary: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

export async function linkSequenceEntity(_previousState: SequenceManageState, formData: FormData): Promise<SequenceManageState> {
  try {
    const parsed = entityLinkSchema.parse({
      sequenceId: formData.get("sequenceId"),
      sequenceVersionId: formData.get("sequenceVersionId"),
      entityId: formData.get("entityId"),
      role: formData.get("role"),
      isPrimary: formData.get("isPrimary") === "on",
      note: optionalText(formData.get("note")),
    });
    await prisma.$transaction(async (tx) => {
      const version = await tx.sequenceVersion.findFirst({ where: { id: parsed.sequenceVersionId, sequenceId: parsed.sequenceId }, select: { id: true } });
      if (!version) throw new Error("The selected version does not belong to this Sequence.");
      if (parsed.isPrimary) await tx.entitySequenceLink.updateMany({ where: { entityId: parsed.entityId }, data: { isPrimary: false } });
      await tx.entitySequenceLink.upsert({
        where: { entityId_sequenceVersionId_role: { entityId: parsed.entityId, sequenceVersionId: parsed.sequenceVersionId, role: parsed.role } },
        create: parsed,
        update: { isPrimary: parsed.isPrimary, note: parsed.note },
      });
      if (parsed.isPrimary) await tx.entity.update({ where: { id: parsed.entityId }, data: { sequenceId: parsed.sequenceId } });
      await tx.activityLog.create({ data: { action: "link", targetType: "sequence", targetId: parsed.sequenceId, metadataJson: { entityId: parsed.entityId, sequenceVersionId: parsed.sequenceVersionId, role: parsed.role } } });
    });
    revalidatePath(`/sequences/${parsed.sequenceId}`);
    revalidatePath("/entities");
    return { success: "Entity link saved." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Entity link could not be saved.") };
  }
}

export async function unlinkSequenceEntity(_previousState: SequenceManageState, formData: FormData): Promise<SequenceManageState> {
  try {
    const linkId = z.string().min(1).parse(formData.get("linkId"));
    const sequenceId = z.string().min(1).parse(formData.get("sequenceId"));
    const link = await prisma.entitySequenceLink.findUnique({ where: { id: linkId } });
    if (!link || link.sequenceId !== sequenceId) throw new Error("This link no longer exists.");
    await prisma.$transaction(async (tx) => {
      await tx.entitySequenceLink.delete({ where: { id: linkId } });
      if (link.isPrimary) {
        const replacement = await tx.entitySequenceLink.findFirst({ where: { entityId: link.entityId }, orderBy: [{ isPrimary: "desc" }, { order: "asc" }] });
        await tx.entity.update({ where: { id: link.entityId }, data: { sequenceId: replacement?.sequenceId ?? null } });
        if (replacement) await tx.entitySequenceLink.update({ where: { id: replacement.id }, data: { isPrimary: true } });
      }
      await tx.activityLog.create({ data: { action: "unlink", targetType: "sequence", targetId: sequenceId, metadataJson: { entityId: link.entityId, sequenceVersionId: link.sequenceVersionId, role: link.role } } });
    });
    revalidatePath(`/sequences/${sequenceId}`);
    return { success: "Entity link removed." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Entity link could not be removed.") };
  }
}

const researchLinkSchema = z.object({
  sequenceId: z.string().min(1),
  sequenceVersionId: z.string().min(1),
  targetType: z.enum(["project", "research_plan", "protocol", "experiment", "result"]),
  targetId: z.string().min(1),
  linkType: z.string().trim().min(1).max(80),
  note: z.string().trim().max(500).optional(),
});

export async function linkSequenceResearchRecord(_previousState: SequenceManageState, formData: FormData): Promise<SequenceManageState> {
  try {
    const parsed = researchLinkSchema.parse({
      sequenceId: formData.get("sequenceId"),
      sequenceVersionId: formData.get("sequenceVersionId"),
      targetType: formData.get("targetType"),
      targetId: formData.get("targetId"),
      linkType: formData.get("linkType") ?? "used_by",
      note: optionalText(formData.get("note")),
    });
    const version = await prisma.sequenceVersion.findFirst({ where: { id: parsed.sequenceVersionId, sequenceId: parsed.sequenceId }, select: { id: true } });
    if (!version) throw new Error("The selected version does not belong to this Sequence.");
    const duplicate = await prisma.itemLink.findFirst({ where: { sourceType: "sequence_version", sourceId: parsed.sequenceVersionId, targetType: parsed.targetType, targetId: parsed.targetId, linkType: parsed.linkType } });
    if (duplicate) throw new Error("This research link already exists.");
    await prisma.$transaction([
      prisma.itemLink.create({ data: { sourceType: "sequence_version", sourceId: parsed.sequenceVersionId, targetType: parsed.targetType, targetId: parsed.targetId, linkType: parsed.linkType, note: parsed.note } }),
      prisma.activityLog.create({ data: { action: "link", targetType: "sequence", targetId: parsed.sequenceId, metadataJson: { sequenceVersionId: parsed.sequenceVersionId, targetType: parsed.targetType, targetId: parsed.targetId, linkType: parsed.linkType } } }),
    ]);
    revalidatePath(`/sequences/${parsed.sequenceId}`);
    return { success: "Research link saved." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The research link could not be saved.") };
  }
}

export async function unlinkSequenceResearchRecord(_previousState: SequenceManageState, formData: FormData): Promise<SequenceManageState> {
  try {
    const linkId = z.string().min(1).parse(formData.get("linkId"));
    const sequenceId = z.string().min(1).parse(formData.get("sequenceId"));
    const link = await prisma.itemLink.findUnique({ where: { id: linkId } });
    if (!link || (link.sourceType !== "sequence" && link.sourceType !== "sequence_version")) throw new Error("This link no longer exists.");
    if (link.sourceType === "sequence" && link.sourceId !== sequenceId) throw new Error("This link does not belong to this Sequence.");
    if (link.sourceType === "sequence_version") {
      const version = await prisma.sequenceVersion.findFirst({ where: { id: link.sourceId, sequenceId }, select: { id: true } });
      if (!version) throw new Error("This link does not belong to this Sequence.");
    }
    await prisma.itemLink.delete({ where: { id: linkId } });
    await prisma.activityLog.create({ data: { action: "unlink", targetType: "sequence", targetId: sequenceId, metadataJson: { linkId } } });
    revalidatePath(`/sequences/${sequenceId}`);
    return { success: "Research link removed." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The research link could not be removed.") };
  }
}

const collectionMemberSchema = z.object({
  sequenceVersionId: z.string().min(1),
  role: z.string().trim().min(1).max(80),
  note: z.string().trim().max(500).optional(),
});

const collectionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Collection name is required.").max(180),
  type: z.enum(collectionTypes),
  status: z.enum(lifecycleStatuses),
  description: z.string().trim().max(5000).optional(),
  projectId: z.string().trim().optional(),
  members: z.array(collectionMemberSchema).min(1, "Add at least one sequence version.").max(500),
});

const sequenceBatchIntentSchema = z.enum(["delete", "set_project", "set_description", "set_type"]);
const sequenceCollectionBatchIntentSchema = z.enum(["delete", "set_project", "set_description", "set_type"]);

type BulkActionState = FormActionState & { success?: string };

function parseBulkIds(formData: FormData, fieldName = "ids", max = 500) {
  const ids = [...new Set(formData.getAll(fieldName).map(String).map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) throw new Error("Select at least one record.");
  if (ids.length > max) throw new Error(`No more than ${max} records can be updated at once.`);
  return ids;
}

function parseBatchTextField(formData: FormData, name: string, label: string, max = 5000, options: { allowEmpty?: boolean } = {}) {
  const allowEmpty = options.allowEmpty ?? false;
  const value = formData.get(name);
  if (!allowEmpty && (value === null || String(value).trim() === "")) throw new Error(`${label} is required for this action.`);
  if (value === null) return "";
  const text = String(value).trim();
  if (!text) return "";
  if (text.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return text;
}

async function validateProjectIfProvided(tx: Prisma.TransactionClient, projectId: string | undefined) {
  if (!projectId) return null;
  const project = await tx.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new Error("The selected project no longer exists.");
  return project.id;
}

function parseCollectionForm(formData: FormData) {
  return collectionSchema.parse({
    id: optionalText(formData.get("id")),
    name: formData.get("name"),
    type: formData.get("type"),
    status: formData.get("status") ?? "draft",
    description: optionalText(formData.get("description")),
    projectId: optionalText(formData.get("projectId")),
    members: parseJsonArray(formData.get("membersJson"), "Collection member"),
  });
}

function ensureDistinctMembers(members: Array<{ sequenceVersionId: string; role: string }>) {
  const keys = members.map((member) => `${member.sequenceVersionId}:${member.role.toLowerCase()}`);
  if (new Set(keys).size !== keys.length) throw new Error("The same sequence version and role cannot be added twice.");
}

export async function createSequenceCollection(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  let id: string;
  try {
    const parsed = parseCollectionForm(formData);
    ensureDistinctMembers(parsed.members);
    const collection = await prisma.$transaction(async (tx) => {
      const code = await reserveRecordCode(tx, "sequenceCollection");
      const created = await tx.sequenceCollection.create({
        data: {
          code,
          name: parsed.name,
          type: parsed.type,
          status: parsed.status,
          description: parsed.description,
          projectId: parsed.projectId,
          members: { create: parsed.members.map((member, order) => ({ ...member, note: member.note || null, order })) },
        },
      });
      await tx.activityLog.create({ data: { action: "create", targetType: "sequence_collection", targetId: created.id, metadataJson: { code, type: parsed.type, memberCount: parsed.members.length } } });
      return created;
    });
    id = collection.id;
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Sequence Collection could not be created.") };
  }
  revalidatePath("/sequences/collections");
  redirect(`/sequences/collections/${id}`);
}

export async function updateSequenceCollection(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  let id: string;
  try {
    const parsed = parseCollectionForm(formData);
    if (!parsed.id) throw new Error("Sequence Collection ID is required.");
    id = parsed.id;
    ensureDistinctMembers(parsed.members);
    await prisma.$transaction(async (tx) => {
      const current = await tx.sequenceCollection.findUnique({ where: { id } });
      if (!current) throw new Error("This Sequence Collection no longer exists.");
      await tx.sequenceCollectionMember.deleteMany({ where: { collectionId: id } });
      await tx.sequenceCollection.update({
        where: { id },
        data: {
          name: parsed.name,
          type: parsed.type,
          status: parsed.status,
          description: parsed.description,
          projectId: parsed.projectId || null,
          members: { create: parsed.members.map((member, order) => ({ ...member, note: member.note || null, order })) },
        },
      });
      await tx.activityLog.create({ data: { action: "update", targetType: "sequence_collection", targetId: id, metadataJson: { type: parsed.type, memberCount: parsed.members.length } } });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Sequence Collection could not be saved.") };
  }
  revalidatePath("/sequences/collections");
  revalidatePath(`/sequences/collections/${id}`);
  redirect(`/sequences/collections/${id}`);
}

function parseDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) { cells.push(cell.trim()); cell = ""; }
    else cell += character;
  }
  cells.push(cell.trim());
  return cells;
}

function rowsFromMatrix(rows: unknown[][]) {
  const headerIndex = rows.findIndex((row) => row.some((cell) => String(cell ?? "").trim()));
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map((cell) => String(cell ?? "").trim());
  return rows.slice(headerIndex + 1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))).filter((row) => Object.values(row).some((value) => String(value).trim()));
}

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  return rowsFromMatrix(lines.map((line) => parseDelimitedLine(line, delimiter)));
}

function importField(record: Record<string, unknown>, key: string) {
  const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  const entry = Object.entries(record).find(([header]) => header.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedKey);
  const text = String(entry?.[1] ?? "").trim();
  return text || undefined;
}

function jsonImportArray(record: Record<string, unknown>, key: string) {
  const text = importField(record, key);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error(`${key} must be a JSON array.`);
  }
}

export async function importSequences(_previousState: SequenceManageState, formData: FormData): Promise<SequenceManageState> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || !file.name || !file.size) throw new Error("Choose a non-empty FASTA, CSV, TSV, or XLSX file.");
    if (file.size > 25 * 1024 * 1024) throw new Error("Sequence import files must be 25 MB or smaller.");
    const extension = file.name.toLowerCase().split(".").pop();
    const defaultDesignType = z.enum(designTypes).parse(formData.get("defaultDesignType") ?? "other");
    const defaultMoleculeType = z.enum(moleculeTypes).parse(formData.get("defaultMoleculeType") ?? "DNA");
    const buffer = Buffer.from(await file.arrayBuffer());
    let rows: Record<string, unknown>[];
    let sourceType: "fasta_import" | "csv_import" | "xlsx_import";
    if (["fa", "fasta", "fna", "faa"].includes(extension ?? "")) {
      sourceType = "fasta_import";
      rows = parseFasta(buffer.toString("utf8")).map((record) => ({ name: record.name, description: record.description, sequence: record.sequence }));
    } else if (["csv", "tsv"].includes(extension ?? "")) {
      sourceType = "csv_import";
      rows = parseCsv(buffer.toString("utf8"));
    } else if (extension === "xlsx") {
      sourceType = "xlsx_import";
      rows = rowsFromMatrix(await readSheet(buffer, { trim: true }) as unknown[][]);
    } else throw new Error("Supported formats are FASTA, CSV, TSV, and XLSX.");
    if (!rows.length) throw new Error("No sequence records were found in this file.");
    if (rows.length > 500) throw new Error("A single import is limited to 500 sequences.");

    const prepared = rows.map((record, index) => {
      try {
        const moleculeType = (importField(record, "moleculeType") ?? defaultMoleculeType) as MoleculeType;
        const designType = importField(record, "designType") ?? defaultDesignType;
        return prepareSequenceInput({
          name: importField(record, "name") ?? `Imported sequence ${index + 1}`,
          designType,
          status: importField(record, "status") ?? "draft",
          description: importField(record, "description"),
          projectId: undefined,
          targetName: importField(record, "targetName"),
          organism: importField(record, "organism"),
          moleculeType,
          sequence: importField(record, "sequence") ?? "",
          topology: importField(record, "topology") ?? (designType === "plasmid" ? "circular" : "linear"),
          strandedness: importField(record, "strandedness") ?? "unknown",
          displayVersion: importField(record, "displayVersion") ?? "1.0",
          validationStatus: importField(record, "validationStatus") ?? "unverified",
          validationSummary: importField(record, "validationSummary"),
          changeSummary: "Initial version created by structured import",
          features: jsonImportArray(record, "featuresJson"),
          modifications: jsonImportArray(record, "modificationsJson"),
          metadata: {},
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid sequence record.";
        throw new Error(`Row ${index + 1}: ${message}`);
      }
    });

    await prisma.$transaction(async (tx) => {
      for (const input of prepared) await createSequenceInTransaction(tx, input, { type: sourceType, fileName: file.name });
    });
    revalidatePath("/sequences");
    return { success: `${prepared.length} sequence${prepared.length === 1 ? "" : "s"} imported.` };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Sequence import could not be completed.") };
  }
}

export async function bulkUpdateSequences(_previousState: BulkActionState, formData: FormData): Promise<BulkActionState> {
  try {
    const intent = sequenceBatchIntentSchema.parse(formData.get("intent"));
    const ids = parseBulkIds(formData);
    await prisma.$transaction(async (tx) => {
      const existing = await tx.sequence.count({ where: { id: { in: ids } } });
      if (existing !== ids.length) throw new Error("Some selected Sequence records could not be found.");
      if (intent === "delete") {
        await tx.sequence.deleteMany({ where: { id: { in: ids } } });
        await tx.activityLog.create({
          data: {
            action: "delete",
            targetType: "sequence",
            targetId: ids[0],
            metadataJson: { batchCount: ids.length, intent, ids },
          },
        });
        revalidatePath("/sequences");
        revalidatePath("/entities");
        revalidatePath("/sequences/collections");
        return;
      }
      if (intent === "set_project") {
        const projectId = optionalText(formData.get("projectId"));
        const normalizedProjectId = await validateProjectIfProvided(tx, projectId);
        await tx.sequence.updateMany({ where: { id: { in: ids } }, data: { projectId: normalizedProjectId } });
        await tx.activityLog.create({
          data: {
            action: "update",
            targetType: "sequence",
            targetId: ids[0],
            metadataJson: { batchCount: ids.length, intent, projectId: normalizedProjectId ?? "shared" },
          },
        });
        revalidatePath("/sequences");
        return;
      }
      if (intent === "set_description") {
        const description = parseBatchTextField(formData, "description", "Description", 5000, { allowEmpty: true });
        await tx.sequence.updateMany({ where: { id: { in: ids } }, data: { description: description || null } });
        await tx.activityLog.create({
          data: {
            action: "update",
            targetType: "sequence",
            targetId: ids[0],
            metadataJson: { batchCount: ids.length, intent },
          },
        });
        revalidatePath("/sequences");
        return;
      }
      if (intent === "set_type") {
        const designType = z.enum(designTypes).parse(formData.get("type"));
        await tx.sequence.updateMany({ where: { id: { in: ids } }, data: { designType } });
        await tx.activityLog.create({
          data: {
            action: "update",
            targetType: "sequence",
            targetId: ids[0],
            metadataJson: { batchCount: ids.length, intent, designType },
          },
        });
        revalidatePath("/sequences");
      }
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The batch action could not be completed.") };
  }
  revalidatePath("/sequences");
  redirect("/sequences");
}

export async function bulkUpdateSequenceCollections(_previousState: BulkActionState, formData: FormData): Promise<BulkActionState> {
  try {
    const intent = sequenceCollectionBatchIntentSchema.parse(formData.get("intent"));
    const ids = parseBulkIds(formData);
    await prisma.$transaction(async (tx) => {
      const existing = await tx.sequenceCollection.count({ where: { id: { in: ids } } });
      if (existing !== ids.length) throw new Error("Some selected Sequence Collection records could not be found.");
      if (intent === "delete") {
        await tx.sequenceCollection.deleteMany({ where: { id: { in: ids } } });
        await tx.activityLog.create({
          data: {
            action: "delete",
            targetType: "sequence_collection",
            targetId: ids[0],
            metadataJson: { batchCount: ids.length, intent, ids },
          },
        });
        revalidatePath("/sequences/collections");
        return;
      }
      if (intent === "set_project") {
        const projectId = optionalText(formData.get("projectId"));
        const normalizedProjectId = await validateProjectIfProvided(tx, projectId);
        await tx.sequenceCollection.updateMany({ where: { id: { in: ids } }, data: { projectId: normalizedProjectId } });
        await tx.activityLog.create({
          data: {
            action: "update",
            targetType: "sequence_collection",
            targetId: ids[0],
            metadataJson: { batchCount: ids.length, intent, projectId: normalizedProjectId ?? "shared" },
          },
        });
        revalidatePath("/sequences/collections");
        return;
      }
      if (intent === "set_description") {
        const description = parseBatchTextField(formData, "description", "Description", 5000, { allowEmpty: true });
        await tx.sequenceCollection.updateMany({ where: { id: { in: ids } }, data: { description: description || null } });
        await tx.activityLog.create({
          data: {
            action: "update",
            targetType: "sequence_collection",
            targetId: ids[0],
            metadataJson: { batchCount: ids.length, intent },
          },
        });
        revalidatePath("/sequences/collections");
        return;
      }
      if (intent === "set_type") {
        const type = z.enum(collectionTypes).parse(formData.get("type"));
        await tx.sequenceCollection.updateMany({ where: { id: { in: ids } }, data: { type } });
        await tx.activityLog.create({
          data: {
            action: "update",
            targetType: "sequence_collection",
            targetId: ids[0],
            metadataJson: { batchCount: ids.length, intent, type },
          },
        });
        revalidatePath("/sequences/collections");
      }
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The batch action could not be completed.") };
  }
  revalidatePath("/sequences/collections");
  redirect("/sequences/collections");
}
