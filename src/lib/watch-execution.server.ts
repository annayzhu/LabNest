import { createHash, randomBytes, randomInt } from 'node:crypto';
import { z } from 'zod';
import { prisma } from './db';
import { assertRecordEditable } from './record-lifecycle';
import { structuredRunView, assertStructuredStepExecutable, mixState, runStepNotes, stepMixes } from './structured-run';
import { chipAmount } from './protocol-chips';
import { mixPer, mixTitle } from './protocol-mix';
import { executionBlockText } from './protocol-execution';
import type { ProtocolContentBlock } from './protocol-document';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const pairingLifetime = 600_000;
export class WatchPairingRateLimitError extends Error {
  constructor() { super('尝试过多，请 10 分钟后再配对。'); }
}
/** A mix card as the watch reads it: lines only once confirmed; otherwise a note to confirm on the phone. */
type WatchMix = { id: string; title: string; per: string; stale: boolean; note?: string; quantity?: number; aliquot?: string; lines?: Array<{ id: string; name: string; mode: 'premix' | 'separate'; total: string; perReaction: string; struck: boolean }> };

/** Keep instructions and explicit warnings on the wrist; ordinary surrounding notes remain in details. */
export function watchStepText(content: ProtocolContentBlock[], before: ProtocolContentBlock[] = [], after: ProtocolContentBlock[] = []) {
  const warning = (block: ProtocolContentBlock) => block.type === 'callout' && block.tone !== 'note';
  const text = (blocks: ProtocolContentBlock[]) => blocks.map(executionBlockText).join('\n\n');
  return { instruction: text([...before.filter(warning), ...content, ...after.filter(warning)]), text: text([...before, ...content, ...after]) };
}

/** Pairing is initiated from 现场模式 on the computer or phone, for one experiment only. The code works once, for 10 minutes. */
export async function createWatchPairing(experimentId: string) {
  const experiment = await prisma.experiment.findUniqueOrThrow({ where: { id: experimentId } });
  assertRecordEditable(experiment.recordStatus);
  return prisma.$transaction(async tx => {
    // Reserve codes across experiments, including consumed codes, for their full lifetime.
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext('watch-pairing'))`;
    const recent = await tx.activityLog.findMany({ where: { action: 'watch_pairing_created', createdAt: { gte: new Date(Date.now() - pairingLifetime) } }, select: { metadataJson: true } });
    const reserved = new Set(recent.map(row => (row.metadataJson as { codeHash: string }).codeHash));
    const start = randomInt(10_000);
    for (let offset = 0; offset < 10_000; offset++) {
      const code = String((start + offset) % 10_000).padStart(4, '0');
      if (reserved.has(hash(code))) continue;
      const expiresAt = new Date(Date.now() + pairingLifetime).toISOString();
      await tx.activityLog.create({ data: { action: 'watch_pairing_created', targetType: 'experiment', targetId: experimentId, metadataJson: { codeHash: hash(code), expiresAt } } });
      return { code, expiresAt };
    }
    throw new Error('配对码暂时用完，请 10 分钟后重试。');
  });
}
/** Whether a watch currently follows this experiment: the latest claim, unless it has expired or was revoked since. */
export async function watchConnection(experimentId: string) {
  const [claim, revoked] = await Promise.all([
    prisma.activityLog.findFirst({ where: { action: 'watch_pairing_claimed', targetType: 'experiment', targetId: experimentId }, orderBy: { createdAt: 'desc' } }),
    prisma.activityLog.findFirst({ where: { action: 'watch_pairings_revoked', targetType: 'experiment', targetId: experimentId }, orderBy: { createdAt: 'desc' } }),
  ]);
  const expiresAt = (claim?.metadataJson as { expiresAt?: string } | null)?.expiresAt;
  const connected = Boolean(claim && expiresAt && Date.parse(expiresAt) > Date.now() && (!revoked || revoked.createdAt < claim.createdAt));
  return connected && claim ? { connected: true as const, since: claim.createdAt.toISOString() } : { connected: false as const };
}
export async function claimWatchPairing(rawCode: unknown, rawDeviceId: unknown) {
  const code = z.string().trim().regex(/^[0-9]{4}$/).parse(rawCode);
  const deviceId = z.string().uuid().parse(rawDeviceId);
  const result = await prisma.$transaction(async tx => {
    const digest = hash(code);
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext('watch-pairing'))`;
    // This local-workspace endpoint has no authenticated caller. A database-wide limit
    // cannot be bypassed by inventing device IDs, forwarded IPs, or another server process.
    const failures = await tx.activityLog.count({ where: { action: 'watch_pairing_failed', createdAt: { gte: new Date(Date.now() - pairingLifetime) } } });
    if (failures >= 5) return { error: 'limited' as const };
    const pairing = await tx.activityLog.findFirst({ where: { action: 'watch_pairing_created', metadataJson: { path: ['codeHash'], equals: digest } }, orderBy: { createdAt: 'desc' } });
    const valid = pairing && Date.parse((pairing.metadataJson as { expiresAt: string }).expiresAt) > Date.now()
      && !await tx.activityLog.findFirst({ where: { action: 'watch_pairing_claimed', metadataJson: { path: ['pairingId'], equals: pairing.id } } })
      && !await tx.activityLog.findFirst({ where: { action: 'watch_pairings_revoked', targetType: 'experiment', targetId: pairing.targetId, createdAt: { gte: pairing.createdAt } } });
    if (!valid || !pairing) {
      await tx.activityLog.create({ data: { action: 'watch_pairing_failed', targetType: 'watch', targetId: 'pairing' } });
      // Return, then throw outside the transaction so the failed attempt is committed.
      return { error: 'invalid' as const };
    }
    const token = randomBytes(32).toString('base64url');
    await tx.activityLog.create({ data: { action: 'watch_pairing_claimed', targetType: 'experiment', targetId: pairing.targetId, metadataJson: { pairingId: pairing.id, tokenHash: hash(token), deviceId, expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString() } } });
    return { token, experimentId: pairing.targetId };
  });
  if ('error' in result) {
    if (result.error === 'limited') throw new WatchPairingRateLimitError();
    throw new Error('配对码失效或已使用，请在网页重新生成。');
  }
  return result;
}
export async function revokeWatchPairings(experimentId: string) {
  await prisma.activityLog.create({ data: { action: 'watch_pairings_revoked', targetType: 'experiment', targetId: experimentId } });
}
export async function authorizeWatch(token: string, experimentId: string) {
  if (!/^[\w-]{43}$/.test(token)) throw new Error('手表连接已失效，请重新配对。');
  const grant = await prisma.activityLog.findFirst({ where: { action: 'watch_pairing_claimed', targetType: 'experiment', targetId: experimentId, metadataJson: { path: ['tokenHash'], equals: hash(token) } } });
  const metadata = grant?.metadataJson as { expiresAt?: string; deviceId: string } | undefined;
  const revoked = grant && await prisma.activityLog.findFirst({ where: { action: 'watch_pairings_revoked', targetType: 'experiment', targetId: experimentId, createdAt: { gte: grant.createdAt } } });
  if (!grant || !metadata?.expiresAt || Date.parse(metadata.expiresAt) <= Date.now() || revoked) throw new Error('手表连接已失效，请重新配对。');
  return metadata.deviceId;
}
export async function watchRunSnapshot(experimentId: string) {
  const experiment = await prisma.experiment.findUniqueOrThrow({ where: { id: experimentId }, include: { steps: { orderBy: [{ groupOrder: 'asc' }, { order: 'asc' }] }, protocolRun: true } });
  const view = structuredRunView(experiment.protocolSnapshotJson, experiment.protocolRun?.executionPlanJson, experiment.steps);
  let editable = true;
  try { assertRecordEditable(experiment.recordStatus); } catch { editable = false; }
  editable &&= !['archived', 'completed'].includes(experiment.status);
  // The Protocol's notes read where they were written: before the step, or after the last one.
  const notes = runStepNotes(view);
  const steps = experiment.steps.filter(step => view.steps[step.id]?.applicability !== 'not-applicable').map(step => {
    const resolved = view.steps[step.id];
    let canComplete = Boolean(resolved && editable && !step.completed && !step.timerStartedAt);
    try { assertStructuredStepExecutable(view, step.id, view.plan.revision, true); } catch { canComplete = false; }
    const duration = step.timerDurationSeconds ?? resolved?.timerDurationSeconds ?? null;
    const mixes = resolved ? stepMixes(view, step.id).map((mix): WatchMix => {
      const state = mixState(view, step.id, mix), card = { id: mix.id, title: mixTitle(mix), per: mixPer(mix) };
      if (!state.receipt) return { ...card, stale: true, note: '尚未确认，请在手机上确认。' };
      if (!state.current) return { ...card, stale: true, note: '数值已变化，请在手机上重新确认。' };
      const struck = new Set(view.plan.mixStrikes[`${step.id}:${mix.id}`] ?? []);
      return { ...card, stale: false, quantity: state.receipt.quantity, aliquot: state.receipt.aliquot,
        lines: state.receipt.lines.map(line => ({ id: line.id, name: line.name, mode: line.mode, total: chipAmount(Number(line.total.toPrecision(4)), line.unit), perReaction: chipAmount(line.perReaction, line.unit), struck: struck.has(line.id) })) };
    }) : [];
    const text = resolved ? watchStepText(resolved.content_blocks ?? [], notes.before[step.id], notes.after[step.id]) : { instruction: step.description, text: step.description };
    return { mixes, ...text, id: step.id, sourceRef: step.protocolStepRef ?? step.id, title: resolved?.title ?? step.title, group: resolved?.groupLabel ?? '当前实验组', completed: step.completed, canComplete, blocked: resolved?.blocked ?? true, skipped: view.plan.skips[step.id]?.reason ?? null, actualFields: resolved?.actualFields ?? [], actualValues: view.plan.actualValues[step.id] ?? {}, timer: { durationSeconds: duration, remainingSeconds: step.timerRemainingSeconds ?? duration, startedAt: step.timerStartedAt, pausedAt: step.timerPausedAt }, canTime: Boolean(resolved && editable && !resolved.blocked && !view.plan.skips[step.id] && !step.completed) };
  });
  return json({ experimentId, title: experiment.title, revision: view.plan.revision, serverTime: Date.now(), capturedAt: new Date().toISOString(), steps }) as { experimentId: string; title: string; revision: number; serverTime: number; capturedAt: string; steps: typeof steps };
}
