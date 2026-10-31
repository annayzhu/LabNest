"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveConnectedAdapter } from "@/lib/ai-server";
import { cleanupPreparedAttachmentFiles, prepareAttachmentFile, writePreparedAttachmentFiles } from "@/lib/attachment-files";
import { columnPrompt, parseColumnReply } from "@/lib/column-suggestion";
import { prisma } from "@/lib/db";
import { formActionErrorMessage } from "@/lib/form-actions";
import { draftRecords } from "@/lib/inventory-recognition";
import { readPurchaseDocuments, type DocumentReading } from "@/lib/inventory-recognition.server";
import { parseColumnOverrides, readColumnSamples } from "@/lib/structured-files";
import { commitStructuredImport, validateStructuredImport } from "@/lib/structured-import";
import { structuredModules } from "@/lib/structured-modules";

/**
 * Suggests fields for the spreadsheet columns the import did not recognise. Only their headers and first five values
 * go to the model; the suggestion fills the preview's column choices, and the preview still checks every row.
 */
export async function suggestImportColumns(formData: FormData): Promise<{ overrides?: Record<string, string>; error?: string }> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Choose an import file first.");
    const columns = await readColumnSamples(file, "inventory", parseColumnOverrides(formData.get("mapping")));
    const open = columns.filter((column) => !column.target);
    if (!open.length) return { overrides: {} };
    const taken = new Set(columns.flatMap((column) => (column.target ? [column.target] : [])));
    const fields = structuredModules.inventory.fields.filter((field) => !taken.has(field.key));
    const resolved = await resolveConnectedAdapter({ timeoutMs: 60_000 });
    if (!resolved.ok) throw new Error(resolved.error);
    if (!resolved.adapter.complete) throw new Error(`“${resolved.config.name}” cannot answer here.`);
    const prompt = columnPrompt(fields, open);
    const answer = await resolved.adapter.complete(prompt.system, prompt.user);
    await resolved.gate.assertAllowed();
    const overrides = parseColumnReply(answer.text, fields.map((field) => field.key), open.map((column) => column.source));
    await prisma.activityLog.create({ data: { action: "import_columns_suggested", targetType: "ai_provider", targetId: resolved.config.id, metadataJson: { file: file.name, columns: open.length, suggested: Object.keys(overrides).length, model: answer.model ?? null } } });
    return { overrides };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The columns could not be suggested.") };
  }
}

/** Reads invoices, delivery notes, labels or pasted text into draft lines; nothing is stored until the draft is imported. */
export async function readInventoryDocuments(formData: FormData): Promise<DocumentReading & { error?: string }> {
  try {
    const files = formData.getAll("file").filter((value): value is File => value instanceof File && value.size > 0);
    const text = String(formData.get("text") ?? "").trim();
    if (!files.length && !text) throw new Error("Choose a picture or PDF, or paste the text.");
    if (files.length > 10) throw new Error("Read at most 10 files at a time.");
    return await readPurchaseDocuments(files, text);
  } catch (error) {
    return { supplier: null, invoiceNumber: null, lines: [], warnings: [], error: formActionErrorMessage(error, "The documents could not be read.") };
  }
}

const draftSchema = z.object({
  supplier: z.string().trim().max(240).nullable(),
  invoiceNumber: z.string().trim().max(120).nullable(),
  rows: z.array(z.object({
    name: z.string().trim().min(1, "Every line needs a name.").max(180),
    brand: z.string().trim().max(120),
    catalogNumber: z.string().trim().max(120),
    packSize: z.string().trim().max(120),
    quantity: z.string().trim(),
    unit: z.string().trim().max(32),
    lotNumber: z.string().trim().max(120),
    expiryDate: z.string().trim(),
    location: z.string().trim().max(240),
    productId: z.string().trim(),
  })).min(1, "Keep at least one line.").max(100),
});

/**
 * Imports the checked draft through the inventory import: each line arrives as stock with a receive movement, under
 * the product chosen for it or one found by brand + catalogue number. The original files are kept as the import's
 * source, so the same document cannot be imported twice; the invoice number goes into the movement notes.
 */
export async function importInventoryDraft(formData: FormData): Promise<{ href?: string; error?: string; problems?: string[] }> {
  const prepared: Awaited<ReturnType<typeof prepareAttachmentFile>>[] = [];
  const attachmentIds: string[] = [];
  try {
    const draft = draftSchema.parse(JSON.parse(String(formData.get("draft") ?? "{}")));
    const files = formData.getAll("file").filter((value): value is File => value instanceof File && value.size > 0);
    const text = String(formData.get("text") ?? "").trim();
    const sources = files.length ? files : text ? [new File([text], "pasted-text.txt", { type: "text/plain" })] : [];
    if (!sources.length) throw new Error("The documents the draft was read from are missing; read them again.");
    const checksum = createHash("sha256").update(Buffer.from(await sources[0].arrayBuffer())).digest("hex");
    const parsed = {
      module: "inventory" as const,
      format: "json" as const,
      fileName: draft.invoiceNumber ? `${sources[0].name} · invoice ${draft.invoiceNumber}` : sources[0].name,
      checksum,
      records: draftRecords(draft.rows, draft),
      mapping: [],
      warnings: [],
    };
    const validation = await validateStructuredImport(parsed);
    if (!validation.preview.canImport) {
      return { problems: [...validation.preview.errors, ...validation.preview.rows.flatMap((row) => row.errors.map((error) => `${row.index}: ${error}`))] };
    }
    for (const file of sources) prepared.push(await prepareAttachmentFile(file));
    await writePreparedAttachmentFiles(prepared);
    for (const file of prepared) {
      const attachment = await prisma.attachment.create({ data: { filename: file.filename, originalFilename: file.originalFilename, mimeType: file.mimeType, size: file.size, storagePath: file.storagePath, sha256: file.sha256, metadataJson: { ...file.metadataJson, importModule: "inventory", importFormat: "document" } } });
      attachmentIds.push(attachment.id);
    }
    const result = await commitStructuredImport(parsed, validation, attachmentIds[0]);
    // Every page or photo of the document stays with the stock it brought in.
    const extra = attachmentIds.slice(1).flatMap((attachmentId) => result.targets.map((target, order) => ({ attachmentId, targetType: target.targetType, targetId: target.targetId, linkType: "structured_import_source", order })));
    if (extra.length) await prisma.attachmentLink.createMany({ data: extra });
    revalidatePath("/inventory");
    revalidatePath("/inventory/products");
    return { href: result.count === 1 ? result.href : "/inventory/list" };
  } catch (error) {
    if (attachmentIds.length) await prisma.attachment.deleteMany({ where: { id: { in: attachmentIds } } }).catch(() => undefined);
    if (prepared.length) await cleanupPreparedAttachmentFiles(prepared);
    return { error: formActionErrorMessage(error, "The draft could not be imported.") };
  }
}
