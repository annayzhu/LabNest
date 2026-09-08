import { parseStructuredFile, parseColumnOverrides } from "@/lib/structured-files";
import { validateStructuredImport } from "@/lib/structured-import";
import { isStructuredModuleKey } from "@/lib/structured-modules";
import { createImportConfirmation } from "@/lib/structured-import-confirmation";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ module: string }> }) {
  const { module } = await context.params;
  if (!isStructuredModuleKey(module)) return Response.json({ error: "Unknown structured import module." }, { status: 404 });
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Choose an import file." }, { status: 400 });
  try {
    const parsed = await parseStructuredFile(file, module, ["inventory","purchases"].includes(module)?parseColumnOverrides(formData.get("mapping")):{});
    const validation = await validateStructuredImport(parsed);
    validation.preview.confirmationToken = createImportConfirmation(parsed);
    return Response.json({ preview: validation.preview });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The file could not be previewed." }, { status: 400 });
  }
}
