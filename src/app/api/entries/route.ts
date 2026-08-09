import { revalidatePath } from "next/cache";
import { assertEntryFileSet } from "@/lib/attachment-files";
import { entryMutationError, parseEntryMutationFormData } from "@/lib/entry-mutations";
import { createEntryWithFiles } from "@/lib/entry-persistence";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const input = parseEntryMutationFormData(formData);
    const files = formData.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
    assertEntryFileSet(files);
    const entry = await createEntryWithFiles(input, files);

    ["/entries", `/entries/${entry.id}`, "/experiments", "/results", "/search"].forEach((path) => revalidatePath(path));
    return Response.json({ entryId: entry.id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: entryMutationError(error) }, { status: 400 });
  }
}
