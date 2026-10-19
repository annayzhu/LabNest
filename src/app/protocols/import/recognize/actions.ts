"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { MAX_ATTACHMENT_BYTES } from "@/lib/attachment-limits";
import { formActionErrorMessage } from "@/lib/form-actions";
import { keepRecognitionSource, loadRecognitionSource, rulesView, saveRecognition, textView, type RecognitionView } from "@/lib/protocol-recognition.server";

export type RecognitionState = { error?: string; view?: RecognitionView };

/** Keep the uploaded file (or the pasted text) and read it as written, without AI. */
export async function readRecognitionSource(formData: FormData): Promise<RecognitionState> {
  try {
    const upload = formData.get("file");
    const pasted = String(formData.get("text") ?? "").trim();
    const file = upload instanceof File && upload.size ? upload : pasted ? new File([pasted], "粘贴的文字.txt", { type: "text/plain" }) : undefined;
    if (!file) throw new Error("Choose a file, or paste the text");
    if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("The file can’t be larger than 25 MB");
    const sourceId = await keepRecognitionSource(file);
    return { view: rulesView(await loadRecognitionSource(sourceId)) };
  } catch (error) { return { error: formActionErrorMessage(error, "Couldn’t read this file") }; }
}

/** The author's own edit of the laid-out text, read and checked again; an edit of a model's layout keeps its model. */
export async function previewRecognitionText(sourceId: string, habitText: string, model?: string): Promise<RecognitionState> {
  try { return { view: textView(await loadRecognitionSource(sourceId), habitText, "edited", { model }) }; }
  catch (error) { return { error: formActionErrorMessage(error, "Couldn’t read it again") }; }
}

/** Save the reading as a new draft Protocol and open it in the editor. */
export async function saveRecognizedProtocol(input: Parameters<typeof saveRecognition>[0]): Promise<RecognitionState> {
  let target: { protocolId: string; versionId: string };
  try { target = await saveRecognition(input); }
  catch (error) { return { error: formActionErrorMessage(error, "Couldn’t save it as a Protocol") }; }
  revalidatePath("/protocols");
  redirect(`/protocols/${target.protocolId}/versions/${target.versionId}/edit`);
}
