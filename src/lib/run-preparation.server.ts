import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from './db';
import { assertRecordEditable } from './record-lifecycle';
import { parseExecutionPlan } from './structured-run';

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const input = z.object({
  experimentId: z.string().min(1),
  key: z.string().regex(/^(material|mix|plate|equipment|timer):[^\p{C}]{1,240}$/u),
  done: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

/**
 * Tick one 实验准备 item "已备" (or untick it) and keep its note, under the Experiment lock like every other plan write.
 * A bench aid, like crossing off a mix line: not progress, no revision, one key per write so two devices never undo each other.
 */
export async function setPreparationItem(raw: z.input<typeof input>) {
  const request = input.parse(raw);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${request.experimentId} FOR UPDATE`;
    const experiment = await tx.experiment.findUniqueOrThrow({ where: { id: request.experimentId }, include: { protocolRun: true } });
    if (['archived', 'completed'].includes(experiment.status)) throw new Error('此执行已结束，准备清单不能再修改');
    assertRecordEditable(experiment.recordStatus);
    if (!experiment.protocolRun) throw new Error('此实验没有执行方案');
    const plan = parseExecutionPlan(experiment.protocolRun.executionPlanJson);
    const current = plan.preparation[request.key];
    const note = request.note === undefined ? current?.note : request.note || undefined;
    const preparation = { ...plan.preparation };
    if (!request.done && !note) delete preparation[request.key];
    else preparation[request.key] = { done: request.done, ...(request.done ? { doneAt: (current?.done ? current.doneAt : undefined) ?? new Date().toISOString() } : {}), ...(note ? { note } : {}) };
    await tx.protocolRun.update({ where: { experimentId: request.experimentId }, data: { executionPlanJson: json({ ...plan, preparation }) } });
  });
}
