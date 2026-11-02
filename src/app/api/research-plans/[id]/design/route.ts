import { z } from "zod";
import { validateAIRequest } from "@/lib/ai-request";
import { createDesignRun } from "@/lib/copilot/plan-design/runs.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A new design on an existing plan, its LabNest context gathered. No model is called yet. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const parsed = z.object({ purpose: z.string().trim().min(1) }).strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "请写研究目的" }, { status: 400 });
  const { id } = await params;
  try { return Response.json({ run: await createDesignRun(id, parsed.data.purpose) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "没有创建成功" }, { status: 409 }); }
}
