import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validateAIRequest } from "@/lib/ai-request";
import { decideCopilotSuggestion } from "@/lib/copilot/runs.server";

export const runtime = "nodejs";

const decision = z.object({ decision: z.enum(["adopt", "ignore"]) }).strict();

/** 采纳 or 忽略 one suggestion; adopting writes into the plan, and deciding needs no model. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; runId: string; suggestionId: string }> }) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const parsed = decision.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "无效的操作" }, { status: 400 });
  const { id, runId, suggestionId } = await params;
  try {
    const result = await decideCopilotSuggestion(id, runId, suggestionId, parsed.data.decision);
    revalidatePath(`/research-plans/${id}`);
    if (result.experimentId) { revalidatePath("/experiments"); revalidatePath(`/experiments/${result.experimentId}`); }
    return Response.json(result);
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "没有处理成功" }, { status: 409 }); }
}
