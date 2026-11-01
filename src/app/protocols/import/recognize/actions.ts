"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_ATTACHMENT_BYTES } from "@/lib/attachment-limits";
import { formActionErrorMessage } from "@/lib/form-actions";
import { outlineInput, scopeInput } from "@/lib/protocol-recognition-scope";
import { keepRecognitionSource, loadRecognitionSource, rulesView, saveRecognition, textView, type RecognitionView } from "@/lib/protocol-recognition.server";

export type RecognitionState = { error?: string; view?: RecognitionView };

/** What an organized draft carries back from the page: its model, its prompt version, the outline and the pages read; a version other than template-v1 is checked the old way. */
const organized = z.object({
  model: z.string().max(200).optional(), promptVersion: z.string().max(40).optional(), scope: scopeInput.optional(), outline: outlineInput.optional(),
});
type Organized = z.infer<typeof organized>;
const readOrganized = (value: Organized = {}) => { const parsed = organized.safeParse(value); return parsed.success ? parsed.data : {}; };

/** Keep the uploaded file (or the pasted text) and read it as written, without AI. */
export async function readRecognitionSource(formData: FormData): Promise<RecognitionState> {
  try {
    const upload = formData.get("file");
    const pasted = String(formData.get("text") ?? "").trim();
    // Text read from photos is kept under a name that says so; any other pasted text is just pasted text.
    const name = String(formData.get("name") ?? "").trim().replace(/[\\/:*?"<>|]/g, " ").slice(0, 120) || "粘贴的文字.txt";
    const file = upload instanceof File && upload.size ? upload : pasted ? new File([pasted], name.endsWith(".txt") ? name : `${name}.txt`, { type: "text/plain" }) : undefined;
    if (!file) throw new Error("Choose a file, or paste the text");
    if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("The file can’t be larger than 25 MB");
    const sourceId = await keepRecognitionSource(file);
    return { view: rulesView(await loadRecognitionSource(sourceId)) };
  } catch (error) { return { error: formActionErrorMessage(error, "Couldn’t read this file") }; }
}

/** The author's own edit of the draft, read and checked again; an edit of a model's draft keeps its model and positions. */
export async function previewRecognitionText(sourceId: string, habitText: string, extra?: Organized): Promise<RecognitionState> {
  try { return { view: textView(await loadRecognitionSource(sourceId), habitText, "edited", readOrganized(extra)) }; }
  catch (error) { return { error: formActionErrorMessage(error, "Couldn’t read it again") }; }
}

/** Save the reading as a new draft Protocol and open it in the editor. */
export async function saveRecognizedProtocol(input: { sourceId: string; mode: RecognitionView["mode"]; habitText: string; title?: string } & Organized): Promise<RecognitionState> {
  let target: { protocolId: string; versionId: string };
  try {
    const { model, promptVersion, scope } = readOrganized({ model: input.model, promptVersion: input.promptVersion, scope: input.scope });
    target = await saveRecognition({ sourceId: input.sourceId, mode: input.mode, habitText: input.habitText, title: input.title, model, promptVersion, scope });
  } catch (error) { return { error: formActionErrorMessage(error, "Couldn’t save it as a Protocol") }; }
  revalidatePath("/protocols");
  redirect(`/protocols/${target.protocolId}/versions/${target.versionId}/edit`);
}
