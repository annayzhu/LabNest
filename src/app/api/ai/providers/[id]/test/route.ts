import { resolveAdapterForProvider } from "@/lib/ai-server";
import { prisma } from "@/lib/db";
import { validateAIRequest } from "@/lib/ai-request";

export const runtime = "nodejs";

/** Runs the adapter's connection test for one stored provider. Does not send any record content. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ ok: false, message: boundary.error }, { status: boundary.status });
  const { id } = await context.params;
  const settings = await prisma.aISettings.findUnique({ where: { id: "default" } });
  if (!settings?.enabled) {
    return Response.json({ ok: false, message: "AI is disabled. Enable it in Settings before testing a provider." }, { status: 403 });
  }
  const resolved = await resolveAdapterForProvider(id);
  if (!resolved.ok) {
    return Response.json({ ok: false, message: resolved.error }, { status: resolved.status });
  }
  const result = await resolved.adapter.testConnection();
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
