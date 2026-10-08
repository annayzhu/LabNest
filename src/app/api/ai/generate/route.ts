import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AI_LIMITS, AIProviderError, allowedProposedActionTypes } from "@/lib/ai";
import { resolveConnectedAdapter } from "@/lib/ai-server";
import { validateAIRequest } from "@/lib/ai-request";
import { AIProposalConflict, proposalResponse, saveAIProposals } from "@/lib/ai-proposals";
import { getEntryDetailRecord } from "@/lib/entries";
import type { ProposedAction } from "@/lib/types";

export const runtime = "nodejs";

const actionTypeEnum = z.enum(allowedProposedActionTypes as [ProposedAction["actionType"], ...ProposedAction["actionType"][]]);

const generateRequestSchema = z
  .object({
    entryId: z.string().trim().min(1).optional(),
    entryTitle: z.string().trim().min(1).max(AI_LIMITS.entryTitle).optional(),
    entryBody: z.string().trim().min(1).max(AI_LIMITS.entryBody).optional(),
    allowedActionTypes: z.array(actionTypeEnum).min(1).optional(),
    /** Persist the validated actions as pending ProposedAction records linked to the entry. Requires entryId. */
    persist: z.boolean().optional(),
    clientMutationId: z.string().uuid().optional(),
  })
  .refine((value) => value.entryId || (value.entryTitle && value.entryBody), {
    message: "Provide either entryId or entryTitle and entryBody.",
  })
  .refine(value => !value.persist || (value.entryId && value.clientMutationId), {
    message: "Saving proposals requires entryId and a unique clientMutationId.",
  });

/**
 * Sends explicit entry context to the configured model and returns reviewable proposed actions.
 * Nothing is executed. With `persist: true` the actions are stored as pending items in the review inbox.
 */
export async function POST(request: Request) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const resolved = await resolveConnectedAdapter();
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status });
  }
  const { adapter, config } = resolved;
  if (!adapter.generateProposedActions) {
    return Response.json({ error: `Provider "${config.name}" cannot generate proposed actions.` }, { status: 409 });
  }

  const parsed = generateRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let entryTitle = parsed.data.entryTitle ?? "";
  let entryBody = parsed.data.entryBody ?? "";
  const entryId = parsed.data.entryId;
  if (entryId) {
    const entry = await getEntryDetailRecord(entryId);
    if (!entry) {
      return Response.json({ error: "Entry not found." }, { status: 404 });
    }
    entryTitle = entry.title;
    entryBody = (entry.contentMarkdown ?? entry.body ?? "").trim();
    if (!entryBody) {
      return Response.json({ error: "This entry has no text content to analyze." }, { status: 400 });
    }
  }

  try {
    const input = {
      entryTitle,
      entryBody,
      allowedActionTypes: parsed.data.allowedActionTypes ?? allowedProposedActionTypes,
    };
    const generate = () => adapter.generateProposedActions!(input);
    const response = parsed.data.persist && entryId && parsed.data.clientMutationId
      ? await saveAIProposals({ entryId, clientMutationId: parsed.data.clientMutationId, input, provider: config, generate })
      : proposalResponse(await generate(), config.name);
    if (response.persisted && entryId) {
      revalidatePath(`/entries/${entryId}`);
      revalidatePath("/entries");
      revalidatePath("/actions");
    }

    return Response.json(response);
  } catch (error) {
    // Upstream HTTP failures are 502; a reachable model that returned unusable output is 422.
    let status = 500;
    if (error instanceof AIProposalConflict) status = 409;
    if (error instanceof AIProviderError) status = error.status ? 502 : 422;
    return Response.json(
      { status: "invalid", error: error instanceof Error ? error.message : "The model request failed." },
      { status },
    );
  }
}
