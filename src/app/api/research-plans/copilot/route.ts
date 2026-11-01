import { z } from "zod";
import { validateAIRequest } from "@/lib/ai-request";
import { createPlanWithRun } from "@/lib/copilot/runs.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const start = z.object({
  projectId: z.string().min(1),
  purpose: z.string().trim().min(1),
  inputs: z.object({ sample: z.string().optional(), conditions: z.string().optional() }).strict().optional(),
  budget: z.object({ fallbackToPubMed: z.boolean().optional(), maxPapers: z.number().int().optional(), maxFullText: z.number().int().optional() }).strict().optional(),
  autoContinue: z.boolean().optional(),
}).strict();

/** A new research plan made from a purpose, with a Copilot run ready on it: the first step is a separate request from the plan page. */
export async function POST(request: Request) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const parsed = start.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "请先选项目并写研究目的" }, { status: 400 });
  try { return Response.json(await createPlanWithRun(parsed.data)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "没有创建成功" }, { status: 409 }); }
}
