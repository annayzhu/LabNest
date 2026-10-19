import { AIProviderError } from "@/lib/ai";
import { resolveConnectedAdapter } from "@/lib/ai-server";
import { validateAIRequest } from "@/lib/ai-request";
import { prisma } from "@/lib/db";
import { recognizeProtocolText, RECOGNITION_PROMPT_VERSION } from "@/lib/protocol-recognition";
import { loadRecognitionSource, textView } from "@/lib/protocol-recognition.server";

export const runtime = "nodejs";

/**
 * AI 识别: the kept source goes to the connected model, which lays it out by habit; every line is checked against the
 * original and one repair round may follow. Nothing is saved here: the page shows the result, the author decides.
 */
export async function POST(request: Request) {
  const boundary = validateAIRequest(request, "application/json");
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  // A whole manual laid out by a slower model can take minutes; the request still ends on its own.
  const resolved = await resolveConnectedAdapter({ timeoutMs: 240_000 });
  if (!resolved.ok) return Response.json({ error: resolved.error }, { status: resolved.status });
  const { adapter, config, gate } = resolved;
  if (!adapter.complete) return Response.json({ error: `模型服务“${config.name}”不支持整理文本` }, { status: 409 });
  const body = await request.json().catch(() => ({})) as { sourceId?: unknown };
  let loaded;
  try { loaded = await loadRecognitionSource(String(body.sourceId ?? "")); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "原始文件不存在" }, { status: 404 }); }
  if (!loaded.source.text.trim()) return Response.json({ error: "这份文件里没有可读的文字" }, { status: 422 });
  try {
    const result = await recognizeProtocolText(loaded.source.text, (system, user) => adapter.complete!(system, user));
    await gate.assertAllowed();
    const view = textView(loaded, result.habitText, "ai", { model: result.model ?? config.defaultModel ?? undefined, attempts: result.attempts, truncated: result.truncated });
    // Activity entries print their fields as text: keep them flat.
    await prisma.activityLog.create({ data: { action: "protocol_recognized", targetType: "attachment", targetId: loaded.sourceId, metadataJson: {
      provider: config.name, model: view.model ?? null, promptVersion: RECOGNITION_PROMPT_VERSION, attempts: result.attempts, unverified: result.check.unverified, missing: result.check.missing.length, chars: loaded.source.text.length, truncated: result.truncated,
    } } });
    return Response.json({ view });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "模型请求失败" }, { status: error instanceof AIProviderError && error.status === 403 ? 403 : 502 });
  }
}
