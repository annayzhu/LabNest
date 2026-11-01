import { z } from "zod";
import { validateAIRequest } from "@/lib/ai-request";
import { copilotReadiness } from "@/lib/copilot/deps.server";
import { createRun, listRuns } from "@/lib/copilot/runs.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const start = z.object({
  purpose: z.string().trim().min(1),
  inputs: z.object({ sample: z.string().optional(), model: z.string().optional(), conditions: z.string().optional(), mode: z.enum(["new", "adjust"]).optional() }).strict().optional(),
  budget: z.object({ fallbackToPubMed: z.boolean().optional(), maxPapers: z.number().int().optional(), maxFullText: z.number().int().optional() }).strict().optional(),
  autoContinue: z.boolean().optional(),
}).strict();

/** The research plan's Copilot: its runs (newest first) and what a run needs. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return Response.json({ runs: await listRuns(id), readiness: await copilotReadiness() }, { headers: { "Cache-Control": "no-store" } });
}

/** A new run. It only records the purpose and what it may spend: the first step is a separate request. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const parsed = start.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "请先写研究目的" }, { status: 400 });
  try { return Response.json({ run: await createRun((await params).id, parsed.data) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "没有创建成功" }, { status: 409 }); }
}
