import { AIProviderError } from "@/lib/ai";
import { validateAIRequest } from "@/lib/ai-request";
import { resolveVisionAdapter } from "@/lib/ai-server";
import { prisma } from "@/lib/db";
import { cleanTranscript, photoPrompt, photoProblem } from "@/lib/protocol-photo";

export const runtime = "nodejs";

/**
 * 照片转写, one picture: it goes to the service that reads pictures and comes back as text. The picture exists only in
 * this request: it is not saved, not logged, and not kept anywhere once the answer is sent.
 */
export async function POST(request: Request) {
  const boundary = validateAIRequest(request, "multipart/form-data");
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const resolved = await resolveVisionAdapter({ timeoutMs: 120_000 });
  if (!resolved.ok) return Response.json({ error: resolved.error }, { status: resolved.status });
  const { adapter, config, gate } = resolved;
  if (!adapter.describeImage) return Response.json({ error: `模型服务“${config.name}”不能识别图片` }, { status: 409 });
  const form = await request.formData().catch(() => undefined);
  const image = form?.get("image");
  if (!(image instanceof File)) return Response.json({ error: "请选择一张图片" }, { status: 400 });
  const problem = photoProblem(image);
  if (problem) return Response.json({ error: problem }, { status: 422 });
  try {
    const bytes = Buffer.from(await image.arrayBuffer());
    const result = await adapter.describeImage(photoPrompt.system, photoPrompt.user, { mimeType: image.type, base64: bytes.toString("base64") });
    await gate.assertAllowed();
    // Activity entries print their fields as text: keep them flat. Only the size is recorded, never the picture.
    await prisma.activityLog.create({ data: { action: "protocol_photo_read", targetType: "ai_provider", targetId: config.id, metadataJson: { provider: config.name, model: result.model ?? null, bytes: bytes.length } } });
    return Response.json({ text: cleanTranscript(result.text), model: result.model ?? config.defaultModel ?? null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "模型请求失败" }, { status: error instanceof AIProviderError && error.status === 403 ? 403 : 502 });
  }
}
