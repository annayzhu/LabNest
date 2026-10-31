"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";
import { deleteBlockers } from "@/lib/inventory";
import { syncProductLots } from "@/lib/inventory-products.server";
import { inventoryGroupKeys, inventoryTypeFields, type InventoryTypeField } from "@/lib/inventory-types";

type Tx = Prisma.TransactionClient;

const text = (value: FormDataEntryValue | null) => String(value ?? "").trim() || undefined;

function revalidateTypes() {
  for (const path of ["/inventory", "/inventory/types", "/inventory/products", "/inventory/new"]) revalidatePath(path);
}

/** A 大类 can be renamed (empty restores the built-in name) or hidden; it is never added or removed. */
export async function saveInventoryGroup(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const key = z.enum(inventoryGroupKeys).parse(formData.get("key"));
    const label = z.string().trim().max(60).parse(formData.get("label") ?? "") || null;
    const hidden = formData.get("hidden") === "true";
    await prisma.$transaction([
      prisma.inventoryGroup.update({ where: { key }, data: { label, hidden } }),
      prisma.activityLog.create({ data: { action: "update", targetType: "inventory_group", targetId: key, metadataJson: { label, hidden } } }),
    ]);
    revalidateTypes();
    return { success: hidden ? "Hidden from new products." : "Saved." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The 大类 could not be saved.") };
  }
}

const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/** Field keys stay as they are (product values are stored under them); a new field gets one from its label. */
function keyedFields(raw: unknown): InventoryTypeField[] {
  const entries = Array.isArray(raw) ? raw : [];
  const used = new Set<string>();
  const fields = inventoryTypeFields(entries.map((entry, index) => {
    const field = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const label = typeof field.label === "string" ? field.label.trim() : "";
    let key = typeof field.key === "string" && field.key.trim() ? field.key.trim() : slug(label) || `field_${index + 1}`;
    while (used.has(key)) key = `${key}_${index + 1}`;
    used.add(key);
    return { ...field, key, label };
  }));
  if (fields.length !== entries.length) throw new Error("Every field needs a name.");
  if (fields.some((field) => field.kind === "choice" && !field.options?.length)) throw new Error("A choice field needs at least one option.");
  return fields;
}

const typeSchema = z.object({
  id: z.string().trim().optional(),
  label: z.string().trim().min(1, "Type name is required.").max(60),
  groupKey: z.enum(inventoryGroupKeys, { message: "Choose the 大类 this type belongs to." }),
  managementMode: z.enum(["information", "package", "precise"]),
  unit: z.string().trim().max(32),
  tracksLot: z.boolean(),
  tracksExpiry: z.boolean(),
});

async function uniqueTypeKey(tx: Tx, label: string) {
  const base = slug(label) || "type";
  for (let suffix = 1; ; suffix += 1) {
    const key = suffix === 1 ? base : `${base}_${suffix}`;
    if (!await tx.scientificSchemaDefinition.findUnique({ where: { key }, select: { id: true } })) return key;
  }
}

/** Types are created and edited here only; product and stock forms just choose one. */
export async function saveInventoryType(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const parsed = typeSchema.parse({
      id: text(formData.get("id")),
      label: formData.get("label"),
      groupKey: formData.get("groupKey"),
      managementMode: formData.get("managementMode") ?? "information",
      unit: formData.get("unit") ?? "",
      tracksLot: formData.get("tracksLot") === "on" || formData.get("tracksLot") === "true",
      tracksExpiry: formData.get("tracksExpiry") === "on" || formData.get("tracksExpiry") === "true",
    });
    const fields = keyedFields(JSON.parse(String(formData.get("fields") || "[]")));
    const inventory = { managementMode: parsed.managementMode, unit: parsed.unit, tracksLot: parsed.tracksLot, tracksExpiry: parsed.tracksExpiry };
    await prisma.$transaction(async (tx) => {
      const duplicate = await tx.scientificSchemaDefinition.findFirst({ where: { label: { equals: parsed.label, mode: "insensitive" }, inventoryGroupKey: { not: null }, ...(parsed.id ? { id: { not: parsed.id } } : {}) }, select: { id: true } });
      if (duplicate) throw new Error(`A type named “${parsed.label}” already exists.`);
      if (parsed.id) {
        const current = await tx.scientificSchemaDefinition.findUnique({ where: { id: parsed.id } });
        if (!current?.inventoryGroupKey) throw new Error("This type is no longer in inventory.");
        const settings = (current.defaultSettings && typeof current.defaultSettings === "object" ? current.defaultSettings : {}) as Record<string, unknown>;
        await tx.scientificSchemaDefinition.update({ where: { id: parsed.id }, data: { label: parsed.label, inventoryGroupKey: parsed.groupKey, fieldDefinitions: fields, defaultSettings: { ...settings, inventory } } });
        // Lots copy their product's type, not its 大类, so moving the type's products leaves the lots as they are.
        if (current.inventoryGroupKey !== parsed.groupKey) await tx.inventoryProduct.updateMany({ where: { typeId: parsed.id }, data: { groupKey: parsed.groupKey } });
        await tx.activityLog.create({ data: { action: "update", targetType: "inventory_type", targetId: parsed.id, metadataJson: { label: parsed.label, groupKey: parsed.groupKey, fields: fields.length, inventory } } });
      } else {
        const type = await tx.scientificSchemaDefinition.create({ data: { key: await uniqueTypeKey(tx, parsed.label), label: parsed.label, objectKind: "inventory", inventoryGroupKey: parsed.groupKey, fieldDefinitions: fields, defaultSettings: { inventory } } });
        await tx.activityLog.create({ data: { action: "create", targetType: "inventory_type", targetId: type.id, metadataJson: { label: type.label, groupKey: parsed.groupKey } } });
      }
    });
    revalidateTypes();
    return { success: parsed.id ? "Type saved." : "Type created." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The type could not be saved.") };
  }
}

const idOf = (formData: FormData) => z.string().trim().min(1, "Type ID is required.").parse(formData.get("id"));

async function inventoryType(tx: Tx, id: string) {
  const type = await tx.scientificSchemaDefinition.findUnique({ where: { id } });
  if (!type?.inventoryGroupKey) throw new Error("This type is no longer in inventory.");
  return type;
}

/** A disabled type is no longer offered for new products; products keep it. It is shared with the sequence library when it has an entity type. */
export async function setInventoryTypeEnabled(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const id = idOf(formData);
    const enabled = formData.get("enabled") === "true";
    await prisma.$transaction(async (tx) => {
      await inventoryType(tx, id);
      await tx.scientificSchemaDefinition.update({ where: { id }, data: { enabled } });
      await tx.activityLog.create({ data: { action: enabled ? "enable" : "disable", targetType: "inventory_type", targetId: id, metadataJson: {} } });
    });
    revalidateTypes();
    return { success: enabled ? "Type enabled." : "Type disabled; its products keep it." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The type could not be changed.") };
  }
}

/** Leaves inventory: an inventory-only type is deleted, a sequence-library type stays for the library. */
async function removeFromInventory(tx: Tx, type: { id: string; entityType: string | null }) {
  if (type.entityType) await tx.scientificSchemaDefinition.update({ where: { id: type.id }, data: { inventoryGroupKey: null } });
  else await tx.scientificSchemaDefinition.delete({ where: { id: type.id } });
}

/** One type's products move to another (with its 大类), and the merged type leaves inventory. */
export async function mergeInventoryType(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const id = idOf(formData);
    const targetId = z.string().trim().min(1, "Choose the type to merge into.").parse(formData.get("targetId"));
    if (id === targetId) throw new Error("Choose a different type to merge into.");
    let moved = 0;
    await prisma.$transaction(async (tx) => {
      const source = await inventoryType(tx, id);
      const target = await inventoryType(tx, targetId);
      if (!target.enabled) throw new Error("Merge into a type that is in use.");
      const products = await tx.inventoryProduct.findMany({ where: { typeId: id }, select: { id: true } });
      await tx.inventoryProduct.updateMany({ where: { typeId: id }, data: { typeId: target.id, groupKey: target.inventoryGroupKey } });
      for (const product of products) await syncProductLots(tx, product.id);
      moved = products.length;
      await removeFromInventory(tx, source);
      await tx.activityLog.create({ data: { action: "merge", targetType: "inventory_type", targetId: target.id, metadataJson: { mergedTypeId: source.id, mergedLabel: source.label, products: moved } } });
    });
    revalidateTypes();
    return { success: `Merged; ${moved} product${moved === 1 ? "" : "s"} moved.` };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The types could not be merged.") };
  }
}

export async function deleteInventoryType(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const id = idOf(formData);
    await prisma.$transaction(async (tx) => {
      const type = await inventoryType(tx, id);
      const blockers = deleteBlockers({ products: await tx.inventoryProduct.count({ where: { typeId: id } }) });
      if (blockers.length) throw new Error(`This type has ${blockers.join(", ")}, so it cannot be deleted. Merge it into another type instead.`);
      await removeFromInventory(tx, type);
      await tx.activityLog.create({ data: { action: "delete", targetType: "inventory_type", targetId: id, metadataJson: { label: type.label, keptForSequenceLibrary: !!type.entityType } } });
    });
    revalidateTypes();
    return { success: "Type deleted." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The type could not be deleted.") };
  }
}
