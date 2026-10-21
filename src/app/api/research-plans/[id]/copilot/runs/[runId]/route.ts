import { z } from "zod";
import { validateAIRequest } from "@/lib/ai-request";
import { editRun, listRuns, removeRun } from "@/lib/copilot/runs.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const edit = z.object({ subQuestions: z.unknown().optional(), removePaperKeys: z.array(z.string()).max(40).optional(), autoContinue: z.boolean().optional(), resume: z.boolean().optional() }).strict();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id, runId } = await params;
  const run = (await listRuns(id)).find(item => item.id === runId);
  return run ? Response.json({ run }, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "没有找到这次运行" }, { status: 404 });
}

/** Between steps: change the questions or the papers, choose whether to stop between stages, or resume after a pause or a failure. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const parsed = edit.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "无效的修改" }, { status: 400 });
  const { id, runId } = await params;
  try { return Response.json({ run: await editRun(id, runId, parsed.data) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "没有修改成功" }, { status: 409 }); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const { id, runId } = await params;
  try { await removeRun(id, runId); return Response.json({ ok: true }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "没有删除成功" }, { status: 409 }); }
}
