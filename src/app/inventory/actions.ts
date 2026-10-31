"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";
import { controlledUseProblem, isStrictlyControlled, movementReversalProblem } from "@/lib/inventory";
import { deleteStockItem, linkInventoryProduct, lotIdentity, stockItemBlockers } from "@/lib/inventory-products.server";

type Tx = Prisma.TransactionClient;

const optionalText = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text || undefined;
};

const optionalNumber = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text === "" ? undefined : Number(text);
};

const optionalDate = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text === "" ? undefined : new Date(`${text}T00:00:00.000Z`);
};

/** A lot of a product: name, brand, catalogue and CAS come from the product; everything here belongs to this stock. */
const inventoryItemSchema = z.object({
  principalInvestigator: z.string().trim().max(120).optional(),
  vendor: z.string().trim().max(180).optional(),
  lotNumber: z.string().trim().max(120).optional(),
  containerType: z.string().trim().max(80).optional(),
  barcode: z.string().trim().max(160).optional(),
  aliquotCode: z.string().trim().max(160).optional(),
  currentQuantity: z.number().finite().nonnegative(),
  managementMode: z.enum(["information", "package", "precise"]).default("precise"),
  quantityRecorded: z.boolean().default(true),
  unit: z.string().trim().min(1, "Unit is required.").max(32),
  concentration: z.string().trim().max(120).optional(),
  locationId: z.string().trim().optional(),
  positionCode: z.string().trim().max(120).optional(),
  expiryDate: z.date().optional(),
  storageCondition: z.string().trim().max(240).optional(),
  notes: z.string().trim().max(5000).optional(),
});

/** A product registered together with its first stock; the same brand + catalogue number links to the existing product. */
const newProductSchema = z.object({
  name: z.string().trim().min(1, "Choose a product or enter the new product's name.").max(180),
  brand: z.string().trim().max(120).optional(),
  catalogNumber: z.string().trim().max(120).optional(),
  typeId: z.string().trim().optional(),
  groupKey: z.string().trim().optional(),
});

function parseInventoryItem(formData: FormData) {
  return inventoryItemSchema.parse({
    principalInvestigator: optionalText(formData.get("principalInvestigator")),
    vendor: optionalText(formData.get("vendor")),
    lotNumber: optionalText(formData.get("lotNumber")),
    containerType: optionalText(formData.get("containerType")),
    barcode: optionalText(formData.get("barcode")),
    aliquotCode: optionalText(formData.get("aliquotCode")),
    currentQuantity: formData.get("managementMode") === "information" && !optionalText(formData.get("currentQuantity")) ? 0 : optionalNumber(formData.get("currentQuantity")),
    managementMode: optionalText(formData.get("managementMode")) ?? "precise",
    quantityRecorded: !!optionalText(formData.get("currentQuantity")),
    unit: optionalText(formData.get("unit")) ?? (formData.get("managementMode") === "information" && !optionalText(formData.get("currentQuantity")) ? "未指定" : ""),
    concentration: optionalText(formData.get("concentration")),
    locationId: optionalText(formData.get("locationId")),
    positionCode: optionalText(formData.get("positionCode")),
    expiryDate: optionalDate(formData.get("expiryDate")),
    storageCondition: optionalText(formData.get("storageCondition")),
    notes: optionalText(formData.get("notes")),
  });
}

/** The chosen product, or the new one typed into the form; stock saved before products existed may stay without one. */
async function productFor(tx: Tx, productId: string | undefined, formData: FormData, options: { optional?: boolean } = {}) {
  if (options.optional && !productId && !optionalText(formData.get("productName"))) return null;
  if (productId) {
    const product = await tx.inventoryProduct.findUnique({ where: { id: productId }, include: { type: { select: { key: true } } } });
    if (!product) throw new Error("The chosen product no longer exists.");
    return product;
  }
  const typed = newProductSchema.parse({
    name: formData.get("productName") ?? "",
    brand: optionalText(formData.get("productBrand")),
    catalogNumber: optionalText(formData.get("productCatalogNumber")),
    typeId: optionalText(formData.get("productTypeId")),
    groupKey: optionalText(formData.get("productGroupKey")) ?? "",
  });
  return linkInventoryProduct(tx, typed);
}

const requireProduct = <T,>(product: T | null) => {
  if (!product) throw new Error("Choose a product or enter the new product's name.");
  return product;
};

function assertModeFits(product: { controlLevels: string[] }, managementMode: string) {
  if (isStrictlyControlled(product.controlLevels) && managementMode !== "precise") throw new Error("Highly toxic and drug-precursor stock must be recorded with precise use.");
}

async function assertAliquotCodeFree(tx: Tx, aliquotCode: string | undefined, excludedId?: string) {
  if (!aliquotCode) return;
  const duplicate = await tx.inventoryItem.findFirst({ where: { aliquotCode, ...(excludedId ? { id: { not: excludedId } } : {}) }, select: { id: true } });
  if (duplicate) throw new Error("This aliquot code is already in use.");
}

async function persistNewInventoryItem(formData: FormData) {
  const parsed = parseInventoryItem(formData);

  const item = await prisma.$transaction(async (tx) => {
    await assertAliquotCodeFree(tx, parsed.aliquotCode);
    const product = requireProduct(await productFor(tx, optionalText(formData.get("productId")), formData));
    if (product.status === "archived") throw new Error("This product is archived; restore it before adding stock.");
    assertModeFits(product, parsed.managementMode);

    if (parsed.managementMode === "package" && (!Number.isInteger(parsed.currentQuantity) || parsed.currentQuantity > 1000)) throw new Error("包装数量必须为 0—1000 的整数。 / Package count must be an integer from 0 to 1000.");
    const created = await tx.inventoryItem.create({ data: { ...parsed, ...lotIdentity(product), productId: product.id } });
    if (parsed.managementMode === "package" && parsed.currentQuantity > 0) await tx.inventoryContainer.createMany({ data: Array.from({ length: parsed.currentQuantity }, () => ({ inventoryItemId: created.id, location: parsed.positionCode })) });

    if (parsed.quantityRecorded && parsed.currentQuantity > 0) {
      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: created.id,
          type: "receive",
          quantityChange: parsed.currentQuantity,
          unit: parsed.unit,
          toLocationId: parsed.locationId,
          notes: "Opening balance recorded when the item was registered.",
        },
      });
    }

    await tx.activityLog.create({
      data: {
        action: "create",
        targetType: "inventory_item",
        targetId: created.id,
        metadataJson: { productId: product.id, principalInvestigator: parsed.principalInvestigator ?? null, openingQuantity: parsed.currentQuantity, unit: parsed.unit },
      },
    });

    return created;
  });

  return item.id;
}

export async function createInventoryItem(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let itemId: string;
  try {
    itemId = await persistNewInventoryItem(formData);
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Inventory Item could not be registered.", "This aliquot code is already in use.") };
  }
  revalidatePath("/inventory");
  revalidatePath("/inventory/products");
  redirect(`/inventory/${itemId}`);
}

async function persistInventoryItemUpdate(formData: FormData) {
  const parsed = parseInventoryItem(formData);
  const id = optionalText(formData.get("id"));
  if (!id) throw new Error("Inventory item ID is required.");

  await prisma.$transaction(async (tx) => {
    const current = await tx.inventoryItem.findUnique({ where: { id } });
    if (!current) throw new Error("Inventory item not found.");
    await assertAliquotCodeFree(tx, parsed.aliquotCode, id);
    const product = await productFor(tx, optionalText(formData.get("productId")) ?? current.productId ?? undefined, formData, { optional: true });
    if (product) assertModeFits(product, parsed.managementMode);

    if (current.managementMode === "package") {
      if (current.managementMode !== parsed.managementMode || current.currentQuantity !== parsed.currentQuantity) throw new Error("包装数量由实物流转管理；不能在编辑表单中改写。 / Manage package counts through physical containers.");
    }
    if (current.quantityRecorded && !parsed.quantityRecorded) throw new Error("已有余额不能清空；请保留数量和历史。 / Existing balance must be preserved.");
    if(parsed.managementMode === "package" && current.managementMode !== "package") {
      if(!Number.isInteger(parsed.currentQuantity)||parsed.currentQuantity>1000)throw new Error("Package count must be an integer from 0 to 1000.");
      if(parsed.currentQuantity>0)await tx.inventoryContainer.createMany({data:Array.from({length:parsed.currentQuantity},()=>({inventoryItemId:id,location:parsed.positionCode}))});
    }
    const openingCount = !current.quantityRecorded && parsed.quantityRecorded;
    let countedAt:Date|undefined;
    let countedBy:string|undefined;
    let countSource:string|undefined;
    if(openingCount){
      const input=z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),by:z.string().trim().min(1).max(120),source:z.string().trim().min(1).max(1000)}).parse({date:formData.get("countedAt"),by:formData.get("countedBy"),source:formData.get("countSource")});
      countedAt=new Date(`${input.date}T00:00:00Z`);
      if(!Number.isFinite(countedAt.getTime())||countedAt.toISOString().slice(0,10)!==input.date)throw new Error("Invalid count date.");
      countedBy=input.by;countSource=input.source;
    }
    const quantityChange = Number((parsed.currentQuantity - current.currentQuantity).toFixed(6));
    const locationChanged = parsed.locationId !== (current.locationId ?? undefined);
    const principalInvestigatorChanged = parsed.principalInvestigator !== (current.principalInvestigator ?? undefined);
    if (parsed.unit !== current.unit) {
      const movementCount = await tx.inventoryTransaction.count({ where: { inventoryItemId: id } });
      if (movementCount > 0) throw new Error("Unit cannot be changed after stock movements exist. Register a separate item or conversion instead.");
    }

    const updated = await tx.inventoryItem.updateMany({
      where: { id, currentQuantity: current.currentQuantity, updatedAt: current.updatedAt },
      data: { ...parsed, ...(product ? { ...lotIdentity(product), productId: product.id } : {}), principalInvestigator: parsed.principalInvestigator ?? null },
    });
    if (updated.count !== 1) throw new Error("Inventory changed while saving. Refresh and review the current balance before retrying.");
    if (quantityChange !== 0 || (!current.quantityRecorded && parsed.quantityRecorded)) {
      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: id,
          type: "adjust",
          quantityChange,
          unit: parsed.unit,
          fromLocationId: current.locationId ?? undefined,
          toLocationId: parsed.locationId,
          notes: openingCount ? `Opening physical count: ${countSource}; no inferred past consumption.` : "Quantity adjustment generated from the Inventory Item edit form.",
          performedBy:countedBy,
          deviceCreatedAt:countedAt,
        },
      });
    }
    if (locationChanged) {
      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: id,
          type: "transfer",
          quantityChange: 0,
          unit: parsed.unit,
          fromLocationId: current.locationId ?? undefined,
          toLocationId: parsed.locationId,
          notes: "Location transfer generated from the Inventory Item edit form.",
        },
      });
    }
    await tx.activityLog.create({
      data: {
        action: "update",
        targetType: "inventory_item",
        targetId: id,
        metadataJson: {
          quantityChange,
          locationChanged,
          productId: product?.id ?? null,
          previousProductId: current.productId,
          principalInvestigatorChanged,
          previousPrincipalInvestigator: current.principalInvestigator,
          principalInvestigator: parsed.principalInvestigator ?? null,
        },
      },
    });
  });

  return id;
}

export async function updateInventoryItem(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let itemId: string;
  try {
    itemId = await persistInventoryItemUpdate(formData);
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Inventory Item could not be saved.", "This aliquot code is already in use.") };
  }
  revalidatePath("/inventory");
  revalidatePath("/inventory/products");
  revalidatePath(`/inventory/${itemId}`);
  redirect(`/inventory/${itemId}`);
}

const idOf = (formData: FormData) => z.string().trim().min(1, "Inventory item ID is required.").parse(formData.get("id"));

/** Archived stock keeps its ledger and links and can be restored. */
export async function setInventoryItemArchived(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const id = idOf(formData);
    const archived = formData.get("archived") === "true";
    await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id } });
      if (!item) throw new Error("Inventory item not found.");
      await tx.inventoryItem.update({ where: { id }, data: { status: archived ? "archived" : "active" } });
      await tx.activityLog.create({ data: { action: archived ? "archive" : "restore", targetType: "inventory_item", targetId: id, metadataJson: { name: item.name } } });
    });
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${id}`);
    return { success: archived ? "Archived. The ledger is kept." : "Restored." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The inventory item could not be changed.") };
  }
}

/** Only stock with no history beyond its opening balance is deleted; anything else is archived instead. */
export async function deleteInventoryItem(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const id = idOf(formData);
    const confirmation = String(formData.get("confirmation") ?? "").trim();
    await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id } });
      if (!item) throw new Error("Inventory item not found.");
      if (confirmation !== item.name) throw new Error(`Enter ${item.name} exactly to confirm permanent deletion.`);
      const blockers = await stockItemBlockers(tx, id);
      if (blockers.length) throw new Error(`This item has ${blockers.join(", ")}, so it cannot be deleted. Archive it instead.`);
      await deleteStockItem(tx, id);
      await tx.activityLog.create({ data: { action: "delete", targetType: "inventory_item", targetId: id, metadataJson: { name: item.name, productId: item.productId, lotNumber: item.lotNumber, currentQuantity: item.currentQuantity, unit: item.unit } } });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The inventory item could not be deleted.") };
  }
  revalidatePath("/inventory");
  revalidatePath("/inventory/products");
  redirect("/inventory");
}

const transactionSchema = z.object({
  type: z.enum(["receive", "consume", "discard", "return"]),
  quantity: z.number().finite().positive(),
  performedBy: z.string().trim().max(120).optional(),
  experimentId: z.string().trim().optional(),
  purchaseId: z.string().trim().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function recordInventoryTransaction(itemId: string, _previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const parsed = transactionSchema.parse({
      type: formData.get("type"),
      quantity: optionalNumber(formData.get("quantity")),
      performedBy: optionalText(formData.get("performedBy")),
      experimentId: optionalText(formData.get("experimentId")),
      purchaseId: optionalText(formData.get("purchaseId")),
      notes: optionalText(formData.get("notes")),
    });
    const isInbound = parsed.type === "receive" || parsed.type === "return";
    const quantityChange = isInbound ? parsed.quantity : -parsed.quantity;

    await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: itemId }, include: { product: { select: { controlLevels: true } } } });
      if (!item) throw new Error("Inventory item not found.");
      if (item.status !== "active") throw new Error("This stock is archived; restore it before recording movements.");

      if (!item.quantityRecorded || item.managementMode !== "precise") throw new Error("请使用该物料的管理方式；未知数量需要先盘点。 / Use the item management workflow; unknown stock requires an opening count.");
      const controlProblem = controlledUseProblem(item.product?.controlLevels ?? [], parsed);
      if (controlProblem) throw new Error(controlProblem);
      const nextQuantity = Number((item.currentQuantity + quantityChange).toFixed(6));
      if (nextQuantity < 0) {
        throw new Error(`This transaction would make stock negative. Available: ${item.currentQuantity} ${item.unit}.`);
      }

      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: item.id,
          type: parsed.type,
          quantityChange,
          unit: item.unit,
          fromLocationId: isInbound ? undefined : item.locationId ?? undefined,
          toLocationId: isInbound ? item.locationId ?? undefined : undefined,
          experimentId: parsed.experimentId,
          purchaseId: parsed.purchaseId,
          performedBy: parsed.performedBy,
          notes: parsed.notes,
        },
      });
      const updated = await tx.inventoryItem.updateMany({
        where: { id: item.id, currentQuantity: item.currentQuantity },
        data: { currentQuantity: nextQuantity },
      });
      if (updated.count !== 1) {
        throw new Error("Stock changed while this movement was being recorded. Review the latest quantity and submit again.");
      }
      await tx.activityLog.create({
        data: {
          action: parsed.type,
          targetType: "inventory_item",
          targetId: item.id,
          metadataJson: { quantityChange, unit: item.unit, experimentId: parsed.experimentId ?? null, purchaseId: parsed.purchaseId ?? null },
        },
      });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The movement could not be recorded.") };
  }
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${itemId}`);
  return { success: "Movement recorded." };
}

/** Books the opposite quantity against a mistaken movement; the original stays as recorded and both point at each other. */
export async function reverseInventoryTransaction(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  let itemId = "";
  try {
    const id = z.string().trim().min(1, "Movement ID is required.").parse(formData.get("id"));
    const reason = z.string().trim().max(500).parse(formData.get("reason") ?? "") || null;
    await prisma.$transaction(async (tx) => {
      const movement = await tx.inventoryTransaction.findUnique({ where: { id }, include: { reversedBy: { select: { id: true } }, materialUse: { select: { id: true } } } });
      if (!movement) throw new Error("This movement no longer exists.");
      const item = await tx.inventoryItem.findUnique({ where: { id: movement.inventoryItemId } });
      if (!item) throw new Error("Inventory item not found.");
      itemId = item.id;
      const problem = movementReversalProblem(movement, item);
      if (problem) throw new Error(problem);
      const nextQuantity = Number((item.currentQuantity - movement.quantityChange).toFixed(6));
      const updated = await tx.inventoryItem.updateMany({ where: { id: item.id, currentQuantity: item.currentQuantity }, data: { currentQuantity: nextQuantity } });
      if (updated.count !== 1) throw new Error("Stock changed while reversing. Refresh and try again.");
      const reversal = await tx.inventoryTransaction.create({ data: { inventoryItemId: item.id, type: "adjust", quantityChange: -movement.quantityChange, unit: movement.unit, reversesTransactionId: movement.id, notes: reason } });
      await tx.activityLog.create({ data: { action: "reverse", targetType: "inventory_item", targetId: item.id, metadataJson: { transactionId: movement.id, reversalId: reversal.id, quantityChange: -movement.quantityChange, unit: movement.unit, reason } } });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The movement could not be reversed.") };
  }
  revalidatePath("/inventory");
  if (itemId) revalidatePath(`/inventory/${itemId}`);
  return { success: "Movement reversed." };
}
