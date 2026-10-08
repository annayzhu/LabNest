import { createHash } from "node:crypto";
import type { AIGenerationResult, AIProviderConfig, EntryToActionPromptInput } from "./ai";
import { prisma } from "./db";
import { lockEntrySourceGraph } from "./entry-source-lock";
import { getEntryMarkdown } from "./entry-content";

export class AIProposalConflict extends Error {}

export type ProposalResponse = AIGenerationResult & {
  status: "validated";
  provider: string;
  count: number;
  persisted: number;
  note: string;
  replayed?: boolean;
};

export function proposalResponse(result: AIGenerationResult, providerName: string, persisted = 0): ProposalResponse {
  return { ...result, status: "validated", provider: providerName, count: result.actions.length, persisted,
    note: persisted ? "Saved as pending suggestions. Review and execution controls are not implemented yet; nothing was executed." : "These are proposed actions only. LabNest has not mutated any record." };
}

/** One browser request produces one pending batch, including concurrent or ambiguous retries. */
export async function saveAIProposals(options: {
  clientMutationId: string;
  entryId: string;
  input: EntryToActionPromptInput;
  provider: AIProviderConfig;
  generate: () => Promise<AIGenerationResult>;
}): Promise<ProposalResponse> {
  const requestId = `ai-generate-${options.clientMutationId}`;
  const fingerprint = createHash("sha256").update(JSON.stringify({ entryId: options.entryId, input: options.input,
    providerId: options.provider.id, model: options.provider.defaultModel })).digest("hex");
  return prisma.$transaction(async tx => {
    // The per-request lock is held during the model call, but the shared source
    // graph is locked only while publishing. Unrelated entry edits remain free.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${requestId}, 0))::text`;
    const previous = await tx.activityLog.findUnique({ where: { id: requestId } });
    if (previous) {
      const metadata = previous.metadataJson as { fingerprint?: string; response?: ProposalResponse };
      if (previous.action !== "ai_propose" || previous.targetId !== options.entryId || metadata.fingerprint !== fingerprint || !metadata.response) {
        throw new AIProposalConflict("This request ID belongs to different input. Start a new request.");
      }
      return { ...metadata.response, replayed: true };
    }
    const result = await options.generate();
    await lockEntrySourceGraph(tx);
    await tx.$queryRaw`SELECT id FROM "Entry" WHERE id=${options.entryId} FOR UPDATE`;
    const source = await tx.entry.findUnique({ where: { id: options.entryId }, select: { id: true, title: true, body: true, contentJson: true } });
    if (!source) {
      throw new AIProposalConflict("The source entry was removed during generation. Nothing was saved.");
    }
    if (source.title !== options.input.entryTitle || getEntryMarkdown(source.contentJson, source.body).trim() !== options.input.entryBody) {
      throw new AIProposalConflict("The source entry changed during generation. Review the new content and start a new request.");
    }
    const actions = [];
    for (const action of result.actions) {
      const record = await tx.proposedAction.create({ data: { sourceType: "ai", sourceId: options.entryId,
        actionType: action.actionType, status: "pending", reason: action.reason, payloadJson: JSON.parse(JSON.stringify(action.payload)) } });
      actions.push({ ...action, id: record.id, sourceType: "ai" as const, createdAt: record.createdAt.toISOString() });
    }
    const response = proposalResponse({ ...result, actions }, options.provider.name, actions.length);
    await tx.activityLog.create({ data: { id: requestId, action: "ai_propose", targetType: "entry", targetId: options.entryId,
      metadataJson: JSON.parse(JSON.stringify({ fingerprint, provider: options.provider.name, model: result.model ?? null, count: actions.length, response })) } });
    return response;
  }, { maxWait: 10_000, timeout: 75_000 });
}
