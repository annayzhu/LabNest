import { revalidatePath } from "next/cache";
import { cleanupPreparedAttachmentFiles, prepareAttachmentFile, writePreparedAttachmentFiles } from "@/lib/attachment-files";
import { prisma } from "@/lib/db";
import { parseStructuredFile } from "@/lib/structured-files";
import { commitStructuredImport, validateStructuredImport } from "@/lib/structured-import";
import { isStructuredModuleKey } from "@/lib/structured-modules";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ module: string }> }) {
  const { module } = await context.params;
  if (!isStructuredModuleKey(module)) return Response.json({ error: "Unknown structured import module." }, { status: 404 });
  const formData = await request.formData();
  const file = formData.get("file");
  const expectedChecksum = String(formData.get("checksum") ?? "");
  if (!(file instanceof File)) return Response.json({ error: "Choose the same source file again before confirming." }, { status: 400 });

  let attachmentId: string | undefined;
  let preparedFile: Awaited<ReturnType<typeof prepareAttachmentFile>> | undefined;
  try {
    const parsed = await parseStructuredFile(file, module);
    if (!expectedChecksum || parsed.checksum !== expectedChecksum) return Response.json({ error: "The selected file changed after preview. Preview it again before importing." }, { status: 409 });
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
      metadataJson: { ...preparedFile.metadataJson, importModule: module, importFormat: parsed.format },
    } });
    attachmentId = attachment.id;
    const result = await commitStructuredImport(parsed, validation, attachment.id);
    revalidatePath(`/${module}`);
    revalidatePath("/");
    return Response.json({ result }, { status: 201 });
  } catch (error) {
    if (attachmentId) await prisma.attachment.delete({ where: { id: attachmentId } }).catch(() => undefined);
    if (preparedFile) await cleanupPreparedAttachmentFiles([preparedFile]);
    return Response.json({ error: error instanceof Error ? error.message : "The structured import failed." }, { status: 400 });
  }
}
