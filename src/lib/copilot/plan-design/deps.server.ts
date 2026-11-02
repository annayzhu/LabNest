import { availabilityFromSettings, resolveAdapterForProvider, resolveConnectedAdapter } from '../../ai-server';
import { prisma } from '../../db';
import { protocolChoices } from './context.server';
import type { DesignDeps } from './workflow';

/** What the workbench tells the author before a model step: whether AI is on, which service drafts and which reviews. */
export async function designReadiness() {
  const settings = await prisma.aISettings.findUnique({ where: { id: 'default' }, include: { defaultProvider: true, reviewProvider: true } });
  const availability = availabilityFromSettings(settings);
  const reviewer = settings?.reviewProvider?.enabled ? settings.reviewProvider : undefined;
  return {
    ready: availability.enabled && availability.connected, reason: availability.reason, providerName: availability.providerName,
    reviewProviderName: reviewer?.name ?? availability.providerName, selfReview: !reviewer || reviewer.id === availability.providerId,
  };
}
export type DesignReadiness = Awaited<ReturnType<typeof designReadiness>>;

/**
 * The real models for one step. Drafting and reviewing hold separate gates: a change to the AI settings, or to either
 * service, while a step waits on a model throws the result away. No tool calls are needed (Q311).
 */
export async function prepareDesignStep(planId: string, purpose: string) {
  const resolved = await resolveConnectedAdapter({ timeoutMs: 240_000 });
  if (!resolved.ok) throw new Error(resolved.error);
  const { adapter, config, gate } = resolved;
  if (!adapter.complete) throw new Error(`The service “${config.name}” cannot write text; choose another default service on the AI page`);
  const complete: DesignDeps['complete'] = (system, user, options) => adapter.complete!(system, user, options);
  const settings = await prisma.aISettings.findUniqueOrThrow({ where: { id: 'default' } });
  let review: DesignDeps['review'] = { complete, provider: config.name, selfReview: true };
  let reviewGate: { assertAllowed: () => Promise<void> } | undefined;
  let reviewProviderId = config.id;
  if (settings.reviewProviderId && settings.reviewProviderId !== config.id) {
    const reviewer = await resolveAdapterForProvider(settings.reviewProviderId, settings.updatedAt.toISOString(), { timeoutMs: 240_000 });
    if (!reviewer.ok) throw new Error(`Review service: ${reviewer.error}`);
    if (!reviewer.adapter.complete) throw new Error(`The review service “${reviewer.config.name}” cannot write text`);
    review = { complete: (system, user, options) => reviewer.adapter.complete!(system, user, options), provider: reviewer.config.name, selfReview: false };
    reviewGate = reviewer.gate;
    reviewProviderId = reviewer.config.id;
  }
  const deps: DesignDeps = { now: () => new Date(), complete, review, protocols: await protocolChoices(planId, purpose) };
  return { deps, provider: config.name, providerIds: { drafting: config.id, review: reviewProviderId }, assertAllowed: async () => { await gate.assertAllowed(); await reviewGate?.assertAllowed(); } };
}
export type PreparedStep = Awaited<ReturnType<typeof prepareDesignStep>>;
