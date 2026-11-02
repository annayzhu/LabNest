import { z } from "zod";
import { validateAIRequest } from "@/lib/ai-request";
import { createPlanWithDesign } from "@/lib/copilot/plan-design/runs.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const start = z.object({ projectId: z.string().min(1), purpose: z.string().trim().min(1) }).strict();

/** A new draft plan named from a purpose, with a design started on it. No model is called yet. */
export async function POST(request: Request) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const parsed = start.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "请先选项目并写研究目的" }, { status: 400 });
  try { return Response.json(await createPlanWithDesign(parsed.data)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "没有创建成功" }, { status: 409 }); }
}
