"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";
import {
  inventoryBenchActionFreezeThawDelta,
  inventoryBenchActionQuantityChange,
  inventoryBenchActionTypes,
} from "@/lib/inventory";

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
    currentQuantity: optionalNumber(formData.get("currentQuantity")),
    unit: formData.get("unit"),
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

    const created = await tx.inventoryItem.create({ data: createData });

    if (parsed.currentQuantity > 0) {
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

    const quantityChange = Number((parsed.currentQuantity - current.currentQuantity).toFixed(6));
    const locationChanged = parsed.locationId !== (current.locationId ?? undefined);
    const principalInvestigatorChanged = parsed.principalInvestigator !== (current.principalInvestigator ?? undefined);
    if (parsed.unit !== current.unit) {
      const movementCount = await tx.inventoryTransaction.count({ where: { inventoryItemId: id } });
      if (movementCount > 0) throw new Error("Unit cannot be changed after stock movements exist. Register a separate item or conversion instead.");
    }

    await tx.inventoryItem.update({
      where: { id },
      data: { ...updateData, principalInvestigator: parsed.principalInvestigator ?? null },
    });
    if (quantityChange !== 0) {
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

const inventoryBenchActionSchema = z.object({
  type: z.enum(inventoryBenchActionTypes),
  quantity: z.number().finite().positive().optional(),
  performedBy: z.string().trim().max(120).optional(),
  experimentId: z.string().trim().optional(),
  purchaseId: z.string().trim().optional(),
  targetLocationId: z.string().trim().optional(),
  targetPositionCode: z.string().trim().max(120).optional(),
  childName: z.string().trim().max(180).optional(),
  childAliquotCode: z.string().trim().max(160).optional(),
  qcResult: z.enum(["pass", "fail", "inconclusive"]).optional(),
  qcMethod: z.string().trim().max(180).optional(),
  notes: z.string().trim().max(2000).optional(),
}).superRefine((value, context) => {
  if (["consume", "receive", "return", "aliquot", "discard"].includes(value.type) && !value.quantity) {
    context.addIssue({ code: "custom", path: ["quantity"], message: "A positive quantity is required for this action." });
  }
  if (value.type === "aliquot" && !value.childName) {
    context.addIssue({ code: "custom", path: ["childName"], message: "A child container name is required for aliquoting." });
  }
  if (value.type === "aliquot" && !value.childAliquotCode) {
    context.addIssue({ code: "custom", path: ["childAliquotCode"], message: "A unique aliquot code is required for the child container." });
  }
  if (value.type === "qc" && !value.qcResult) {
    context.addIssue({ code: "custom", path: ["qcResult"], message: "Select a QC result." });
  }
  if (value.type === "discard" && !value.notes) {
    context.addIssue({ code: "custom", path: ["notes"], message: "A disposal reason is required." });
  }
});

export async function recordInventoryBenchAction(
  itemId: string,
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  try {
    const parsed = inventoryBenchActionSchema.parse({
      type: formData.get("type"),
      quantity: optionalNumber(formData.get("quantity")),
      performedBy: optionalText(formData.get("performedBy")),
      experimentId: optionalText(formData.get("experimentId")),
      purchaseId: optionalText(formData.get("purchaseId")),
      targetLocationId: optionalText(formData.get("targetLocationId")),
      targetPositionCode: optionalText(formData.get("targetPositionCode")),
      childName: optionalText(formData.get("childName")),
      childAliquotCode: optionalText(formData.get("childAliquotCode")),
      qcResult: optionalText(formData.get("qcResult")),
      qcMethod: optionalText(formData.get("qcMethod")),
      notes: optionalText(formData.get("notes")),
    });
    const targetLocationId = parsed.targetLocationId === "__unassigned__" ? null : parsed.targetLocationId ?? null;

    await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: itemId } });
      if (!item) throw new Error("Inventory item not found.");
      if (targetLocationId) {
        const targetLocation = await tx.inventoryLocation.findUnique({ where: { id: targetLocationId }, select: { status: true } });
        if (!targetLocation || targetLocation.status !== "active") {
          throw new Error("Choose an active Inventory location.");
        }
      }

      const quantityChange = inventoryBenchActionQuantityChange(parsed.type, parsed.quantity);
      const freezeThawDelta = inventoryBenchActionFreezeThawDelta(parsed.type);
      const nextQuantity = Number((item.currentQuantity + quantityChange).toFixed(6));
      if (nextQuantity < 0) {
        throw new Error(`This action would make stock negative. Available: ${item.currentQuantity} ${item.unit}.`);
      }

      if (parsed.type === "transfer") {
        const nextLocationId = targetLocationId;
        const nextPositionCode = parsed.targetPositionCode ?? null;
        if (nextLocationId === item.locationId && nextPositionCode === item.positionCode) {
          throw new Error("Choose a different location or position before recording a move.");
        }

        const updated = await tx.inventoryItem.updateMany({
          where: { id: item.id, locationId: item.locationId, positionCode: item.positionCode },
          data: { locationId: nextLocationId, positionCode: nextPositionCode },
        });
        if (updated.count !== 1) throw new Error("Location changed while this move was being recorded. Review the item and submit again.");
      } else if (quantityChange !== 0 || freezeThawDelta !== 0) {
        const updated = await tx.inventoryItem.updateMany({
          where: { id: item.id, currentQuantity: item.currentQuantity, freezeThawCount: item.freezeThawCount },
          data: {
            currentQuantity: nextQuantity,
            freezeThawCount: item.freezeThawCount + freezeThawDelta,
          },
        });
        if (updated.count !== 1) throw new Error("Stock changed while this action was being recorded. Review the latest item and submit again.");
      }

      let childItemId: string | null = null;
      if (parsed.type === "aliquot") {
        const duplicate = await tx.inventoryItem.findUnique({ where: { aliquotCode: parsed.childAliquotCode! }, select: { id: true } });
        if (duplicate) throw new Error("This aliquot code is already in use.");

        const child = await tx.inventoryItem.create({
          data: {
            entityId: item.entityId,
            name: parsed.childName!,
            englishName: item.englishName,
            category: item.category,
            brand: item.brand,
            principalInvestigator: item.principalInvestigator,
            containerType: item.containerType,
            aliquotCode: parsed.childAliquotCode!,
            lotNumber: item.lotNumber,
            vendor: item.vendor,
            catalogNumber: item.catalogNumber,
            casNumber: item.casNumber,
            currentQuantity: parsed.quantity!,
            unit: item.unit,
            concentration: item.concentration,
            locationId: targetLocationId,
            positionCode: parsed.targetPositionCode,
            parentInventoryItemId: item.id,
            expiryDate: item.expiryDate,
            storageCondition: item.storageCondition,
            notes: `Aliquoted from ${item.name}${item.aliquotCode ? ` (${item.aliquotCode})` : ""}.`,
          },
        });
        childItemId = child.id;
        await tx.inventoryTransaction.create({
          data: {
            inventoryItemId: child.id,
            type: "receive",
            quantityChange: parsed.quantity!,
            unit: item.unit,
            toLocationId: child.locationId ?? undefined,
            experimentId: parsed.experimentId,
            performedBy: parsed.performedBy,
            notes: `Opening balance received from parent stock ${item.name}.`,
          },
        });
      }

      const actionDetails = parsed.type === "transfer"
        ? `Position ${item.positionCode ?? "unassigned"} → ${parsed.targetPositionCode ?? "unassigned"}.`
        : parsed.type === "aliquot"
          ? `Created child aliquot ${parsed.childAliquotCode}.`
          : parsed.type === "qc"
            ? `QC result: ${parsed.qcResult}${parsed.qcMethod ? `; method: ${parsed.qcMethod}` : ""}.`
            : parsed.type === "thaw"
              ? `Freeze-thaw count ${item.freezeThawCount} → ${item.freezeThawCount + 1}.`
              : undefined;
      const notes = [actionDetails, parsed.notes].filter(Boolean).join("\n") || undefined;
      const isInbound = parsed.type === "receive" || parsed.type === "return";

      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: item.id,
          type: parsed.type,
          quantityChange,
          unit: item.unit,
          fromLocationId: isInbound || parsed.type === "qc" || parsed.type === "refreeze" ? undefined : item.locationId ?? undefined,
          toLocationId: parsed.type === "transfer" || parsed.type === "aliquot"
            ? targetLocationId ?? undefined
            : isInbound
              ? item.locationId ?? undefined
              : undefined,
          experimentId: parsed.experimentId,
          purchaseId: parsed.purchaseId,
          performedBy: parsed.performedBy,
          notes,
        },
      });
      await tx.activityLog.create({
        data: {
          action: parsed.type,
          targetType: "inventory_item",
          targetId: item.id,
          metadataJson: {
            quantityChange,
            unit: item.unit,
            experimentId: parsed.experimentId ?? null,
            purchaseId: parsed.purchaseId ?? null,
            performedBy: parsed.performedBy ?? null,
            fromLocationId: item.locationId,
            fromPositionCode: item.positionCode,
            toLocationId: targetLocationId,
            toPositionCode: parsed.targetPositionCode ?? null,
            childItemId,
            childAliquotCode: parsed.childAliquotCode ?? null,
            qcResult: parsed.qcResult ?? null,
            qcMethod: parsed.qcMethod ?? null,
            freezeThawDelta,
          },
        },
      });
    });

    revalidatePath("/inventory");
    revalidatePath(`/inventory/${itemId}`);
    return { message: "Inventory action recorded." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Inventory action could not be recorded.", "This aliquot code is already in use.") };
  }
}
