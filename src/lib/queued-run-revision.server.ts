import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';

export const queuedRunContextSchema = z.object({
  deviceId: z.string().uuid(),
  actor: z.literal('local-workspace-user'),
  sourceRef: z.string().min(1),
  predecessorMutationId: z.string().uuid().optional(),
});
export type QueuedRunContext = z.infer<typeof queuedRunContextSchema>;

/** Advance only across a receipt from this device's exact queued chain, never across another writer. */
export async function queuedRunRevision(tx: Prisma.TransactionClient, input: { experimentId: string; expectedRevision: number; queueContext?: QueuedRunContext }) {
  const context = input.queueContext;
  if (!context?.predecessorMutationId) return input.expectedRevision;
  const predecessor = await tx.experimentStepEvent.findUnique({ where: { clientMutationId: context.predecessorMutationId } });
  const receipt = predecessor?.payloadJson as { queueContext?: QueuedRunContext; clientBaseRevision?: number; resultingRevision?: number } | undefined;
  if (predecessor?.experimentId !== input.experimentId || receipt?.queueContext?.deviceId !== context.deviceId || receipt.clientBaseRevision !== input.expectedRevision || typeof receipt.resultingRevision !== 'number') throw new Error('前一条本机操作尚未同步或版本不一致，请核对同步队列。');
  return receipt.resultingRevision;
}
