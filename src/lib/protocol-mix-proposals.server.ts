import { prisma } from './db';
import type { MixProposal, ProtocolMix } from './protocol-mix';

/** Bench-made mix cards offered to this Protocol. Gone once a saved version contains the card, or once dismissed. */
export async function protocolMixProposals(protocolId: string, document: unknown): Promise<MixProposal[]> {
  const [offered, dismissed] = await Promise.all([
    prisma.activityLog.findMany({ where: { action: 'protocol_mix_proposed', targetType: 'protocol', targetId: protocolId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.activityLog.findMany({ where: { action: 'protocol_mix_proposal_dismissed', targetType: 'protocol', targetId: protocolId }, select: { metadataJson: true } }),
  ]);
  const gone = new Set(dismissed.map(row => (row.metadataJson as { proposalId?: string }).proposalId));
  const saved = JSON.stringify(document ?? {});
  return offered.flatMap(row => {
    const data = row.metadataJson as { mix?: ProtocolMix; stepRef?: string; stepTitle?: string; runCode?: string };
    if (!data.mix || gone.has(row.id) || saved.includes(`"id":"${data.mix.id}"`)) return [];
    return [{ id: row.id, mix: data.mix, stepRef: data.stepRef, stepTitle: data.stepTitle, runCode: data.runCode, createdAt: row.createdAt.toISOString() }];
  });
}

export async function dismissMixProposal(protocolId: string, proposalId: string) {
  const proposal = await prisma.activityLog.findFirst({ where: { id: proposalId, action: 'protocol_mix_proposed', targetType: 'protocol', targetId: protocolId } });
  if (!proposal) throw new Error('提议不存在');
  await prisma.activityLog.create({ data: { action: 'protocol_mix_proposal_dismissed', targetType: 'protocol', targetId: protocolId, metadataJson: { proposalId } } });
}
