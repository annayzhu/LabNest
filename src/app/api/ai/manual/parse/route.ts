import { createAIGate } from "@/lib/ai-gate";
import { validateAIRequest } from "@/lib/ai-request";
import { ManualCopyPasteProvider, manualCopyPasteProviderConfig } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const parseRequestSchema = z.object({
  rawResponse: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const settings = await prisma.aISettings.findUnique({ where: { id: "default" } });
  if (!settings?.enabled) {
    return Response.json(
      { error: "AI is disabled. Enable it explicitly on the AI page before importing model output." },
      { status: 403 },
    );
  }

  const gate = createAIGate(settings.updatedAt.toISOString());
  const parsed = parseRequestSchema.safeParse(await request.json().catch(() => ({})));

  try { await gate.assertAllowed(); }
  catch { return Response.json({ error: "AI 设置已改变，本次操作已停止。" }, { status: 403 }); }

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const provider = new ManualCopyPasteProvider(manualCopyPasteProviderConfig);
    const actions = provider.parseResponse(parsed.data.rawResponse);

    return Response.json({
      status: "validated",
      count: actions.length,
      actions,
      note: "These are proposed actions only. LabNest has not mutated any record.",
    });
  } catch (error) {
    return Response.json(
      {
        status: "invalid",
        error: error instanceof Error ? error.message : "Could not parse manual AI response.",
      },
      { status: 400 },
    );
  }
}
