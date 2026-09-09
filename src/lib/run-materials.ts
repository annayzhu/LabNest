import { z } from "zod";
import { prisma } from "@/lib/db";
import { convert } from "@/lib/calculators/quantities";
const rowInput = z.object({
  action: z.literal("save"),
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(240),
  expected: z.number().finite().nonnegative().nullable().optional(),
  actual: z.number().finite().nonnegative().nullable().optional(),
  unit: z.string().trim().max(32).default(""),
  source: z.string().trim().min(1).max(1000).default("manual"),
  inventoryItemId: z.string().min(1).nullable().optional(),
  containerId: z.string().min(1).nullable().optional(),
  correctionOfId: z.string().uuid().nullable().optional(),
}).refine(row => (row.expected == null && row.actual == null) || Boolean(row.unit), { message: "填写用量时请选择单位。", path: ["unit"] });
async function editable(id: string) {
  const run = await prisma.experiment.findUniqueOrThrow({ where: { id } });
  if (run.status === "archived")
    throw new Error("Archived Run cannot be changed.");
}
export async function saveRunMaterial(experimentId: string, raw: unknown) {
  await editable(experimentId);
  const { action: _, ...input } = rowInput.parse(raw);
  return prisma.$transaction(async (tx) => {
    // Save and confirmation share one lock, including the first save when no row exists.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`run-material:${input.id}`},0))::text`;
    const ruleKey = input.source.startsWith('Consumption:') ? input.source.split('|')[0] : null;
    if (ruleKey && !input.correctionOfId) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`run-rule:${experimentId}:${ruleKey}`},0))::text`;
      const duplicate = await tx.runMaterialUse.findFirst({where:{experimentId,id:{not:input.id},OR:[{source:ruleKey},{source:{startsWith:ruleKey+'|'}}]}});
      if (duplicate) throw new Error('该规程规则已带入，请编辑已有记录，避免重复累加。');
    }
    const previous = await tx.runMaterialUse.findUnique({
      where: { id: input.id },
    });
    if (
      previous &&
      (previous.experimentId !== experimentId ||
        previous.status === "submitted")
    )
      throw new Error(
        "已提交记录不可改写；请登记更正。 / Submitted record is immutable; add a correction.",
      );
    if (input.containerId) {
      const bottle = await tx.inventoryContainer.findUniqueOrThrow({
        where: { id: input.containerId },
      });
      if (
        bottle.inventoryItemId !== input.inventoryItemId ||
        bottle.state !== "held"
      )
        throw new Error("请选择匹配且已领用的瓶。");
    }
    const stock = input.inventoryItemId
      ? await tx.inventoryItem.findUniqueOrThrow({
          where: { id: input.inventoryItemId },
        })
      : null;
    if (input.correctionOfId) {
      const original = await tx.runMaterialUse.findUniqueOrThrow({
        where: { id: input.correctionOfId },
      });
      if (
        original.experimentId !== experimentId ||
        original.status !== "submitted" ||
        original.inventoryItemId !== input.inventoryItemId ||
        input.containerId
      )
        throw new Error("更正必须关联同一Run的原扣减及原库存。");
    }
    const status =
      input.inventoryItemId &&
      !input.containerId &&
      stock?.managementMode !== "information"
        ? "pending"
        : "recorded";
    return tx.runMaterialUse.upsert({
      where: { id: input.id },
      create: { ...input, experimentId, status },
      update: { ...input, status, error: null },
    });
  });
}
export async function confirmRunMaterials(experimentId: string, raw: unknown) {
  await editable(experimentId);
  const { ids } = z
    .object({ ids: z.array(z.string().uuid()).max(200) })
    .parse(raw);
  const outcomes = [];
  for (const id of [...new Set(ids)]) {
    try {
      const row = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`run-material:${id}`},0))::text`;
        const row = await tx.runMaterialUse.findUniqueOrThrow({
          where: { id },
        });
        if (row.experimentId !== experimentId)
          throw new Error("材料不属于当前Run。");
        if (
          row.status === "submitted" ||
          !row.inventoryItemId ||
          row.containerId
        )
          return row;
        const item = await tx.inventoryItem.findUniqueOrThrow({
          where: { id: row.inventoryItemId },
        });
        if (item.managementMode === "information")
          return tx.runMaterialUse.update({
            where: { id },
            data: { status: "recorded", error: null },
          });
        if (
          item.managementMode !== "precise" ||
          !item.quantityRecorded ||
          item.status !== "active"
        )
          throw new Error("请选择有效精确库存或已领用的具体瓶。");
        if (row.actual === null) throw new Error("请先确认实际用量。");
        const amount =
          row.unit === item.unit
            ? row.actual
            : convert(row.actual, row.unit, item.unit);
        let prior = 0;
        if (row.correctionOfId) {
          const original = await tx.runMaterialUse.findUniqueOrThrow({
            where: { id: row.correctionOfId },
          });
          if (original.actual === null) throw new Error("原记录没有实际量。");
          prior =
            original.unit === item.unit
              ? original.actual
              : convert(original.actual, original.unit, item.unit);
        }
        const delta = Number((prior - amount).toPrecision(12));
        const next = item.currentQuantity + delta;
        if (!Number.isFinite(next) || next < 0)
          throw new Error(
            `库存不足；可用 ${item.currentQuantity} ${item.unit}。`,
          );
        const changed = await tx.inventoryItem.updateMany({
          where: {
            id: item.id,
            currentQuantity: item.currentQuantity,
            updatedAt: item.updatedAt,
          },
          data: { currentQuantity: next },
        });
        if (changed.count !== 1) throw new Error("库存已变化，请重试。");
        const transaction = await tx.inventoryTransaction.create({
          data: {
            inventoryItemId: item.id,
            experimentId,
            type: row.correctionOfId ? "adjust" : "consume",
            quantityChange: delta,
            unit: item.unit,
            clientMutationId: id,
            notes: row.correctionOfId
              ? `Explicit correction of material use ${row.correctionOfId}`
              : `Confirmed material use ${id}; source ${row.source}`,
          },
        });
        return tx.runMaterialUse.update({
          where: { id },
          data: {
            transactionId: transaction.id,
            status: "submitted",
            error: null,
          },
        });
      });
      outcomes.push({ id, status: row.status });
    } catch (error) {
      const saved = await prisma.runMaterialUse.findUnique({ where: { id } });
      if (saved?.experimentId !== experimentId) {
        outcomes.push({ id, status: "failed" });
        continue;
      }
      if (saved.status === "submitted") {
        outcomes.push({ id, status: "submitted" });
        continue;
      }
      const message = error instanceof Error ? error.message : "提交失败";
      await prisma.runMaterialUse.updateMany({
        where: { id, status: { not: "submitted" } },
        data: { error: message, status: "pending" },
      });
      outcomes.push({ id, status: "pending", error: message });
    }
  }
  return outcomes;
}

/** Removal is only for unposted records. Posted ledger history stays immutable. */
export async function deleteRunMaterial(experimentId: string, raw: unknown) {
  await editable(experimentId);
  const { id } = z.object({ id: z.string().uuid() }).parse(raw);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`run-material:${id}`},0))::text`;
    const row = await tx.runMaterialUse.findUnique({where:{id}});
    if (!row) return {id, deleted:true}; // retry after successful deletion
    if (row.experimentId !== experimentId) throw new Error("材料不属于当前实验。");
    if (row.status === "submitted" || row.transactionId) throw new Error("已扣减记录不可删除；请登记更正，保留原流水。");
    await tx.runMaterialUse.delete({where:{id}});
    return {id, deleted:true};
  });
}
