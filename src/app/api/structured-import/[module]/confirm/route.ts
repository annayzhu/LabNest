import { revalidatePath } from "next/cache";
import { cleanupPreparedAttachmentFiles, prepareAttachmentFile, writePreparedAttachmentFiles } from "@/lib/attachment-files";
import { prisma } from "@/lib/db";
import { applyImportEdits, parseStructuredFile, parseColumnOverrides } from "@/lib/structured-files";
import { importEditsSummary, parseImportEdits } from "@/lib/structured-import-edits";
import { commitStructuredImport, validateStructuredImport } from "@/lib/structured-import";
import { isStructuredModuleKey } from "@/lib/structured-modules";
import { matchesImportConfirmation } from "@/lib/structured-import-confirmation";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ module: string }> }) {
  const { module } = await context.params;
  if (!isStructuredModuleKey(module)) return Response.json({ error: "Unknown structured import module." }, { status: 404 });
  const formData = await request.formData();
  const file = formData.get("file");
  const expectedChecksum = String(formData.get("checksum") ?? "");
  const confirmationToken = String(formData.get("confirmationToken") ?? "");
  if (!(file instanceof File)) return Response.json({ error: "Choose the same source file again before confirming." }, { status: 400 });

  let attachmentId: string | undefined;
  let preparedFile: Awaited<ReturnType<typeof prepareAttachmentFile>> | undefined;
  try {
    const parsed = applyImportEdits(await parseStructuredFile(file, module, parseColumnOverrides(formData.get("mapping"))), parseImportEdits(formData.get("edits"), module));
    if (!expectedChecksum || parsed.checksum !== expectedChecksum) return Response.json({ error: "The selected file changed after preview. Preview it again before importing." }, { status: 409 });
    // What is imported is what was previewed: the same file, column choices and edits.
    if (!matchesImportConfirmation(parsed, confirmationToken)) return Response.json({ errorCode: "IMPORT_CONFIRMATION_CHANGED", error: "The file, filename or import decision changed, or the preview expired. Preview it again before importing." }, { status: 409 });
    const validation = await validateStructuredImport(parsed);
    if (!validation.preview.canImport) return Response.json({ error: "The import no longer passes validation.", preview: validation.preview }, { status: 422 });

    preparedFile = await prepareAttachmentFile(file);
    await writePreparedAttachmentFiles([preparedFile]);
    const attachment = await prisma.attachment.create({ data: {
      filename: preparedFile.filename,
      originalFilename: preparedFile.originalFilename,
      mimeType: preparedFile.mimeType,
      size: preparedFile.size,
      storagePath: preparedFile.storagePath,
      sha256: preparedFile.sha256,
      metadataJson: { ...preparedFile.metadataJson, importModule: module, importFormat: parsed.format, ...(parsed.edits ? { previewEdits: importEditsSummary(parsed.edits) } : {}) },
    } });
    attachmentId = attachment.id;
    const result = await commitStructuredImport(parsed, validation, attachment.id, confirmationToken);
    revalidatePath(`/${module}`);
    revalidatePath("/");
    return Response.json({ result }, { status: 201 });
  } catch (error) {
    if (attachmentId) await prisma.attachment.delete({ where: { id: attachmentId } }).catch(() => undefined);
    if (preparedFile) await cleanupPreparedAttachmentFiles([preparedFile]);
    return Response.json({ error: error instanceof Error ? error.message : "The structured import failed." }, { status: 400 });
  }
}
