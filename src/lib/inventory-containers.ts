import { z } from "zod";
import { prisma } from "@/lib/db";
import { deleteBlockers, observationUnitValues, type KitComponentStates } from "@/lib/inventory";

export const containerCommand = z.object({
  action: z.enum(["issue", "open", "transfer", "return", "empty", "observe", "edit", "return_supplier", "component"]),
  containerId: z.string().min(1),
  clientMutationId: z.string().uuid(),
  holder: z.string().trim().min(1).max(120).optional(),
  location: z.string().trim().max(240).optional(),
  label: z.string().trim().max(80).optional(),
  openedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  remaining: z.number().finite().nonnegative().optional(),
  unit: z.enum(observationUnitValues).optional(),
  quality: z.enum(["estimated", "measured"]).optional(),
  performedBy: z.string().trim().min(1).max(120).optional(),
  experimentId: z.string().min(1).optional(),
  componentId: z.string().min(1).optional(),
  componentState: z.enum(["present", "used_up", "missing"]).optional(),
  componentLocation: z.string().trim().max(240).optional(),
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
    returned: item.containers.filter((c) => c.state === "returned").length,
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
        include: { inventoryItem: { include: { product: { select: { kitComponents: { select: { id: true, name: true } } } } } } },
      });
      if (
        bottle.inventoryItemId !== inventoryItemId ||
        bottle.inventoryItem.status !== "active" ||
        bottle.inventoryItem.managementMode !== "package"
      )
        throw new Error("该实物不可操作。 / Container is unavailable.");
      if (bottle.state === "returned")
        throw new Error("This container has been returned to the supplier.");
      // An empty container can still be relabelled, returned to the supplier, or have a remaining amount noted.
      if (bottle.state === "empty" && !["edit", "return_supplier", "observe"].includes(input.action))
        throw new Error("该瓶已用完，历史保持不变。 / Container is empty.");
      const patch: {
        state?: string;
        holder?: string | null;
        location?: string;
        label?: string | null;
        openedAt?: Date;
        componentStates?: KitComponentStates;
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
      // A cylinder (or any container) goes back to the supplier from the store or once empty.
      if (input.action === "return_supplier") {
        if (bottle.state === "held") throw new Error("Return the container to the store, or mark it empty, before returning it to the supplier.");
        patch.state = "returned";
        patch.holder = null;
      }
      if (input.action === "edit") patch.label = input.label || null;
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
      // Each box records which of its kit's components are used up or missing; present without a place is the default.
      if (input.action === "component") {
        const component = bottle.inventoryItem.product?.kitComponents.find((entry) => entry.id === input.componentId);
        if (!component || !input.componentState) throw new Error("Choose a component of this kit.");
        const states = { ...((bottle.componentStates ?? {}) as KitComponentStates) };
        if (input.componentState === "present" && !input.componentLocation) delete states[component.id];
        else states[component.id] = { state: input.componentState, ...(input.componentLocation ? { location: input.componentLocation } : {}) };
        patch.componentStates = states;
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
            type: input.action === "empty" || input.action === "return_supplier" ? "discard" : "transfer",
            quantityChange: warehouseChange,
            unit: bottle.inventoryItem.unit,
            performedBy: input.performedBy,
            clientMutationId: input.clientMutationId,
            notes: `Container ${bottle.label ?? bottle.id}: ${input.action}; physical movement, not inferred liquid consumption.`,
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
              label: bottle.label,
              holder: bottle.holder,
              location: bottle.location,
              openedAt: bottle.openedAt?.toISOString() ?? null,
              componentStates: bottle.componentStates ?? {},
            },
            after: {
              state: nextState,
              label: patch.label === undefined ? bottle.label : patch.label,
              holder: patch.holder === undefined ? bottle.holder : patch.holder,
              location: patch.location ?? bottle.location,
              openedAt:
                patch.openedAt?.toISOString() ??
                bottle.openedAt?.toISOString() ??
                null,
              componentStates: patch.componentStates ?? bottle.componentStates ?? {},
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

const addContainers = z.object({
  count: z.number().int().min(1, "Add at least one container.").max(1000),
  label: z.string().trim().max(80).optional(),
  location: z.string().trim().max(240).optional(),
  performedBy: z.string().trim().max(120).optional(),
  clientMutationId: z.string().uuid(),
});

/** New bottles, boxes or cylinders arriving for this stock: they go into the store and its count. */
export async function addInventoryContainers(inventoryItemId: string, raw: unknown) {
  const input = addContainers.parse(raw);
  if (await prisma.inventoryTransaction.findUnique({ where: { clientMutationId: input.clientMutationId } })) return;
  await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId } });
    if (!item || item.status !== "active" || item.managementMode !== "package") throw new Error("该实物不可操作。 / Container is unavailable.");
    await tx.inventoryContainer.createMany({ data: Array.from({ length: input.count }, (_, index) => ({ inventoryItemId, location: input.location, label: input.label ? (input.count === 1 ? input.label : `${input.label}-${index + 1}`) : null })) });
    await tx.inventoryItem.update({ where: { id: inventoryItemId }, data: { currentQuantity: { increment: input.count } } });
    await tx.inventoryTransaction.create({ data: { inventoryItemId, type: "receive", quantityChange: input.count, unit: item.unit, performedBy: input.performedBy, clientMutationId: input.clientMutationId, notes: `${input.count} container${input.count === 1 ? "" : "s"} added to the store.` } });
    await tx.activityLog.create({ data: { action: "add_containers", targetType: "inventory_item", targetId: inventoryItemId, metadataJson: { count: input.count, label: input.label ?? null } } });
  });
}

/** A container registered by mistake: only one that nobody has handled, read or used in an experiment can be deleted. */
export async function deleteInventoryContainer(inventoryItemId: string, containerId: string) {
  await prisma.$transaction(async (tx) => {
    const bottle = await tx.inventoryContainer.findFirst({ where: { id: containerId, inventoryItemId }, include: { inventoryItem: { select: { unit: true } } } });
    if (!bottle) throw new Error("This container no longer exists.");
    const blockers = deleteBlockers({
      containerActions: await tx.inventoryContainerEvent.count({ where: { containerId } }),
      observations: await tx.inventoryObservation.count({ where: { containerId } }),
      materialUses: await tx.runMaterialUse.count({ where: { containerId } }),
    });
    if (blockers.length) throw new Error(`This container has ${blockers.join(", ")}, so it cannot be deleted. Mark it empty instead.`);
    await tx.inventoryContainer.delete({ where: { id: containerId } });
    if (bottle.state === "warehouse") {
      await tx.inventoryItem.update({ where: { id: inventoryItemId }, data: { currentQuantity: { increment: -1 } } });
      await tx.inventoryTransaction.create({ data: { inventoryItemId, type: "adjust", quantityChange: -1, unit: bottle.inventoryItem.unit, notes: `Container ${bottle.label ?? bottle.id} deleted; it was registered by mistake.` } });
    }
    await tx.activityLog.create({ data: { action: "delete_container", targetType: "inventory_item", targetId: inventoryItemId, metadataJson: { containerId, label: bottle.label, state: bottle.state } } });
  });
}

/** A remaining-amount reading entered by mistake; readings never change stock, so removing one only corrects the record. */
export async function deleteInventoryObservation(inventoryItemId: string, observationId: string) {
  await prisma.$transaction(async (tx) => {
    const observation = await tx.inventoryObservation.findFirst({ where: { id: observationId, container: { inventoryItemId } } });
    if (!observation) throw new Error("This reading no longer exists.");
    await tx.inventoryObservation.delete({ where: { id: observationId } });
    await tx.activityLog.create({ data: { action: "delete_observation", targetType: "inventory_item", targetId: inventoryItemId, metadataJson: { containerId: observation.containerId, remaining: observation.remaining, unit: observation.unit, performedBy: observation.performedBy, recordedAt: observation.createdAt.toISOString() } } });
  });
}
