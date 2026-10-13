import { resolveAdapterForProvider } from "@/lib/ai-server";
import { validateAIRequest } from "@/lib/ai-request";

export const runtime = "nodejs";

/** Runs the adapter's connection test for one stored provider. Does not send any record content. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ ok: false, message: boundary.error }, { status: boundary.status });
  const { id } = await context.params;
  const resolved = await resolveAdapterForProvider(id);
  if (!resolved.ok) {
    return Response.json({ ok: false, message: resolved.error }, { status: resolved.status });
  }
  const result = await resolved.adapter.testConnection();
  try { await resolved.gate.assertAllowed(); }
  catch { return Response.json({ ok: false, message: "AI 设置已改变，本次连接测试已停止。" }, { status: 403 }); }
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
