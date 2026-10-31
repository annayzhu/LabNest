import { resolveConnectedAdapter, resolveVisionAdapter, type ResolvedAdapter } from "./ai-server";
import { prisma } from "./db";
import { productMatches } from "./inventory-duplicates";
import { documentPrompt, isPdf, parseDocumentReply, type DraftRow } from "./inventory-recognition";
import { photoProblem } from "./protocol-photo";
import { readSourceFile } from "./protocol-source-text.server";

export type DraftLine = DraftRow & {
  /** The product the line goes to: the one with its brand and catalogue number, or empty for a new product. */
  productId: string;
  candidates: { id: string; name: string; brand: string | null; catalogNumber: string | null }[];
};
export type DocumentReading = { supplier: string | null; invoiceNumber: string | null; lines: DraftLine[]; warnings: string[] };

/**
 * Reads purchase documents with the AI services: pictures with the service that reads pictures, PDFs (by their text)
 * and pasted text with the default service. A file that cannot be read becomes a warning; the others still count.
 * Only file names, sizes and the model are logged, never the content.
 */
export async function readPurchaseDocuments(files: File[], text: string): Promise<DocumentReading> {
  const vision = files.some((file) => !isPdf(file)) ? await ready(resolveVisionAdapter({ timeoutMs: 120_000 }), "describeImage") : undefined;
  const writer = files.some(isPdf) || text ? await ready(resolveConnectedAdapter({ timeoutMs: 120_000 }), "complete") : undefined;
  const warnings: string[] = [];
  const models = new Set<string>();
  const documents = [];

  for (const file of files) {
    try {
      let answer: { text: string; model?: string };
      if (isPdf(file)) {
        const source = await readSourceFile(file.name, new Uint8Array(await file.arrayBuffer()));
        if (source.text.replace(/\s/g, "").length < 40) { warnings.push(`${file.name} has no text to read; photograph or screenshot it instead.`); continue; }
        answer = await writer!.adapter.complete!(documentPrompt.system, documentPrompt.user(source.text));
      } else {
        const problem = photoProblem(file);
        if (problem) { warnings.push(`${file.name}: ${problem}`); continue; }
        answer = await vision!.adapter.describeImage!(documentPrompt.system, documentPrompt.user(), { mimeType: file.type, base64: Buffer.from(await file.arrayBuffer()).toString("base64") });
      }
      if (answer.model) models.add(answer.model);
      documents.push(parseDocumentReply(answer.text));
    } catch (error) {
      warnings.push(`${file.name} could not be read: ${error instanceof Error ? error.message : "the model did not answer."}`);
    }
  }
  if (text) {
    const answer = await writer!.adapter.complete!(documentPrompt.system, documentPrompt.user(text));
    if (answer.model) models.add(answer.model);
    documents.push(parseDocumentReply(answer.text));
  }
  for (const service of [vision, writer]) await service?.gate.assertAllowed();

  const supplier = documents.find((document) => document.supplier)?.supplier ?? null;
  const invoiceNumber = documents.find((document) => document.invoiceNumber)?.invoiceNumber ?? null;
  const products = await prisma.inventoryProduct.findMany({ where: { status: "active" }, select: { id: true, name: true, englishName: true, brand: true, catalogNumber: true, casNumber: true }, orderBy: { createdAt: "asc" } });
  const lines = documents.flatMap((document) => document.rows).map((row): DraftLine => {
    const match = productMatches({ name: row.name, brand: row.brand, catalogNumber: row.catalogNumber, supplier }, products);
    return { ...row, productId: match.exact?.id ?? "", candidates: match.candidates.map(({ id, name, brand, catalogNumber }) => ({ id, name, brand, catalogNumber })) };
  });
  const used = vision ?? writer!;
  await prisma.activityLog.create({ data: { action: "inventory_documents_read", targetType: "ai_provider", targetId: used.config.id, metadataJson: { files: files.map((file) => ({ name: file.name, bytes: file.size })), pastedCharacters: text.length, lines: lines.length, models: [...models] } } });
  return { supplier, invoiceNumber, lines, warnings };
}

/** The service, or why it cannot be used, as an error a person can act on. */
async function ready(pending: Promise<ResolvedAdapter>, ability: "complete" | "describeImage") {
  const resolved = await pending;
  if (!resolved.ok) throw new Error(resolved.error);
  if (!resolved.adapter[ability]) throw new Error(ability === "describeImage" ? `“${resolved.config.name}” cannot read pictures.` : `“${resolved.config.name}” cannot read documents here.`);
  return resolved;
}
