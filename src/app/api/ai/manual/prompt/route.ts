import { createAIGate } from "@/lib/ai-gate";
import { validateAIRequest } from "@/lib/ai-request";
import {
  ManualCopyPasteProvider,
  allowedProposedActionTypes,
  manualCopyPasteProviderConfig,
} from "@/lib/ai";
import type { ProposedAction } from "@/lib/types";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const promptRequestSchema = z.object({
  entryTitle: z.string().trim().min(1),
  entryBody: z.string().trim().min(1),
  allowedActionTypes: z.array(z.enum(allowedProposedActionTypes as [ProposedAction["actionType"], ...ProposedAction["actionType"][]])).optional(),
});

export async function POST(request: Request) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const settings = await prisma.aISettings.findUnique({ where: { id: "default" } });
  if (!settings?.enabled) {
    return Response.json(
      { error: "AI is disabled. Enable it explicitly on the AI page before preparing external model prompts." },
      { status: 403 },
    );
  }

  const gate = createAIGate(settings.updatedAt.toISOString());
  const parsed = promptRequestSchema.safeParse(await request.json().catch(() => ({})));

  try { await gate.assertAllowed(); }
  catch { return Response.json({ error: "AI 设置已改变，本次操作已停止。" }, { status: 403 }); }

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
