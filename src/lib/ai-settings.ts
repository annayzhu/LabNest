import { prisma } from "./db";
import { availabilityFromSettings, visionFromSettings } from "./ai-server";

/** The existing deployment-wide singleton; reading a missing row must never opt in. */
export async function readAISettings() {
  const [settings, providerCount] = await Promise.all([
    prisma.aISettings.findUnique({ where: { id: "default" }, include: { defaultProvider: true, visionProvider: true } }),
    prisma.aIProvider.count(),
  ]);
  return {
    enabled: settings?.enabled ?? false,
    defaultProviderId: settings?.defaultProviderId ?? null,
    visionProviderId: settings?.visionProviderId ?? null,
    /** Whether a picture can be read now, and by which service. */
    vision: visionFromSettings(settings),
    attachmentsEnabled: settings?.attachmentsEnabled ?? false,
    externalDataPolicy: settings?.externalDataPolicy ?? "explicit_context",
    revision: settings?.updatedAt.toISOString() ?? "unset",
    availability: availabilityFromSettings(settings),
    /** For the setup guide: how many services exist, and whether the default one would work once the switch is on. */
    providerCount,
    setup: availabilityFromSettings({ enabled: true, defaultProvider: settings?.defaultProvider ?? null }),
  };
}

export type AISettingsView = Awaited<ReturnType<typeof readAISettings>>;
export type AISettingsChange = { revision: string } & (
  | { kind: "enabled"; enabled: boolean }
  | { kind: "configuration"; defaultProviderId: string | null; attachmentsEnabled: boolean; visionProviderId?: string | null }
);

export class AISettingsConflict extends Error {}

export async function changeAISettings(change: AISettingsChange) {
  await prisma.$transaction(async tx => {
    // Also serializes creation when no historical settings row exists yet.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('labnest-ai-settings', 0))::text`;
    const saved = await tx.aISettings.findUnique({ where: { id: "default" } });
    if ((saved?.updatedAt.toISOString() ?? "unset") !== change.revision) {
      throw new AISettingsConflict("设置已在其他页面更新，请重新读取后重试。");
    }
    if (change.kind === "configuration" && change.defaultProviderId) {
      if (!await tx.aIProvider.findUnique({ where: { id: change.defaultProviderId } })) {
        throw new AISettingsConflict("所选模型服务已不存在，请重新选择。");
      }
    }
    if (change.kind === "configuration" && change.visionProviderId && !await tx.aIProvider.findUnique({ where: { id: change.visionProviderId } })) {
      throw new AISettingsConflict("所选识别图片的服务已不存在，请重新选择。");
    }
    // An omitted photo service stays as it is: older pages and scripts never send it.
    const data = change.kind === "enabled" ? { enabled: change.enabled }
      : { defaultProviderId: change.defaultProviderId, attachmentsEnabled: change.attachmentsEnabled, ...(change.visionProviderId !== undefined ? { visionProviderId: change.visionProviderId } : {}) };
    // Millisecond-unique revisions also reject off→on responses and stale tab writes.
    const updatedAt = new Date(Math.max(Date.now(), (saved?.updatedAt.getTime() ?? 0) + 1));
    await tx.aISettings.upsert({ where: { id: "default" },
      create: { id: "default", ...data, updatedAt }, update: { ...data, updatedAt } });
  });
  return readAISettings();
}
