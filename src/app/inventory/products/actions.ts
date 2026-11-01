"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { keepAttachment } from "@/lib/attachment-files";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";
import { deleteBlockers, isStrictlyControlled, productDocumentKinds } from "@/lib/inventory";
import { mergeProductPlan, pairKey } from "@/lib/inventory-duplicates";
import { manualFileProblem } from "@/lib/inventory-manuals";
import { saveProductForm } from "@/lib/inventory-product-form.server";
import { deleteProduct, syncProductLots } from "@/lib/inventory-products.server";

const text = (value: FormDataEntryValue | null) => String(value ?? "").trim() || undefined;

function revalidateProduct(id?: string) {
  revalidatePath("/inventory");
  revalidatePath("/inventory/products");
  if (id) revalidatePath(`/inventory/products/${id}`);
}

export async function createInventoryProduct(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  let id: string;
  try {
    id = await prisma.$transaction((tx) => saveProductForm(tx, formData));
  } catch (error) {
    return { error: formActionErrorMessage(error, "The product could not be created.") };
  }
  revalidateProduct(id);
  redirect(`/inventory/products/${id}`);
}

export async function updateInventoryProduct(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  let id: string;
  try {
    if (!text(formData.get("id"))) throw new Error("Product ID is required.");
    id = await prisma.$transaction((tx) => saveProductForm(tx, formData));
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
