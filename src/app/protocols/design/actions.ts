"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { AIProviderError } from "@/lib/ai";
import { resolveConnectedAdapter } from "@/lib/ai-server";
import { prisma } from "@/lib/db";
import { formActionErrorMessage } from "@/lib/form-actions";
import { buildMethodCardPrompt, checkMethodCard, manualMethodCard, methodCardSections, parseMethodCard } from "@/lib/method-card";
import { mergeSearchHits } from "@/lib/method-design";
import { createDesignDraft, keepMethodText, loadDesignSession, readMethodText, saveCards, saveChosen, saveHits } from "@/lib/method-design.server";
import { buildScalingPrompt, describeScaleChange, scaleProtocol } from "@/lib/method-scaling";
import { fetchMethodText, searchMethods, writeMethodSearchSettings } from "@/lib/method-sources/index.server";
import { methodSourceIds, type MethodSourceId } from "@/lib/method-sources/types";
import { normalizeProtocolDocument, projectProtocolDocument } from "@/lib/protocol-document";
import { randomUUID } from "node:crypto";

export type DesignActionState = { error?: string; message?: string };
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const fail = (error: unknown, fallback: string): DesignActionState => ({ error: formActionErrorMessage(error, fallback) });

/** A hit whose text was fetched or pasted, with that text as kept; the card and the draft both start here. */
async function loadFetchedHit(sessionId: string, hitKey: string) {
  const session = await loadDesignSession(sessionId);
  const hit = session?.hits.find(item => item.key === hitKey);
  if (!session || !hit?.attachmentId) throw new Error("Fetch the original text first");
  const stored = await readMethodText(hit.attachmentId);
  if (!stored) throw new Error("The fetched original can’t be read; fetch it again");
  return { session, hit, text: stored.text };
}

/** 检索设置: the switch, which sources, and the user's own protocols.io token (kept encrypted). */
export async function saveMethodSearchSettings(_previous: DesignActionState, formData: FormData): Promise<DesignActionState> {
  try {
    const sources = formData.getAll("sources").map(String).filter((id): id is MethodSourceId => methodSourceIds.includes(id as MethodSourceId));
    await writeMethodSearchSettings({ enabled: formData.get("enabled") === "on", sources, protocolsIoToken: String(formData.get("protocolsIoToken") ?? ""), clearProtocolsIoToken: formData.get("clearToken") === "on" });
    revalidatePath("/protocols/design");
    return { message: "Search settings saved." };
  } catch (error) { return fail(error, "Settings not saved"); }
}

const startInput = z.object({ goal: z.string().trim().min(2, "Write the experiment goal").max(600), sampleType: z.string().trim().max(200).optional(), conditions: z.string().trim().max(1000).optional() });

/** A new design session: the goal is searched in every enabled source at once, and only the goal and the sample type are sent out. */
export async function startDesignSession(_previous: DesignActionState, formData: FormData): Promise<DesignActionState> {
  let sessionId: string;
  try {
    const input = startInput.parse({ goal: formData.get("goal"), sampleType: String(formData.get("sampleType") ?? "") || undefined, conditions: String(formData.get("conditions") ?? "") || undefined });
    const session = await prisma.methodDesignSession.create({ data: { goal: input.goal, sampleType: input.sampleType ?? null, conditions: input.conditions ?? null, inputsJson: json({ query: input.goal }) } });
    sessionId = session.id;
    const { hits, errors } = await searchMethods(session.id, [input.goal, input.sampleType].filter(Boolean).join(" "));
    await prisma.methodDesignSession.update({ where: { id: session.id }, data: { hitsJson: json(hits), inputsJson: json({ query: input.goal, errors }) } });
  } catch (error) { return fail(error, "Couldn’t start the search"); }
  redirect(`/protocols/design/${sessionId}`);
}

export async function searchAgain(sessionId: string, query: string): Promise<DesignActionState & { hits?: number }> {
  try {
    const session = await loadDesignSession(sessionId);
    if (!session) throw new Error("Design session not found");
    const { hits, errors, failed } = await searchMethods(sessionId, query.trim() || session.goal);
    const merged = mergeSearchHits(session.hits, hits, { keys: [...Object.keys(session.cards), ...session.chosen.map(item => item.key)], failedSources: failed });
    await prisma.methodDesignSession.update({ where: { id: sessionId }, data: { hitsJson: json(merged), inputsJson: json({ query, errors }) } });
    revalidatePath(`/protocols/design/${sessionId}`);
    return { hits: hits.length, ...(errors.length ? { error: errors.join("；") } : {}) };
  } catch (error) { return fail(error, "Search failed"); }
}

/** Fetch one method's text and keep it as an attachment of the session (what was seen stays reviewable). */
export async function fetchMethod(sessionId: string, hitKey: string): Promise<DesignActionState> {
  try {
    const session = await loadDesignSession(sessionId);
    const hit = session?.hits.find(item => item.key === hitKey);
    if (!session || !hit) throw new Error("Search result not found");
    const text = await fetchMethodText(sessionId, hit);
    const attachmentId = await keepMethodText(sessionId, hit, text);
    await saveHits(sessionId, session.hits.map(item => item.key === hitKey ? { ...item, attachmentId, fetchedAt: text.fetchedAt, textChars: text.text.length, license: text.license ?? item.license, fetchError: undefined } : item));
    revalidatePath(`/protocols/design/${sessionId}`);
    return { message: `Fetched ${text.text.length} characters` };
  } catch (error) {
    const session = await loadDesignSession(sessionId);
    if (session) await saveHits(sessionId, session.hits.map(item => item.key === hitKey ? { ...item, fetchError: error instanceof Error ? error.message : "Fetch failed" } : item));
    revalidatePath(`/protocols/design/${sessionId}`);
    return fail(error, "Fetch failed");
  }
}

/** The model fills a method card for one fetched text; every statement is checked against the text before it is shown. */
export async function summarizeMethod(sessionId: string, hitKey: string): Promise<DesignActionState> {
  try {
    const { session, text: source } = await loadFetchedHit(sessionId, hitKey);
    // A full card takes a slow model a few minutes; the request still ends on its own.
    const resolved = await resolveConnectedAdapter({ timeoutMs: 240_000 });
    if (!resolved.ok) throw new Error(resolved.error);
    if (!resolved.adapter.complete) throw new Error(`The model service “${resolved.config.name}” can’t summarize; fill in the method card by hand`);
    const prompt = buildMethodCardPrompt({ goal: session.goal, sampleType: session.sampleType ?? undefined, conditions: session.conditions ?? undefined, title: source.title, text: source.text });
    const { text, model } = await resolved.adapter.complete(prompt.system, prompt.user);
    await resolved.gate.assertAllowed();
    const card = checkMethodCard(parseMethodCard(text), source.text, { provider: resolved.config.name, model });
    await saveCards(sessionId, { ...session.cards, [hitKey]: card });
    await prisma.activityLog.create({ data: { action: "method_card_generated", targetType: "method_design_session", targetId: sessionId, metadataJson: json({ hitKey, provider: resolved.config.name, model: model ?? null, unverified: card.unverified, truncated: prompt.truncated }) } });
    revalidatePath(`/protocols/design/${sessionId}`);
    return { message: card.unverified ? `Method card generated; ${card.unverified} unverified` : "Method card generated; everything verified" };
  } catch (error) { return fail(error, error instanceof AIProviderError ? "The model request failed" : "Couldn’t generate the method card"); }
}

/** A card written by hand when no model is connected (or the model's card is not trusted). */
export async function saveManualCard(sessionId: string, hitKey: string, input: { summary: string } & Partial<Record<(typeof methodCardSections)[number]["key"], string>>): Promise<DesignActionState> {
  try {
    const session = await loadDesignSession(sessionId);
    if (!session?.hits.some(item => item.key === hitKey)) throw new Error("Search result not found");
    const lines = Object.fromEntries(methodCardSections.map(section => [section.key, (input[section.key] ?? "").split(/\n+/)])) as Partial<Record<(typeof methodCardSections)[number]["key"], string[]>>;
    await saveCards(sessionId, { ...session.cards, [hitKey]: manualMethodCard(input.summary, lines) });
    revalidatePath(`/protocols/design/${sessionId}`);
    return { message: "Method card saved" };
  } catch (error) { return fail(error, "Method card not saved"); }
}

const pasteInput = z.object({ title: z.string().trim().min(1, "Write a title").max(300), url: z.string().trim().max(2000).optional(), license: z.string().trim().max(120).optional(), text: z.string().trim().min(40, "Paste the method text (a few sentences at least)").max(200_000) });

/** Text pasted from a site without an API (JoVE, Bio-protocol, a PDF): kept as an attachment like a fetched text, then the same card and draft path. */
export async function addPastedMethod(sessionId: string, raw: z.input<typeof pasteInput>): Promise<DesignActionState> {
  try {
    const input = pasteInput.parse(raw);
    const session = await loadDesignSession(sessionId);
    if (!session) throw new Error("Design session not found");
    const id = randomUUID();
    const hit = { key: `manual:${id}`, source: "manual" as const, externalId: id, title: input.title, url: input.url || undefined, license: input.license || undefined, venue: input.url ? new URL(input.url).hostname.replace(/^www\./, "") : "粘贴", snippet: input.text.slice(0, 200) };
    // Each paragraph is a section, so the draft reads one paragraph as one step.
    const paragraphs = input.text.split(/\n\s*\n|\r?\n/).map(line => line.trim()).filter(Boolean);
    const text = { title: input.title, sections: paragraphs.map((paragraph, index) => ({ title: `第 ${index + 1} 段`, text: paragraph })), text: paragraphs.join("\n\n"), license: input.license || undefined, url: input.url || undefined, fetchedAt: new Date().toISOString() };
    const attachmentId = await keepMethodText(sessionId, hit, text);
    await saveHits(sessionId, [...session.hits, { ...hit, attachmentId, fetchedAt: text.fetchedAt, textChars: text.text.length }]);
    await prisma.activityLog.create({ data: { action: "method_pasted", targetType: "method_design_session", targetId: sessionId, metadataJson: json({ title: input.title, url: input.url ?? null, chars: text.text.length }) } });
    revalidatePath(`/protocols/design/${sessionId}`);
    return { message: `Added “${input.title}”, ${text.text.length} characters` };
  } catch (error) { return fail(error, "Couldn’t add the pasted text"); }
}

export async function chooseMethods(sessionId: string, keys: string[], reason: string): Promise<DesignActionState> {
  try {
    const session = await loadDesignSession(sessionId);
    if (!session) throw new Error("Design session not found");
    await saveChosen(sessionId, keys.filter(key => session.hits.some(hit => hit.key === key)).map(key => ({ key, reason: reason.trim() || undefined })));
    revalidatePath(`/protocols/design/${sessionId}`);
    return {};
  } catch (error) { return fail(error, "Choice not saved"); }
}

/** 生成规程草稿: always a draft; the editor opens on it. */
export async function generateDraft(sessionId: string, hitKey: string): Promise<DesignActionState> {
  let target: { protocolId: string; versionId: string };
  try {
    const { session, hit, text } = await loadFetchedHit(sessionId, hitKey);
    target = await createDesignDraft(session, hit, text, session.cards[hitKey]);
    revalidatePath(`/protocols/design/${sessionId}`);
    revalidatePath("/protocols");
  } catch (error) { return fail(error, "Couldn’t generate the draft"); }
  redirect(`/protocols/${target.protocolId}/versions/${target.versionId}/edit`);
}

const scaleInput = z.object({ versionId: z.string().min(1), fromValue: z.number().positive(), fromUnit: z.string().min(1), toValue: z.number().positive(), toUnit: z.string().min(1), label: z.string().trim().max(60).optional(), explain: z.boolean().optional() });

/** 体系调整: numbers by the program, words by the model; written into the draft only while it is a draft. */
export async function scaleDraft(raw: z.input<typeof scaleInput>): Promise<DesignActionState & { changes?: ReturnType<typeof scaleProtocol>["changes"]; explanation?: string }> {
  try {
    const input = scaleInput.parse(raw);
    const version = await prisma.protocolVersion.findUnique({ where: { id: input.versionId }, include: { protocol: true } });
    if (!version) throw new Error("Protocol version not found");
    if (version.reviewStage !== "draft") throw new Error("Only a draft version can be scaled; derive a revision from a reviewed version first");
    const document = normalizeProtocolDocument(version.contentJson);
    if (!document) throw new Error("A Protocol in the old format can’t be scaled");
    const { document: scaled, changes } = scaleProtocol(document, { value: input.fromValue, unit: input.fromUnit }, { value: input.toValue, unit: input.toUnit }, { label: input.label || undefined, newId: prefix => `${prefix}-${randomUUID()}` });
    let explanation: string | undefined;
    if (input.explain) {
      const resolved = await resolveConnectedAdapter({ timeoutMs: 120_000 });
      if (resolved.ok && resolved.adapter.complete) {
        const prompt = buildScalingPrompt({ from: { value: input.fromValue, unit: input.fromUnit }, to: { value: input.toValue, unit: input.toUnit }, changes, goal: version.purpose ?? undefined });
        try { explanation = (await resolved.adapter.complete(prompt.system, prompt.user)).text.trim(); await resolved.gate.assertAllowed(); } catch (error) { explanation = `（模型说明失败：${error instanceof Error ? error.message : "未知错误"}）`; }
      }
    }
    const steps = scaled.sections.find(section => section.key === "steps");
    const summary = changes.map(describeScaleChange).join("；");
    steps?.blocks.unshift({ id: `callout-${randomUUID()}`, type: "callout", tone: "note", text: `体系调整依据（${input.fromValue} ${input.fromUnit} → ${input.toValue} ${input.toUnit}）：${summary}${explanation ? `\n模型说明（待核）：${explanation}` : ""}`, execution: { role: "info" } });
    const projection = projectProtocolDocument(scaled);
    await prisma.protocolVersion.update({ where: { id: version.id }, data: { contentJson: json(scaled), stepsJson: json(projection.steps), materialsJson: json(projection.materials), consumptionRulesJson: json(projection.consumptionRules), changeSummary: `${version.changeSummary ?? ""}；体系调整 ${input.fromValue} ${input.fromUnit} → ${input.toValue} ${input.toUnit}`.replace(/^；/, "") } });
    // Activity entries print their fields as text: keep them flat.
    await prisma.activityLog.create({ data: { action: "design_draft_scaled", targetType: "protocol", targetId: version.protocolId, metadataJson: json({ versionId: version.id, from: `${input.fromValue} ${input.fromUnit}`, to: `${input.toValue} ${input.toUnit}`, scaled: changes.filter(change => change.rule === "linear").length, kept: changes.filter(change => change.rule === "kept").length, manual: changes.filter(change => change.rule === "manual").length }) } });
    revalidatePath(`/protocols/${version.protocolId}`);
    return { changes, explanation, message: "Written into the draft as a new system dimension; choose it at run time" };
  } catch (error) { return fail(error, "Scaling failed"); }
}

