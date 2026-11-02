import { z } from "zod";
import { validateAIRequest } from "@/lib/ai-request";
import { designSteps, tiers } from "@/lib/copilot/plan-design/spec";
import { actOnDesignRun, listDesignRuns, removeDesignRun } from "@/lib/copilot/plan-design/runs.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; runId: string }> };
const action = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("include"), itemId: z.string().max(80), included: z.boolean() }),
  z.object({ kind: z.literal("context"), card: z.unknown() }),
  z.object({ kind: z.literal("template"), templateId: z.string().max(40) }),
  z.object({ kind: z.literal("chain"), chain: z.unknown(), tier: z.enum(tiers) }),
  z.object({ kind: z.literal("card"), card: z.unknown() }),
  z.object({ kind: z.literal("confirm") }),
  z.object({ kind: z.literal("reopen"), step: z.enum(designSteps) }),
  z.object({ kind: z.literal("finding"), findingId: z.string().max(20), status: z.enum(["open", "resolved", "waived"]), reason: z.string().max(600).optional() }),
  z.object({ kind: z.literal("waive"), key: z.string().max(60), reason: z.string().max(600) }),
]);

export async function GET(_request: Request, { params }: Params) {
  const { id, runId } = await params;
  const run = (await listDesignRuns(id)).find(item => item.id === runId);
  return run ? Response.json({ run }, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "没有找到这次设计" }, { status: 404 });
}

/** The author's edit or confirmation of the current step; `seen` is the design's updatedAt as the page read it. */
export async function PATCH(request: Request, { params }: Params) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const parsed = z.object({ action, seen: z.string().max(40).optional() }).strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "无效的修改" }, { status: 400 });
  const { id, runId } = await params;
  try { return Response.json({ run: await actOnDesignRun(id, runId, parsed.data.action, parsed.data.seen) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "没有保存成功" }, { status: 409 }); }
}

export async function DELETE(request: Request, { params }: Params) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const { id, runId } = await params;
  try { await removeDesignRun(id, runId); return Response.json({ ok: true }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "没有删除成功" }, { status: 409 }); }
}
