import {
  ManualCopyPasteProvider,
  allowedProposedActionTypes,
  manualCopyPasteProviderConfig,
} from "@/lib/ai";
import type { ProposedAction } from "@/lib/types";
import { z } from "zod";

export const runtime = "nodejs";

const promptRequestSchema = z.object({
  entryTitle: z.string().trim().min(1),
  entryBody: z.string().trim().min(1),
  allowedActionTypes: z.array(z.enum(allowedProposedActionTypes as [ProposedAction["actionType"], ...ProposedAction["actionType"][]])).optional(),
});

export async function POST(request: Request) {
  const parsed = promptRequestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const provider = new ManualCopyPasteProvider(manualCopyPasteProviderConfig);
  const prompt = provider.createPrompt({
    entryTitle: parsed.data.entryTitle,
    entryBody: parsed.data.entryBody,
    allowedActionTypes: parsed.data.allowedActionTypes ?? allowedProposedActionTypes,
  });

  return Response.json({
    provider: provider.config.name,
    mode: "manual_copy_paste",
    prompt,
  });
}
