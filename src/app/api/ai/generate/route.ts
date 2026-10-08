import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AIProviderError, allowedProposedActionTypes } from "@/lib/ai";
import { resolveConnectedAdapter } from "@/lib/ai-server";
import { prisma } from "@/lib/db";
import { getEntryDetailRecord } from "@/lib/entries";
import type { ProposedAction } from "@/lib/types";

export const runtime = "nodejs";

const actionTypeEnum = z.enum(allowedProposedActionTypes as [ProposedAction["actionType"], ...ProposedAction["actionType"][]]);

const generateRequestSchema = z
  .object({
    entryId: z.string().trim().min(1).optional(),
    entryTitle: z.string().trim().min(1).optional(),
    entryBody: z.string().trim().min(1).optional(),
    allowedActionTypes: z.array(actionTypeEnum).min(1).optional(),
    /** Persist the validated actions as pending ProposedAction records linked to the entry. Requires entryId. */
    persist: z.boolean().optional(),
  })
  .refine((value) => value.entryId || (value.entryTitle && value.entryBody), {
    message: "Provide either entryId or entryTitle and entryBody.",
  });

/**
 * Sends explicit entry context to the configured model and returns reviewable proposed actions.
 * Nothing is executed. With `persist: true` the actions are stored as pending items in the review inbox.
 */
export async function POST(request: Request) {
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
    const result = await adapter.generateProposedActions({
      entryTitle,
      entryBody,
      allowedActionTypes: parsed.data.allowedActionTypes ?? allowedProposedActionTypes,
    });

    let persisted = 0;
    if (parsed.data.persist && entryId && result.actions.length) {
      await prisma.$transaction([
        ...result.actions.map((action) =>
          prisma.proposedAction.create({
            data: {
              sourceType: "ai",
              sourceId: entryId,
              actionType: action.actionType,
              status: "pending",
              reason: action.reason,
              payloadJson: JSON.parse(JSON.stringify(action.payload)),
            },
          }),
        ),
        prisma.activityLog.create({
          data: {
            action: "ai_propose",
            targetType: "entry",
            targetId: entryId,
            metadataJson: { provider: config.name, model: result.model ?? null, count: result.actions.length },
          },
        }),
      ]);
      persisted = result.actions.length;
      revalidatePath(`/entries/${entryId}`);
      revalidatePath("/entries");
      revalidatePath("/actions");
    }

    return Response.json({
      status: "validated",
      provider: config.name,
      model: result.model ?? null,
      count: result.actions.length,
      persisted,
      actions: result.actions,
      rawResponse: result.rawResponse,
      note: persisted
        ? "Proposed actions were saved as pending items. Review them before anything is executed."
        : "These are proposed actions only. LabNest has not mutated any record.",
    });
  } catch (error) {
    // Upstream HTTP failures are 502; a reachable model that returned unusable output is 422.
    let status = 500;
    if (error instanceof AIProviderError) status = error.status ? 502 : 422;
    return Response.json(
      { status: "invalid", error: error instanceof Error ? error.message : "The model request failed." },
      { status },
    );
  }
}
