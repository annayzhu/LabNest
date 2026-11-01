import { z } from "zod";
import { AIProviderError } from "@/lib/ai";
import { resolveConnectedAdapter } from "@/lib/ai-server";
import { validateAIRequest } from "@/lib/ai-request";
import { prisma } from "@/lib/db";
import { organizeSource, outlineSource, RECOGNITION_PROMPT_VERSION } from "@/lib/protocol-recognition";
import { choiceInput, defaultChoice, needsConfirmation, outlineInput } from "@/lib/protocol-recognition-scope";
import { loadRecognitionSource, textView } from "@/lib/protocol-recognition.server";

export const runtime = "nodejs";

const body = z.object({
  sourceId: z.string().min(1).max(100), title: z.string().max(200).optional(), goal: z.string().max(1000).optional(),
  language: z.enum(["zh", "source"]).default("zh"), outline: outlineInput.optional(), choice: choiceInput.optional(),
});

/**
 * AI 识别 in two passes. Without a choice, the first pass reads the source's headings and page openings: when it finds
 * workflows or systems to choose from, the outline goes back to the page for the author to confirm; otherwise the
 * second pass follows at once. With the author's choice, only the second pass runs: each section is written from its
 * own pages, every line citing its source lines and checked against them. Nothing is saved here.
 */
export async function POST(request: Request) {
  const boundary = validateAIRequest(request, "application/json");
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  // A long manual organized by a slower model takes minutes; every request still ends on its own.
  const resolved = await resolveConnectedAdapter({ timeoutMs: 240_000 });
  if (!resolved.ok) return Response.json({ error: resolved.error }, { status: resolved.status });
  const { adapter, config, gate } = resolved;
  if (!adapter.complete) return Response.json({ error: `The model service “${config.name}” can’t organize text` }, { status: 409 });
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "The request is incomplete; read the source again" }, { status: 400 });
  const input = parsed.data;
  let loaded;
  try { loaded = await loadRecognitionSource(input.sourceId); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "The original file is missing" }, { status: 404 }); }
  if (!loaded.source.text.trim()) return Response.json({ error: "There is no readable text in this file" }, { status: 422 });
  const source = { pages: loaded.source.sourcePages, fileName: loaded.fileName, title: input.title?.trim() || undefined, goal: input.goal?.trim() || undefined };
  const complete = (system: string, user: string) => adapter.complete!(system, user);
  try {
    let outline = input.outline, choice = input.choice, outlineModel: string | undefined;
    if (!outline || !choice) {
      const first = await outlineSource(source, complete);
      await gate.assertAllowed();
      outline = first.outline; outlineModel = first.model;
      // Activity entries print their fields as text: keep them flat.
      await prisma.activityLog.create({ data: { action: "protocol_recognition_outlined", targetType: "attachment", targetId: loaded.sourceId, metadataJson: {
        provider: config.name, model: first.model ?? null, promptVersion: RECOGNITION_PROMPT_VERSION, chars: first.chars, parts: outline.parts.length, workflows: outline.workflows.length, systems: outline.systems?.options.length ?? 0, read: outline.read,
      } } });
      choice = defaultChoice(outline, input.language);
      if (needsConfirmation(outline)) return Response.json({ outline, choice });
    }
    const result = await organizeSource(source, outline, choice, complete);
    await gate.assertAllowed();
    const model = result.model ?? outlineModel ?? config.defaultModel ?? undefined;
    const view = textView(loaded, result.habitText, "ai", { model, attempts: result.calls, promptVersion: RECOGNITION_PROMPT_VERSION, outline, scope: result.scope, sentChars: result.sentChars });
    if (result.truncated) view.warnings = [...view.warnings, "Part of the model’s answer was cut off; check the draft for missing lines"];
    await prisma.activityLog.create({ data: { action: "protocol_recognized", targetType: "attachment", targetId: loaded.sourceId, metadataJson: {
      provider: config.name, model: model ?? null, promptVersion: RECOGNITION_PROMPT_VERSION, calls: result.calls, language: choice.language, unverified: view.check?.unverified ?? 0, lines: view.check?.lines.length ?? 0,
      missing: view.check?.missing.length ?? 0, chars: loaded.source.text.length, sentChars: result.sentChars, pages: result.scope.pages.length, truncated: result.truncated,
    } } });
    return Response.json({ view });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The model request failed" }, { status: error instanceof AIProviderError && error.status === 403 ? 403 : 502 });
  }
}
