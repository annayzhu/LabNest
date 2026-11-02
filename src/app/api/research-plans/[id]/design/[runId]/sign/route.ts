import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validateAIRequest } from "@/lib/ai-request";
import { previewSignOff, signDesignRun } from "@/lib/copilot/plan-design/runs.server";
import { premiseFields } from "@/lib/copilot/plan-design/write-back";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; runId: string }> };

/** What signing would write, with before and after, and what still stops it. Writes nothing. */
export async function GET(_request: Request, { params }: Params) {
  const { id, runId } = await params;
  try { return Response.json(await previewSignOff(id, runId), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "无法预览" }, { status: 409 }); }
}

const choices = z.object({
  premise: z.array(z.enum(premiseFields)).max(3), keepPrevious: z.boolean(), experiments: z.array(z.string().max(24)).max(12),
  planSeen: z.string().max(40), runSeen: z.string().max(40),
}).strict();

export async function POST(request: Request, { params }: Params) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const parsed = choices.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "无效的签署请求" }, { status: 400 });
  const { id, runId } = await params;
  try {
    const signed = await signDesignRun(id, runId, parsed.data);
    revalidatePath(`/research-plans/${id}`);
    revalidatePath("/experiments");
    return Response.json(signed);
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "没有签署成功" }, { status: 409 }); }
}
