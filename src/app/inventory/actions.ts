"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";

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

const inventoryItemSchema = z.object({
  id: z.string().trim().optional(),
  entityId: z.string().trim().optional(),
  name: z.string().trim().min(1, "Item name is required.").max(180),
  englishName: z.string().trim().max(180).optional(),
  category: z.string().trim().max(64).optional(),
  brand: z.string().trim().max(120).optional(),
  principalInvestigator: z.string().trim().max(120).optional(),
  vendor: z.string().trim().max(180).optional(),
  catalogNumber: z.string().trim().max(120).optional(),
  casNumber: z.string().trim().max(64).optional(),
  lotNumber: z.string().trim().max(120).optional(),
  containerType: z.string().trim().max(80).optional(),
  barcode: z.string().trim().max(160).optional(),
  aliquotCode: z.string().trim().max(160).optional(),
  currentQuantity: z.number().finite().nonnegative(),
  managementMode: z.enum(["information", "package", "precise"]).default("precise"),
  quantityRecorded: z.boolean().default(true),
  unit: z.string().trim().min(1, "Unit is required.").max(32),
  lowThreshold: z.number().finite().nonnegative().optional(),
  concentration: z.string().trim().max(120).optional(),
  locationId: z.string().trim().optional(),
  positionCode: z.string().trim().max(120).optional(),
  expiryDate: z.date().optional(),
  storageCondition: z.string().trim().max(240).optional(),
  notes: z.string().trim().max(5000).optional(),
});
const createInventoryItemSchema = inventoryItemSchema.omit({ id: true });

function parseInventoryItem(formData: FormData) {
  return inventoryItemSchema.parse({
    id: optionalText(formData.get("id")),
    entityId: optionalText(formData.get("entityId")),
    name: formData.get("name"),
    englishName: optionalText(formData.get("englishName")),
    category: optionalText(formData.get("category")),
    brand: optionalText(formData.get("brand")),
    principalInvestigator: optionalText(formData.get("principalInvestigator")),
    vendor: optionalText(formData.get("vendor")),
    catalogNumber: optionalText(formData.get("catalogNumber")),
    casNumber: optionalText(formData.get("casNumber")),
    lotNumber: optionalText(formData.get("lotNumber")),
    containerType: optionalText(formData.get("containerType")),
    barcode: optionalText(formData.get("barcode")),
    aliquotCode: optionalText(formData.get("aliquotCode")),
    currentQuantity: formData.get("managementMode") === "information" && !optionalText(formData.get("currentQuantity")) ? 0 : optionalNumber(formData.get("currentQuantity")),
    managementMode: optionalText(formData.get("managementMode")) ?? "precise",
    quantityRecorded: !!optionalText(formData.get("currentQuantity")),
    unit: optionalText(formData.get("unit")) ?? (formData.get("managementMode") === "information" ? "未指定" : ""),
    lowThreshold: optionalNumber(formData.get("lowThreshold")),
    concentration: optionalText(formData.get("concentration")),
    locationId: optionalText(formData.get("locationId")),
    positionCode: optionalText(formData.get("positionCode")),
    expiryDate: optionalDate(formData.get("expiryDate")),
    storageCondition: optionalText(formData.get("storageCondition")),
    notes: optionalText(formData.get("notes")),
  });
}

async function persistNewInventoryItem(formData: FormData) {
  const parsed = parseInventoryItem(formData);
  const createData = createInventoryItemSchema.parse(parsed);

  const item = await prisma.$transaction(async (tx) => {
    if (parsed.aliquotCode) {
      const duplicate = await tx.inventoryItem.findUnique({
        where: { aliquotCode: parsed.aliquotCode },
        select: { id: true },
      });
      if (duplicate) throw new Error("This aliquot code is already in use.");
    }

    if (parsed.managementMode === "package" && (!Number.isInteger(parsed.currentQuantity) || parsed.currentQuantity > 1000)) throw new Error("包装数量必须为 0—1000 的整数。 / Package count must be an integer from 0 to 1000.");
    const created = await tx.inventoryItem.create({ data: createData });
    if (parsed.managementMode === "package" && parsed.currentQuantity > 0) await tx.inventoryContainer.createMany({data:Array.from({length:parsed.currentQuantity},()=>({inventoryItemId:created.id,location:parsed.positionCode}))});

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
        metadataJson: { category: parsed.category ?? null, principalInvestigator: parsed.principalInvestigator ?? null, openingQuantity: parsed.currentQuantity, unit: parsed.unit },
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
  redirect(`/inventory/${itemId}`);
}

async function persistInventoryItemUpdate(formData: FormData) {
  const parsed = parseInventoryItem(formData);
  if (!parsed.id) throw new Error("Inventory item ID is required.");
  const { id, ...updateData } = parsed;

  await prisma.$transaction(async (tx) => {
    const current = await tx.inventoryItem.findUnique({ where: { id } });
    if (!current) throw new Error("Inventory item not found.");

    if (parsed.aliquotCode) {
      const duplicate = await tx.inventoryItem.findFirst({
        where: { id: { not: id }, aliquotCode: parsed.aliquotCode },
        select: { id: true },
      });
      if (duplicate) throw new Error("This aliquot code is already in use.");
    }

    if (current.managementMode === "package") {
      if (current.managementMode !== parsed.managementMode || current.currentQuantity !== parsed.currentQuantity) throw new Error("包装数量由实物流转管理；不能在编辑表单中改写。 / Manage package counts through physical containers.");
    }
    if (current.quantityRecorded && !parsed.quantityRecorded) throw new Error("已有余额不能清空；请保留数量和历史。 / Existing balance must be preserved.");
    if(parsed.managementMode === "package" && current.managementMode !== "package") {
      if(!Number.isInteger(parsed.currentQuantity)||parsed.currentQuantity>1000)throw new Error("Package count must be an integer from 0 to 1000.");
      if(parsed.currentQuantity>0)await tx.inventoryContainer.createMany({data:Array.from({length:parsed.currentQuantity},()=>({inventoryItemId:id,location:parsed.positionCode}))});
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
      data: { ...updateData, principalInvestigator: parsed.principalInvestigator ?? null },
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
          notes: "Quantity adjustment generated from the Inventory Item edit form.",
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
          category: parsed.category ?? null,
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
  revalidatePath(`/inventory/${itemId}`);
  redirect(`/inventory/${itemId}`);
}

const transactionSchema = z.object({
  type: z.enum(["receive", "consume", "discard", "return"]),
  quantity: z.number().finite().positive(),
  performedBy: z.string().trim().max(120).optional(),
  experimentId: z.string().trim().optional(),
  purchaseId: z.string().trim().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function recordInventoryTransaction(itemId: string, formData: FormData) {
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
    const item = await tx.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item) throw new Error("Inventory item not found.");

    if (!item.quantityRecorded || item.managementMode !== "precise") throw new Error("请使用该物料的管理方式；未知数量需要先盘点。 / Use the item management workflow; unknown stock requires an opening count.");
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

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${itemId}`);
  redirect(`/inventory/${itemId}`);
}
