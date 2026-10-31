"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { keepAttachment } from "@/lib/attachment-files";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";
import { deleteBlockers, inventoryControlKeys, isStrictlyControlled, productDocumentKinds } from "@/lib/inventory";
import { mergeProductPlan, pairKey } from "@/lib/inventory-duplicates";
import { manualFileProblem } from "@/lib/inventory-manuals";
import { deleteProduct, productWithCatalog, syncProductLots } from "@/lib/inventory-products.server";
import { inventoryTypeFields, isInventoryGroupKey, type InventoryTypeField } from "@/lib/inventory-types";

type Tx = Prisma.TransactionClient;

const text = (value: FormDataEntryValue | null) => String(value ?? "").trim() || undefined;
const number = (value: FormDataEntryValue | null) => (text(value) === undefined ? undefined : Number(text(value)));

const productSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, "Product name is required.").max(180),
  englishName: z.string().trim().max(180).optional(),
  brand: z.string().trim().max(120).optional(),
  catalogNumber: z.string().trim().max(120).optional(),
  casNumber: z.string().trim().max(64).optional(),
  typeId: z.string().trim().optional(),
  groupKey: z.string().trim().optional(),
  entityId: z.string().trim().optional(),
  lowThreshold: z.number().finite().nonnegative().optional(),
  lowThresholdUnit: z.string().trim().max(32).optional(),
  notes: z.string().trim().max(5000).optional(),
  controlLevels: z.array(z.string().refine((key) => inventoryControlKeys.includes(key), "Unknown control level.")),
});

function parseProduct(formData: FormData) {
  return productSchema.parse({
    id: text(formData.get("id")),
    name: formData.get("name"),
    englishName: text(formData.get("englishName")),
    brand: text(formData.get("brand")),
    catalogNumber: text(formData.get("catalogNumber")),
    casNumber: text(formData.get("casNumber")),
    typeId: text(formData.get("typeId")),
    groupKey: text(formData.get("groupKey")),
    entityId: text(formData.get("entityId")),
    lowThreshold: number(formData.get("lowThreshold")),
    lowThresholdUnit: text(formData.get("lowThresholdUnit")),
    notes: text(formData.get("notes")),
    controlLevels: [...new Set([...formData.getAll("controlLevel"), formData.get("biosafety")].map(text).filter((key): key is string => !!key))],
  });
}

/** Values of the type's fields (`field:<key>`); a number, date or choice must read as one. Fields of other types are not kept. */
function fieldValues(formData: FormData, fields: InventoryTypeField[]) {
  const values: Record<string, string> = {};
  for (const field of fields) {
    const value = text(formData.get(`field:${field.key}`));
    if (value === undefined) continue;
    if (field.kind === "number" && !Number.isFinite(Number(value))) throw new Error(`${field.label} must be a number.`);
    if (field.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field.label} must be a date.`);
    if (field.kind === "choice" && field.options && !field.options.includes(value)) throw new Error(`Choose one of the options for ${field.label}.`);
    values[field.key] = value;
  }
  return values;
}

/** The type decides the 大类; without one, the chosen 大类 (or none: 待归类). A disabled type stays only where it already is. */
async function classify(tx: Tx, parsed: z.infer<typeof productSchema>, currentTypeId?: string | null) {
  if (!parsed.typeId) return { typeId: null, groupKey: parsed.groupKey && isInventoryGroupKey(parsed.groupKey) ? parsed.groupKey : null, fields: [] as InventoryTypeField[] };
  const type = await tx.scientificSchemaDefinition.findUnique({ where: { id: parsed.typeId } });
  if (!type?.inventoryGroupKey || (!type.enabled && type.id !== currentTypeId)) throw new Error("Choose an inventory type that is in use.");
  return { typeId: type.id, groupKey: type.inventoryGroupKey, fields: inventoryTypeFields(type.fieldDefinitions) };
}

async function assertNoDuplicate(tx: Tx, parsed: z.infer<typeof productSchema>) {
  const duplicate = await productWithCatalog(tx, { brand: parsed.brand ?? null, catalogNumber: parsed.catalogNumber ?? null }, { excludeId: parsed.id });
  if (duplicate) throw new Error(`“${duplicate.name}” already has this brand and catalogue number.`);
}

/** Highly toxic and drug-precursor stock is only recorded precisely. */
async function assertControlFits(tx: Tx, productId: string, levels: string[]) {
  if (!isStrictlyControlled(levels)) return;
  const loose = await tx.inventoryItem.count({ where: { productId, managementMode: { not: "precise" } } });
  if (loose) throw new Error(`Highly toxic and drug-precursor stock must be recorded with precise use; switch ${loose} lot${loose === 1 ? "" : "s"} to precise use first.`);
}

function productData(parsed: z.infer<typeof productSchema>, classified: Awaited<ReturnType<typeof classify>>, values: Record<string, string>) {
  if (parsed.lowThreshold !== undefined && !parsed.lowThresholdUnit) throw new Error("Choose the unit of the safety stock.");
  return {
    name: parsed.name,
    englishName: parsed.englishName ?? null,
    brand: parsed.brand ?? null,
    catalogNumber: parsed.catalogNumber ?? null,
    casNumber: parsed.casNumber ?? null,
    entityId: parsed.entityId ?? null,
    typeId: classified.typeId,
    groupKey: classified.groupKey,
    fieldValues: values,
    controlLevels: parsed.controlLevels,
    lowThreshold: parsed.lowThreshold ?? null,
    lowThresholdUnit: parsed.lowThreshold === undefined ? null : parsed.lowThresholdUnit,
    notes: parsed.notes ?? null,
  };
}

function revalidateProduct(id?: string) {
  revalidatePath("/inventory");
  revalidatePath("/inventory/products");
  if (id) revalidatePath(`/inventory/products/${id}`);
}

export async function createInventoryProduct(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  let id: string;
  try {
    const parsed = parseProduct(formData);
    id = await prisma.$transaction(async (tx) => {
      const classified = await classify(tx, parsed);
      await assertNoDuplicate(tx, parsed);
      const product = await tx.inventoryProduct.create({ data: productData(parsed, classified, fieldValues(formData, classified.fields)) });
      await tx.activityLog.create({ data: { action: "create", targetType: "inventory_product", targetId: product.id, metadataJson: { name: product.name, typeId: product.typeId, groupKey: product.groupKey } } });
      return product.id;
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The product could not be created.") };
  }
  revalidateProduct(id);
  redirect(`/inventory/products/${id}`);
}

export async function updateInventoryProduct(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  let id: string;
  try {
    const parsed = parseProduct(formData);
    if (!parsed.id) throw new Error("Product ID is required.");
    id = parsed.id;
    await prisma.$transaction(async (tx) => {
      const current = await tx.inventoryProduct.findUnique({ where: { id } });
      if (!current) throw new Error("This product no longer exists.");
      const classified = await classify(tx, parsed, current.typeId);
      await assertNoDuplicate(tx, parsed);
      await assertControlFits(tx, id, parsed.controlLevels);
      await tx.inventoryProduct.update({ where: { id }, data: productData(parsed, classified, fieldValues(formData, classified.fields)) });
      await syncProductLots(tx, id);
      await tx.activityLog.create({ data: { action: "update", targetType: "inventory_product", targetId: id, metadataJson: { previous: { name: current.name, typeId: current.typeId, groupKey: current.groupKey, controlLevels: current.controlLevels }, next: { name: parsed.name, typeId: classified.typeId, groupKey: classified.groupKey, controlLevels: parsed.controlLevels } } } });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The product could not be saved.") };
  }
  revalidateProduct(id);
  redirect(`/inventory/products/${id}`);
}

const idOf = (formData: FormData) => z.string().trim().min(1, "Product ID is required.").parse(formData.get("id"));

export async function setInventoryProductArchived(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const id = idOf(formData);
    const archived = formData.get("archived") === "true";
    await prisma.$transaction(async (tx) => {
      const product = await tx.inventoryProduct.findUnique({ where: { id } });
      if (!product) throw new Error("This product no longer exists.");
      await tx.inventoryProduct.update({ where: { id }, data: { status: archived ? "archived" : "active" } });
      await tx.activityLog.create({ data: { action: archived ? "archive" : "restore", targetType: "inventory_product", targetId: id, metadataJson: { name: product.name } } });
    });
    revalidateProduct(id);
    return { success: archived ? "Product archived. Its lots keep their records." : "Product restored." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The product could not be changed.") };
  }
}

export async function deleteInventoryProduct(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const id = idOf(formData);
    const confirmation = String(formData.get("confirmation") ?? "").trim();
    await prisma.$transaction(async (tx) => {
      const product = await tx.inventoryProduct.findUnique({ where: { id } });
      if (!product) throw new Error("This product no longer exists.");
      if (confirmation !== product.name) throw new Error(`Enter ${product.name} exactly to confirm permanent deletion.`);
      const blockers = deleteBlockers({ lots: await tx.inventoryItem.count({ where: { productId: id } }) });
      if (blockers.length) throw new Error(`This product has ${blockers.join(", ")}, so it cannot be deleted. Archive it, or move its lots to another product first.`);
      await deleteProduct(tx, id);
      await tx.activityLog.create({ data: { action: "delete", targetType: "inventory_product", targetId: id, metadataJson: { name: product.name, brand: product.brand, catalogNumber: product.catalogNumber } } });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The product could not be deleted.") };
  }
  revalidateProduct();
  redirect("/inventory/products");
}

// Kit components: the list every box of the kit should contain.

const componentSchema = z.object({
  productId: z.string().trim().min(1),
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, "Component name is required.").max(160),
  spec: z.string().trim().max(120).optional(),
  storageCondition: z.string().trim().max(120).optional(),
});

export async function saveKitComponent(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const parsed = componentSchema.parse({ productId: formData.get("productId"), id: text(formData.get("id")), name: formData.get("name"), spec: text(formData.get("spec")), storageCondition: text(formData.get("storageCondition")) });
    const data = { name: parsed.name, spec: parsed.spec ?? null, storageCondition: parsed.storageCondition ?? null };
    await prisma.$transaction(async (tx) => {
      if (parsed.id) {
        const updated = await tx.inventoryKitComponent.updateMany({ where: { id: parsed.id, productId: parsed.productId }, data });
        if (updated.count !== 1) throw new Error("This component no longer exists.");
      } else {
        const last = await tx.inventoryKitComponent.findFirst({ where: { productId: parsed.productId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
        await tx.inventoryKitComponent.create({ data: { ...data, productId: parsed.productId, sortOrder: (last?.sortOrder ?? 0) + 1 } });
      }
      await tx.activityLog.create({ data: { action: parsed.id ? "update_kit_component" : "add_kit_component", targetType: "inventory_product", targetId: parsed.productId, metadataJson: data } });
    });
    revalidateProduct(parsed.productId);
    return { success: parsed.id ? "Component saved." : "Component added." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The component could not be saved.") };
  }
}

export async function deleteKitComponent(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const productId = z.string().trim().min(1).parse(formData.get("productId"));
    const id = z.string().trim().min(1).parse(formData.get("id"));
    await prisma.$transaction(async (tx) => {
      const component = await tx.inventoryKitComponent.findFirst({ where: { id, productId } });
      if (!component) throw new Error("This component no longer exists.");
      await tx.inventoryKitComponent.delete({ where: { id } });
      await tx.activityLog.create({ data: { action: "delete_kit_component", targetType: "inventory_product", targetId: productId, metadataJson: { name: component.name } } });
    });
    revalidateProduct(productId);
    return { success: "Component removed." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The component could not be removed.") };
  }
}

// Documents: manuals, SDS and kit manuals kept on the product, seen by every lot.

const documentKind = z.enum(productDocumentKinds);

export async function addProductDocument(productId: string, _previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) throw new Error("Choose the document file.");
    const problem = manualFileProblem(file);
    if (problem) throw new Error(problem);
    const kind = documentKind.parse(formData.get("kind") ?? "product_manual");
    if (!await prisma.inventoryProduct.findUnique({ where: { id: productId }, select: { id: true } })) throw new Error("This product no longer exists.");
    const attachmentId = await keepAttachment(file, { targetType: "inventory_product", targetId: productId, linkType: kind });
    await prisma.activityLog.create({ data: { action: "inventory_document_added", targetType: "inventory_product", targetId: productId, metadataJson: { attachmentId, filename: file.name, kind } } });
    revalidateProduct(productId);
    return { success: "Document added." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The document was not added.") };
  }
}

export async function setProductDocumentKind(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const linkId = z.string().trim().min(1).parse(formData.get("linkId"));
    const kind = documentKind.parse(formData.get("kind"));
    const link = await prisma.attachmentLink.findFirst({ where: { id: linkId, targetType: "inventory_product" } });
    if (!link) throw new Error("This document is no longer on the product.");
    await prisma.$transaction([
      prisma.attachmentLink.update({ where: { id: linkId }, data: { linkType: kind } }),
      prisma.activityLog.create({ data: { action: "inventory_document_kind", targetType: "inventory_product", targetId: link.targetId, metadataJson: { attachmentId: link.attachmentId, previous: link.linkType, next: kind } } }),
    ]);
    revalidateProduct(link.targetId);
    return { success: "Document kind saved." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The document kind was not saved.") };
  }
}

// Duplicates: merging one product into another, and pairs someone checked and found to be different.

const mergeChoice = z.enum(["keep", "other"]).optional();

/**
 * Merges a duplicate product into the one kept: its lots, documents (except copies of files the kept product already
 * has), kit components and control levels move over, its other values fill the kept product's gaps, and it is removed.
 */
export async function mergeInventoryProducts(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  let keepId: string;
  try {
    keepId = z.string().trim().min(1, "Product ID is required.").parse(formData.get("keepId"));
    const otherId = z.string().trim().min(1, "Choose the product to merge into this one.").parse(formData.get("otherId") ?? "");
    if (keepId === otherId) throw new Error("Choose two different products.");
    const safetyStock = mergeChoice.parse(text(formData.get("safetyStock")));
    await prisma.$transaction(async (tx) => {
      const keep = await tx.inventoryProduct.findUnique({ where: { id: keepId } });
      const other = await tx.inventoryProduct.findUnique({ where: { id: otherId } });
      if (!keep || !other) throw new Error("One of these products no longer exists.");
      const plan = mergeProductPlan(keep, other, safetyStock);
      if (plan.needsSafetyStockChoice) throw new Error("Choose which safety stock to keep.");
      if (isStrictlyControlled(plan.data.controlLevels)) {
        const loose = await tx.inventoryItem.count({ where: { productId: { in: [keep.id, other.id] }, managementMode: { not: "precise" } } });
        if (loose) throw new Error(`Highly toxic and drug-precursor stock must be recorded with precise use; switch ${loose} lot${loose === 1 ? "" : "s"} to precise use first.`);
      }
      const lots = await tx.inventoryItem.updateMany({ where: { productId: other.id }, data: { productId: keep.id } });
      const linkKey = (link: { attachmentId: string; linkType: string }) => `${link.attachmentId}|${link.linkType}`;
      const kept = new Set((await tx.attachmentLink.findMany({ where: { targetType: "inventory_product", targetId: keep.id }, select: { attachmentId: true, linkType: true } })).map(linkKey));
      const twins = (await tx.attachmentLink.findMany({ where: { targetType: "inventory_product", targetId: other.id }, select: { id: true, attachmentId: true, linkType: true } })).filter((link) => kept.has(linkKey(link)));
      await tx.attachmentLink.deleteMany({ where: { id: { in: twins.map((link) => link.id) } } });
      const documents = await tx.attachmentLink.updateMany({ where: { targetType: "inventory_product", targetId: other.id }, data: { targetId: keep.id } });
      const last = await tx.inventoryKitComponent.findFirst({ where: { productId: keep.id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
      const components = await tx.inventoryKitComponent.updateMany({ where: { productId: other.id }, data: { productId: keep.id, sortOrder: { increment: last?.sortOrder ?? 0 } } });
      await tx.inventoryDuplicateDismissal.deleteMany({ where: { OR: [{ firstId: other.id }, { secondId: other.id }] } });
      await tx.inventoryProduct.delete({ where: { id: other.id } });
      await tx.inventoryProduct.update({ where: { id: keep.id }, data: plan.data });
      await syncProductLots(tx, keep.id);
      await tx.activityLog.create({ data: { action: "merge", targetType: "inventory_product", targetId: keep.id, metadataJson: { mergedId: other.id, mergedName: other.name, lots: lots.count, documents: documents.count, components: components.count, safetyStock: safetyStock ?? null } } });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The products could not be merged.") };
  }
  revalidateProduct(keepId);
  redirect(`/inventory/products/${keepId}`);
}

/** Marks every pair among these products or lots as not duplicates, so the duplicate check stops listing them. */
export async function setNotDuplicate(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const ids = [...new Set(formData.getAll("id").map((value) => String(value).trim()).filter(Boolean))];
    if (ids.length < 2) throw new Error("Choose at least two records.");
    const pairs = ids.flatMap((first, index) => ids.slice(index + 1).map((second) => {
      const [firstId, secondId] = pairKey(first, second).split("|");
      return { firstId, secondId };
    }));
    await prisma.$transaction([
      prisma.inventoryDuplicateDismissal.createMany({ data: pairs, skipDuplicates: true }),
      prisma.activityLog.create({ data: { action: "not_duplicate", targetType: "inventory_duplicates", targetId: [...ids].sort().join("|"), metadataJson: { ids } } }),
    ]);
    revalidatePath("/inventory/products");
    revalidatePath("/inventory/products/duplicates");
    return { success: "Marked as not duplicates." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The records could not be marked.") };
  }
}
