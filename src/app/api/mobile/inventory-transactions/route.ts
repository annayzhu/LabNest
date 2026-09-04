import { z } from "zod";
import { prisma } from "@/lib/db";

const inputSchema = z.object({
  inventoryItemId: z.string().min(1),
  type: z.enum(["receive", "consume", "discard", "return"]),
  quantity: z.number().finite().positive(),
  performedBy: z.string().max(120).optional(),
  experimentId: z.string().optional(),
  experimentStepId: z.string().optional(),
  purchaseId: z.string().optional(),
  notes: z.string().max(2000).optional(),
  clientMutationId: z.string().uuid(),
  deviceCreatedAt: z.coerce.date(),
});

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const replay = await prisma.inventoryTransaction.findUnique({ where: { clientMutationId: input.clientMutationId }, select: { id: true, inventoryItemId: true } });
    if (replay) return Response.json({ transactionId: replay.id, inventoryItemId: replay.inventoryItemId, replay: true });

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: input.inventoryItemId } });
      if (!item || item.status !== "active") throw new Error("Inventory item is missing or inactive.");
      if (input.experimentStepId) {
        const step = await tx.experimentStep.findFirst({ where: { id: input.experimentStepId, ...(input.experimentId ? { experimentId: input.experimentId } : {}) }, select: { id: true } });
        if (!step) throw new Error("The selected experiment step is no longer available.");
      }
      const inbound = input.type === "receive" || input.type === "return";
      const quantityChange = inbound ? input.quantity : -input.quantity;
      const nextQuantity = Number((item.currentQuantity + quantityChange).toFixed(6));
      if (nextQuantity < 0) throw new Error(`Stock changed while offline. Available: ${item.currentQuantity} ${item.unit}.`);
      const transaction = await tx.inventoryTransaction.create({ data: {
        inventoryItemId: item.id, type: input.type, quantityChange, unit: item.unit,
        fromLocationId: inbound ? undefined : item.locationId ?? undefined,
        toLocationId: inbound ? item.locationId ?? undefined : undefined,
        experimentId: input.experimentId, experimentStepId: input.experimentStepId,
        purchaseId: input.purchaseId, performedBy: input.performedBy, notes: input.notes,
        clientMutationId: input.clientMutationId, deviceCreatedAt: input.deviceCreatedAt,
      } });
      const updated = await tx.inventoryItem.updateMany({ where: { id: item.id, currentQuantity: item.currentQuantity }, data: { currentQuantity: nextQuantity } });
      if (updated.count !== 1) throw new Error("Stock changed while syncing. Review the latest quantity.");
      await tx.activityLog.create({ data: { action: input.type, targetType: "inventory_item", targetId: item.id, metadataJson: { quantityChange, unit: item.unit, experimentId: input.experimentId ?? null, experimentStepId: input.experimentStepId ?? null, clientMutationId: input.clientMutationId, deviceCreatedAt: input.deviceCreatedAt.toISOString() } } });
      return transaction;
    });
    return Response.json({ transactionId: result.id, inventoryItemId: result.inventoryItemId }, { status: 201 });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "Inventory movement could not be synchronized.";
    return Response.json({ error: message }, { status: 409 });
  }
}
