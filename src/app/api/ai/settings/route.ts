import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AISettingsConflict, changeAISettings, readAISettings } from "@/lib/ai-settings";
import { validateAIRequest } from "@/lib/ai-request";

export const dynamic = "force-dynamic";
const revision = z.string().min(1).max(40);
const changeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("enabled"), enabled: z.boolean(), revision }).strict(),
  z.object({ kind: z.literal("configuration"), defaultProviderId: z.string().min(1).nullable(), attachmentsEnabled: z.boolean(), visionProviderId: z.string().min(1).nullable().optional(), reviewProviderId: z.string().min(1).nullable().optional(), revision }).strict(),
]);
export async function GET() {
  try { return Response.json(await readAISettings(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Cannot read AI settings; try again. Saved settings are unchanged." }, { status: 503 }); }
}
export async function PATCH(request: Request) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const parsed = changeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "无效的 AI 设置修改。" }, { status: 400 });
  try {
    const saved = await changeAISettings(parsed.data);
    revalidatePath("/ai");
    revalidatePath("/actions/manual");
    return Response.json(saved);
  } catch (error) {
    const conflict = error instanceof AISettingsConflict;
    return Response.json({ error: conflict ? error.message : "保存失败，请重新读取后重试。" }, { status: conflict ? 409 : 503 });
  }
}
