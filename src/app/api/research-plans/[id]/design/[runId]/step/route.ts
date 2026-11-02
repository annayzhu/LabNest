import { z } from "zod";
import { validateAIRequest } from "@/lib/ai-request";
import { prepareDesignStep } from "@/lib/copilot/plan-design/deps.server";
import { stepDesignRun } from "@/lib/copilot/plan-design/runs.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** One model step of the current step: the context card, the chain, one design card (`blockId`, or the next missing), or a review round. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const parsed = z.object({ blockId: z.string().max(24).optional() }).strict().safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "无效的请求" }, { status: 400 });
  const { id, runId } = await params;
  try { return Response.json({ run: await stepDesignRun(id, runId, parsed.data, purpose => prepareDesignStep(id, purpose)) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "这一步没有完成" }, { status: 409 }); }
}
