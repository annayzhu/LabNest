import { validateAIRequest } from "@/lib/ai-request";
import { prepareStep } from "@/lib/copilot/deps.server";
import { advanceRun } from "@/lib/copilot/runs.server";

export const runtime = "nodejs";
export const maxDuration = 300;

/** One step of a run (a stage, or one paper). The page calls this again until the run is done, paused or failed. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const { id, runId } = await params;
  try { return Response.json({ run: await advanceRun(id, runId, () => prepareStep(id)) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "这一步没有完成" }, { status: 409 }); }
}
