"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { formActionErrorMessage } from "@/lib/form-actions";
import { inventoryControlKeys } from "@/lib/inventory";
import { bulkProductPlan, bulkStockPlan, productBulkActions, stockBulkActions, type BulkEntry } from "@/lib/inventory-bulk";
import { deleteProduct, deleteStockItem, stockItemBlockers, syncProductLots } from "@/lib/inventory-products.server";
import { applyContainerCommand } from "@/lib/inventory-containers";
import { isInventoryGroupKey } from "@/lib/inventory-types";

type Tx = Prisma.TransactionClient;
type BulkState = { entries?: BulkEntry[]; error?: string };

const ids = z.array(z.string().min(1)).min(1, "Select at least one record.").max(500);
const stockInput = z.object({
  action: z.enum(stockBulkActions),
  ids,
  locationId: z.string().min(1).nullish(),
  principalInvestigator: z.string().trim().max(120).nullish(),
  count: z.number().int().min(1).max(100).default(1),
  holder: z.string().trim().max(120).optional(),
  place: z.string().trim().max(240).optional(),
  confirmation: z.string().optional(),
});
const productInput = z.object({
  action: z.enum(productBulkActions),
  ids,
  typeId: z.string().min(1).nullish(),
  groupKey: z.string().min(1).nullish(),
  level: z.string().refine((key) => inventoryControlKeys.includes(key), "Unknown control level.").optional(),
  confirmation: z.string().optional(),
});

/** Records in the order they were selected; ones deleted meanwhile drop out. */
const inSelectionOrder = <T extends { id: string }>(records: T[], selected: string[]) => selected.flatMap((id) => records.filter((record) => record.id === id));

/** Deleting in bulk asks for the number of selected records, typed, as single deletes ask for the name. */
function assertConfirmed(input: { action: string; ids: string[]; confirmation?: string }) {
  if (input.action === "delete" && input.confirmation?.trim() !== String(input.ids.length)) throw new Error(`Enter ${input.ids.length} to confirm.`);
}

async function stockPlan(tx: Tx, input: z.infer<typeof stockInput>) {
  if (input.action === "move" && input.locationId && !await tx.inventoryLocation.findUnique({ where: { id: input.locationId }, select: { id: true } })) throw new Error("This storage location no longer exists.");
  const items = inSelectionOrder(await tx.inventoryItem.findMany({
    where: { id: { in: input.ids } },
    select: { id: true, name: true, status: true, locationId: true, principalInvestigator: true, unit: true, managementMode: true, containers: { where: { state: "warehouse" }, select: { id: true }, orderBy: { createdAt: "asc" } } },
  }), input.ids);
  const rows = [];
  for (const item of items) rows.push({ ...item, inStore: item.containers.length, blockers: input.action === "delete" ? await stockItemBlockers(tx, item.id) : [] });
  return { items, plan: bulkStockPlan(input.action, rows, { locationId: input.locationId ?? null, principalInvestigator: input.principalInvestigator || null, count: input.count }) };
}

async function productPlan(tx: Tx, input: z.infer<typeof productInput>) {
  let target: { typeId: string | null; groupKey: string | null } = { typeId: null, groupKey: null };
  if (input.action === "classify" && input.typeId) {
    const type = await tx.scientificSchemaDefinition.findUnique({ where: { id: input.typeId } });
    if (!type?.inventoryGroupKey || !type.enabled) throw new Error("Choose an inventory type that is in use.");
    target = { typeId: type.id, groupKey: type.inventoryGroupKey };
  } else if (input.action === "classify") {
    target = { typeId: null, groupKey: input.groupKey && isInventoryGroupKey(input.groupKey) ? input.groupKey : null };
  }
  if ((input.action === "addControl" || input.action === "removeControl") && !input.level) throw new Error("Choose a control level.");
  const products = inSelectionOrder(await tx.inventoryProduct.findMany({
    where: { id: { in: input.ids } },
    select: { id: true, name: true, status: true, typeId: true, groupKey: true, controlLevels: true, _count: { select: { items: true } }, items: { where: { managementMode: { not: "precise" } }, select: { id: true } } },
  }), input.ids);
  const rows = products.map((product) => ({ ...product, lots: product._count.items, impreciseLots: product.items.length }));
  return { target, products, plan: bulkProductPlan(input.action, rows, { ...target, level: input.level }) };
}

const idsWith = (plan: BulkEntry[], outcome: BulkEntry["outcome"]) => plan.filter((entry) => entry.outcome === outcome).map((entry) => entry.id);

/** What a bulk action on the selected stock would do to each record; nothing is written. */
export async function previewStockBulk(raw: unknown): Promise<BulkState> {
  try {
    const input = stockInput.parse(raw);
    return { entries: (await prisma.$transaction((tx) => stockPlan(tx, input))).plan };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The selection could not be checked.") };
  }
}

/** Applies a bulk action to the selected stock in one transaction and returns what happened to each record. */
export async function applyStockBulk(raw: unknown): Promise<BulkState> {
  try {
    const input = stockInput.parse(raw);
    assertConfirmed(input);
    if (input.action === "takeOut" && !input.holder) throw new Error("Enter who takes them.");
    const entries = await prisma.$transaction(async (tx) => {
      const { items, plan } = await stockPlan(tx, input);
      const changed = idsWith(plan, "change");
      if (input.action === "archive" || input.action === "restore") await tx.inventoryItem.updateMany({ where: { id: { in: changed } }, data: { status: input.action === "archive" ? "archived" : "active" } });
      if (input.action === "pi") await tx.inventoryItem.updateMany({ where: { id: { in: changed } }, data: { principalInvestigator: input.principalInvestigator || null } });
      if (input.action === "move") {
        for (const item of items.filter((entry) => changed.includes(entry.id))) {
          await tx.inventoryTransaction.create({ data: { inventoryItemId: item.id, type: "transfer", quantityChange: 0, unit: item.unit, fromLocationId: item.locationId ?? undefined, toLocationId: input.locationId ?? undefined, notes: "Location transfer from a bulk move." } });
          await tx.inventoryItem.update({ where: { id: item.id }, data: { locationId: input.locationId ?? null } });
        }
      }
      // The oldest containers in store go first, each through the same command as a take-out on the stock page.
      if (input.action === "takeOut") {
        for (const item of items.filter((entry) => changed.includes(entry.id))) {
          for (const container of item.containers.slice(0, input.count)) {
            await applyContainerCommand(tx, item.id, { action: "issue", containerId: container.id, clientMutationId: randomUUID(), holder: input.holder, location: input.place || undefined });
          }
        }
      }
      if (input.action === "delete") {
        for (const id of idsWith(plan, "delete")) await deleteStockItem(tx, id);
        await tx.inventoryItem.updateMany({ where: { id: { in: idsWith(plan, "archive") } }, data: { status: "archived" } });
      }
      await tx.activityLog.create({ data: { action: `bulk_${input.action}`, targetType: "inventory_item_bulk", targetId: randomUUID(), metadataJson: { locationId: input.locationId ?? null, principalInvestigator: input.principalInvestigator ?? null, ...(input.action === "takeOut" ? { count: input.count, holder: input.holder, place: input.place ?? null } : {}), entries: plan } } });
      return plan;
    });
    revalidatePath("/inventory");
    revalidatePath("/inventory/products");
    return { entries };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The selected stock could not be changed.") };
  }
}

/** What a bulk action on the selected products would do to each one; nothing is written. */
export async function previewProductBulk(raw: unknown): Promise<BulkState> {
  try {
    const input = productInput.parse(raw);
    return { entries: (await prisma.$transaction((tx) => productPlan(tx, input))).plan };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The selection could not be checked.") };
  }
}

/** Applies a bulk action to the selected products in one transaction; their lots follow a new type or 大类. */
export async function applyProductBulk(raw: unknown): Promise<BulkState> {
  try {
    const input = productInput.parse(raw);
    assertConfirmed(input);
    const entries = await prisma.$transaction(async (tx) => {
      const { target, products, plan } = await productPlan(tx, input);
      const changed = idsWith(plan, "change");
      if (input.action === "archive" || input.action === "restore") await tx.inventoryProduct.updateMany({ where: { id: { in: changed } }, data: { status: input.action === "archive" ? "archived" : "active" } });
      if (input.action === "classify") {
        await tx.inventoryProduct.updateMany({ where: { id: { in: changed } }, data: target });
        for (const id of changed) await syncProductLots(tx, id);
      }
      if (input.action === "addControl" || input.action === "removeControl") {
        for (const product of products.filter((entry) => changed.includes(entry.id))) {
          const levels = input.action === "addControl" ? [...product.controlLevels, input.level!] : product.controlLevels.filter((level) => level !== input.level);
          await tx.inventoryProduct.update({ where: { id: product.id }, data: { controlLevels: levels } });
        }
      }
      if (input.action === "delete") {
        for (const id of idsWith(plan, "delete")) await deleteProduct(tx, id);
        await tx.inventoryProduct.updateMany({ where: { id: { in: idsWith(plan, "archive") } }, data: { status: "archived" } });
      }
      await tx.activityLog.create({ data: { action: `bulk_${input.action}`, targetType: "inventory_product_bulk", targetId: randomUUID(), metadataJson: { ...target, level: input.level ?? null, entries: plan } } });
      return plan;
    });
    revalidatePath("/inventory");
    revalidatePath("/inventory/products");
    return { entries };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The selected products could not be changed.") };
  }
}
