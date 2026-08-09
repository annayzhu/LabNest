import { revalidatePath } from "next/cache";
import { assertEntryFileSet } from "@/lib/attachment-files";
import { entryMutationError, parseEntryMutationFormData } from "@/lib/entry-mutations";
import { updateEntryWithFiles, type EntryMediaOrderToken } from "@/lib/entry-persistence";

export const runtime = "nodejs";

function parseStringArray(value: FormDataEntryValue | null) {
  const parsed: unknown = JSON.parse(String(value ?? "[]"));
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) throw new Error("New file identifiers are invalid.");
  return parsed;
}

function parseMediaOrder(value: FormDataEntryValue | null): EntryMediaOrderToken[] {
  const parsed: unknown = JSON.parse(String(value ?? "[]"));
  if (!Array.isArray(parsed)) throw new Error("Attachment order is invalid.");
  return parsed.map((item) => {
    if (!item || typeof item !== "object" || !("kind" in item) || !("id" in item)) throw new Error("Attachment order is invalid.");
    const token = item as { kind: unknown; id: unknown };
    if ((token.kind !== "existing" && token.kind !== "new") || typeof token.id !== "string") throw new Error("Attachment order is invalid.");
    return { kind: token.kind, id: token.id };
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const input = parseEntryMutationFormData(formData);
    const files = formData.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
    assertEntryFileSet(files);
    const entry = await updateEntryWithFiles(
      id,
      input,
      files,
      parseStringArray(formData.get("newFileIds")),
      parseMediaOrder(formData.get("mediaOrder")),
    );

    ["/entries", `/entries/${entry.id}`, "/search"].forEach((path) => revalidatePath(path));
    return Response.json({ entryId: entry.id });
  } catch (error) {
    return Response.json({ error: entryMutationError(error) }, { status: 400 });
  }
}
