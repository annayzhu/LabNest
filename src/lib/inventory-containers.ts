import { z } from "zod";
import { prisma } from "@/lib/db";

export const containerCommand = z.object({
  action: z.enum(["issue", "open", "transfer", "return", "empty", "observe"]),
  containerId: z.string().min(1),
  clientMutationId: z.string().uuid(),
  holder: z.string().trim().min(1).max(120).optional(),
  location: z.string().trim().max(240).optional(),
  openedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  remaining: z.number().finite().nonnegative().optional(),
  unit: z.enum(["mL", "µL", "L", "mg", "g"]).optional(),
  quality: z.enum(["estimated", "measured"]).optional(),
  performedBy: z.string().trim().min(1).max(120).optional(),
  experimentId: z.string().min(1).optional(),
});

export async function readInventoryContainers(inventoryItemId: string) {
  const item = await prisma.inventoryItem.findUniqueOrThrow({
    where: { id: inventoryItemId },
    include: {
      containers: {
        orderBy: { createdAt: "asc" },
        include: {
          observations: { orderBy: { createdAt: "desc" } },
          events: { orderBy: { createdAt: "desc" } },
        },
      },
      transactions: { orderBy: { createdAt: "desc" } },
    },
  });
  return {
    ...item,
    warehouse: item.containers.filter((c) => c.state === "warehouse").length,
    held: item.containers.filter((c) => c.state === "held").length,
    empty: item.containers.filter((c) => c.state === "empty").length,
  };
}

export async function commandInventoryContainer(
  inventoryItemId: string,
  raw: unknown,
) {
  const input = containerCommand.parse(raw);
  const replay = await prisma.inventoryContainerEvent.findUnique({
    where: { clientMutationId: input.clientMutationId },
  });
  if (replay) {
    if (
      replay.containerId !== input.containerId ||
      replay.action !== input.action
    )
      throw new Error(
        "重复请求编号对应其他操作。 / Mutation key belongs to another operation.",
      );
    return replay;
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const bottle = await tx.inventoryContainer.findUniqueOrThrow({
        where: { id: input.containerId },
        include: { inventoryItem: true },
      });
      if (
        bottle.inventoryItemId !== inventoryItemId ||
        bottle.inventoryItem.status !== "active" ||
        bottle.inventoryItem.managementMode !== "package"
      )
        throw new Error("该实物不可操作。 / Container is unavailable.");
      if (bottle.state === "empty")
        throw new Error("该瓶已用完，历史保持不变。 / Container is empty.");
      const patch: {
        state?: string;
        holder?: string | null;
        location?: string;
        openedAt?: Date;
      } = {};
      if (input.action === "issue") {
        if (bottle.state !== "warehouse" || !input.holder)
          throw new Error(
            "请选择仓库实物并填写领用人。 / Select warehouse stock and a holder.",
          );
        patch.state = "held";
        patch.holder = input.holder;
      }
      if (input.action === "transfer") {
        if (bottle.state !== "held" || !input.holder)
          throw new Error(
            "转交需要当前持有的实物和接收人。 / Transfer needs held stock and a recipient.",
          );
        patch.holder = input.holder;
      }
      if (input.action === "return") {
        if (bottle.state !== "held")
          throw new Error(
            "只有已领用实物可归还。 / Only held stock can be returned.",
          );
        patch.state = "warehouse";
        patch.holder = null;
      }
      if (input.action === "empty") patch.state = "empty";
      if (input.location !== undefined) patch.location = input.location;
      if (input.action === "open") {
        if (bottle.openedAt)
          throw new Error(
            "开封日期已记录。 / Opened date is already recorded.",
          );
        if (!input.openedAt)
          throw new Error("请填写开封日期。 / Opened date is required.");
        const date = new Date(input.openedAt + "T00:00:00Z");
        if (
          !Number.isFinite(date.getTime()) ||
          date.toISOString().slice(0, 10) !== input.openedAt
        )
          throw new Error("无效日期。 / Invalid date.");
        patch.openedAt = date;
      }
      if (input.action === "observe") {
        if (input.remaining === undefined || !input.unit || !input.performedBy)
          throw new Error(
            "请填写余量、单位和登记人。 / Remaining amount, unit and recorder are required.",
          );
        if (input.experimentId)
          await tx.experiment.findUniqueOrThrow({
            where: { id: input.experimentId },
            select: { id: true },
          });
        await tx.inventoryObservation.create({
          data: {
            containerId: bottle.id,
            remaining: input.remaining,
            unit: input.unit,
            quality: input.quality ?? "estimated",
            performedBy: input.performedBy,
            experimentId: input.experimentId,
          },
        });
      }
      // Compare-and-swap prevents a concurrent issue/return from changing the same physical bottle twice.
      const changed = await tx.inventoryContainer.updateMany({
        where: { id: bottle.id, version: bottle.version },
        data: { ...patch, version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new Error(
          "实物状态已变化，请刷新后重试。 / Container changed; refresh before retrying.",
        );
      const nextState = patch.state ?? bottle.state;
      const warehouseChange =
        Number(nextState === "warehouse") -
        Number(bottle.state === "warehouse");
      if (warehouseChange) {
        await tx.inventoryItem.update({
          where: { id: inventoryItemId },
          data: { currentQuantity: { increment: warehouseChange } },
        });
        await tx.inventoryTransaction.create({
          data: {
            inventoryItemId,
            type: input.action === "empty" ? "discard" : "transfer",
            quantityChange: warehouseChange,
            unit: bottle.inventoryItem.unit,
            performedBy: input.performedBy,
            clientMutationId: input.clientMutationId,
            notes: `Container ${bottle.id}: ${input.action}; physical movement, not inferred liquid consumption.`,
          },
        });
      }
      const event = await tx.inventoryContainerEvent.create({
        data: {
          containerId: bottle.id,
          action: input.action,
          performedBy: input.performedBy,
          clientMutationId: input.clientMutationId,
          snapshotJson: {
            before: {
              state: bottle.state,
              holder: bottle.holder,
              location: bottle.location,
              openedAt: bottle.openedAt?.toISOString() ?? null,
            },
            after: {
              state: nextState,
              holder: patch.holder === undefined ? bottle.holder : patch.holder,
              location: patch.location ?? bottle.location,
              openedAt:
                patch.openedAt?.toISOString() ??
                bottle.openedAt?.toISOString() ??
                null,
            },
          },
        },
      });
      return event;
    });
  } catch (error) {
    const replay = await prisma.inventoryContainerEvent.findUnique({
      where: { clientMutationId: input.clientMutationId },
    });
    if (
      replay &&
      replay.containerId === input.containerId &&
      replay.action === input.action
    )
      return replay;
    throw error;
  }
}
