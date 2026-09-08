import { z } from "zod";
import { prisma } from "@/lib/db";
const text = z.string().trim().min(1).max(240);
export const purchaseInput = z.object({
  title: text,
  quantity: z.number().finite().positive(),
  unit: text,
  status: z.enum(["planned", "ordered", "received"]).default("ordered"),
  vendor: text.optional(),
  actualAmount: z
    .string()
    .regex(/^\d{1,14}(\.\d{1,2})?$/)
    .optional(),
  invoiceStatus: z
    .enum(["pending", "available", "not_required"])
    .default("pending"),
  invoiceReference: text.optional(),
  linkedInventoryItemId: text.optional(),
  procurementQuoteLineId: text.optional(),
  clientMutationId: z.string().uuid(),
});
export async function createIndependentPurchase(raw: unknown) {
  const input = purchaseInput.parse(raw);
  const replay = await prisma.purchaseRequest.findUnique({
    where: { clientMutationId: input.clientMutationId },
  });
  if (replay) return replay;
  try {
    return await prisma.$transaction(async (tx) => {
      if (input.linkedInventoryItemId)
        await tx.inventoryItem.findUniqueOrThrow({
          where: { id: input.linkedInventoryItemId },
        });
      if (input.procurementQuoteLineId)
        await tx.procurementQuoteLine.findUniqueOrThrow({
          where: { id: input.procurementQuoteLineId },
        });
      const purchase = await tx.purchaseRequest.create({ data: input });
      if (input.procurementQuoteLineId)
        await tx.procurementQuoteLine.update({
          where: { id: input.procurementQuoteLineId },
          data: { status: "converted" },
        });
      if (input.status === "received")
        await tx.purchaseReceipt.create({
          data: {
            purchaseId: purchase.id,
            quantity: input.quantity,
            clientMutationId: input.clientMutationId,
          },
        });
      await tx.activityLog.create({
        data: {
          action: "create",
          targetType: "purchase",
          targetId: purchase.id,
          metadataJson: { source: "manual", inventoryRequired: false },
        },
      });
      return purchase;
    });
  } catch (error) {
    const replay = await prisma.purchaseRequest.findUnique({
      where: { clientMutationId: input.clientMutationId },
    });
    if (replay) return replay;
    throw error;
  }
}
const receiptInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("details"),
    quantity: z.number().finite().positive(),
    actualAmount: z
      .string()
      .regex(/^\d{1,14}(\.\d{1,2})?$/)
      .nullable(),
    clientMutationId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("receive"),
    quantity: z.number().finite().positive(),
    inventory: z.enum(["none", "new", "existing"]),
    inventoryItemId: text.optional(),
    clientMutationId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("link"),
    inventoryItemId: text,
    clientMutationId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("invoice"),
    invoiceStatus: z.enum(["pending", "available", "not_required"]),
    invoiceReference: z.string().trim().max(240),
    clientMutationId: z.string().uuid(),
  }),
]);
export async function updateIndependentPurchase(id: string, raw: unknown) {
  const input = receiptInput.parse(raw);
  if (input.action === "receive") {
    const replay = await prisma.purchaseReceipt.findUnique({
      where: { clientMutationId: input.clientMutationId },
    });
    if (replay) {
      if (replay.purchaseId !== id)
        throw new Error("Request key belongs to another purchase.");
      return replay;
    }
  }
  try {
    return await prisma.$transaction(async (tx) => {
      // Receipt and correction must validate against the same locked order state.
      await tx.$queryRaw`SELECT "id" FROM "PurchaseRequest" WHERE "id"=${id} FOR UPDATE`;
      const purchase = await tx.purchaseRequest.findUniqueOrThrow({
        where: { id },
        include: { receipts: true },
      });
      if (input.action === "details") {
        if (
          input.quantity <
          purchase.receipts.reduce((sum, r) => sum + r.quantity, 0)
        )
          throw new Error("购买数量不能小于已收货数量。");
        await tx.activityLog.create({
          data: {
            action: "purchase_correction",
            targetType: "purchase",
            targetId: id,
            metadataJson: {
              previousQuantity: purchase.quantity,
              previousAmount: purchase.actualAmount?.toFixed(2) ?? null,
              quantity: input.quantity,
              actualAmount: input.actualAmount,
            },
          },
        });
        return tx.purchaseRequest.update({
          where: { id },
          data: { quantity: input.quantity, actualAmount: input.actualAmount },
        });
      }
      if (input.action === "invoice") {
        await tx.activityLog.create({
          data: {
            action: "invoice_update",
            targetType: "purchase",
            targetId: id,
            metadataJson: {
              previousStatus: purchase.invoiceStatus,
              previousReference: purchase.invoiceReference,
              nextStatus: input.invoiceStatus,
              nextReference: input.invoiceReference,
            },
          },
        });
        return tx.purchaseRequest.update({
          where: { id },
          data: {
            invoiceStatus: input.invoiceStatus,
            invoiceReference: input.invoiceReference || null,
          },
        });
      }
      if (input.action === "link") {
        await tx.inventoryItem.findUniqueOrThrow({
          where: { id: input.inventoryItemId },
        });
        await tx.activityLog.create({
          data: {
            action: "link_inventory",
            targetType: "purchase",
            targetId: id,
            metadataJson: {
              previousId: purchase.linkedInventoryItemId,
              nextId: input.inventoryItemId,
              noStockMovement: true,
            },
          },
        });
        return tx.purchaseRequest.update({
          where: { id },
          data: { linkedInventoryItemId: input.inventoryItemId },
        });
      }
      const received = purchase.receipts.reduce(
        (sum, r) => sum + r.quantity,
        0,
      );
      // Old received records are already received: migration must not receive them a second time.
      if (
        purchase.status === "received" ||
        received + input.quantity > purchase.quantity + 1e-9
      )
        throw new Error(
          "收货超过未收数量。 / Receipt exceeds outstanding quantity.",
        );
      let inventoryItemId: string | undefined;
      if (input.inventory === "new") {
        const item = await tx.inventoryItem.create({
          data: {
            name: purchase.title,
            vendor: purchase.vendor,
            catalogNumber: purchase.catalogNumber,
            lotNumber: purchase.lotNumber,
            currentQuantity: input.quantity,
            unit: purchase.unit,
          },
        });
        inventoryItemId = item.id;
      }
      if (input.inventory === "existing") {
        if (!input.inventoryItemId)
          throw new Error("请选择库存。 / Select stock.");
        const item = await tx.inventoryItem.findUniqueOrThrow({
          where: { id: input.inventoryItemId },
        });
        if (
          item.status !== "active" ||
          !item.quantityRecorded ||
          item.unit !== purchase.unit
        )
          throw new Error(
            "库存状态或单位不匹配，请检查后收货。 / Stock state or unit does not match.",
          );
        if (item.managementMode === "package") {
          if (!Number.isInteger(input.quantity) || input.quantity > 1000)
            throw new Error("包装收货必须为不超过1000的整数。");
          await tx.inventoryContainer.createMany({
            data: Array.from({ length: input.quantity }, () => ({
              inventoryItemId: item.id,
              location: item.positionCode,
            })),
          });
        }
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { currentQuantity: { increment: input.quantity } },
        });
        inventoryItemId = item.id;
      }
      if (inventoryItemId)
        await tx.inventoryTransaction.create({
          data: {
            inventoryItemId,
            purchaseId: id,
            type: "receive",
            quantityChange: input.quantity,
            unit: purchase.unit,
            clientMutationId: input.clientMutationId,
            notes: "Confirmed partial purchase receipt.",
          },
        });
      const changed = await tx.purchaseRequest.updateMany({
        where: { id, updatedAt: purchase.updatedAt },
        data: {
          status:
            received + input.quantity >= purchase.quantity - 1e-9
              ? "received"
              : "ordered",
          receivedDate: new Date(),
        },
      });
      if (changed.count !== 1)
        throw new Error("采购记录已变化，请刷新后重试。");
      return tx.purchaseReceipt.create({
        data: {
          purchaseId: id,
          quantity: input.quantity,
          inventoryItemId,
          clientMutationId: input.clientMutationId,
        },
      });
    });
  } catch (error) {
    if (input.action === "receive") {
      const replay = await prisma.purchaseReceipt.findUnique({
        where: { clientMutationId: input.clientMutationId },
      });
      if (replay?.purchaseId === id) return replay;
    }
    throw error;
  }
}
