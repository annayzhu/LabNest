import { revalidatePath } from "next/cache";
import { AIProviderError } from "@/lib/ai";
import { validateAIRequest } from "@/lib/ai-request";
import { draftTidy } from "@/lib/entry-tidy.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

/** 整理 (Q339): a tidied draft of the record from the default service. The record itself does not change here. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const boundary = validateAIRequest(request);
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const { id } = await params;
  try {
    const draft = await draftTidy(id);
    revalidatePath("/ai");
    return Response.json({ draft });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The record could not be tidied" }, { status: error instanceof AIProviderError && error.status === 403 ? 403 : 409 });
  }
}
