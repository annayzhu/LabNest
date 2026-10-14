import { validateAIRequest } from "@/lib/ai-request";
import { resolveDraftAdapter } from "@/lib/ai-server";

export const runtime = "nodejs";

/** No writes: test only the fixed adapter message under the current workspace gate. */
export async function POST(request: Request) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ ok: false, message: boundary.error }, { status: boundary.status });
  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 16_000) return Response.json({ ok: false, message: "连接配置过长。" }, { status: 413 });
    input = JSON.parse(body);
  } catch { return Response.json({ ok: false, message: "连接配置格式无效。" }, { status: 400 }); }
  const resolved = await resolveDraftAdapter(input, request.signal);
  if (!resolved.ok) return Response.json({ ok: false, message: resolved.error, field: resolved.field }, { status: resolved.status });
  const result = await resolved.adapter.testConnection();
  try { await resolved.gate.assertAllowed(); }
  catch { return Response.json({ ok: false, message: "AI 或服务设置已改变，本次测试已停止。" }, { status: 403 }); }
  return Response.json({ ...result, saved: false }, { status: result.ok ? 200 : 502 });
}
