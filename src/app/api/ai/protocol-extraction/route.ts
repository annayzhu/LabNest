import { resolveConnectedAdapter } from "@/lib/ai-server";
import { validateAIRequest } from "@/lib/ai-request";
import { projectProtocolDocument } from "@/lib/protocol-document";
import { buildExtractionContext, buildExtractionPrompt, checkProposal, parseRawProposal, signProposal } from "@/lib/protocol-extraction";
import { parseStructuredFile } from "@/lib/structured-files";
import { validateStructuredImport } from "@/lib/structured-import";

export const runtime = "nodejs";

/**
 * Sends one previewed Protocol document's text to the connected model and returns checked, signed
 * suggestions. Nothing is written; the import confirmation applies only the items the user accepts.
 */
export async function POST(request: Request) {
  const boundary = validateAIRequest(request, "multipart/form-data");
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  const resolved = await resolveConnectedAdapter();
  if (!resolved.ok) return Response.json({ error: resolved.error }, { status: resolved.status });
  const { adapter, config } = resolved;
  if (!adapter.complete) return Response.json({ error: `Provider "${config.name}" cannot run extraction.` }, { status: 409 });

  const formData = await request.formData();
  const file = formData.get("file");
  const checksum = String(formData.get("checksum") ?? "");
  const rowIndex = Number(formData.get("rowIndex") ?? "0");
  if (!(file instanceof File)) return Response.json({ error: "Choose the previewed Protocol file again." }, { status: 400 });
  if (!Number.isInteger(rowIndex) || rowIndex < 0) return Response.json({ error: "Invalid record index." }, { status: 400 });

  let parsed;
  let validation;
  try {
    parsed = await parseStructuredFile(file, "protocols", {});
    validation = await validateStructuredImport(parsed);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The file could not be read." }, { status: 400 });
  }
  if (!checksum || parsed.checksum !== checksum) return Response.json({ error: "The selected file changed after preview. Preview it again." }, { status: 409 });
  const row = validation.prepared.find((candidate) => candidate.index === rowIndex);
  if (!row || row.data.kind !== "protocols") return Response.json({ error: "This record must pass validation before AI extraction." }, { status: 422 });

  const projection = projectProtocolDocument(row.data.document);
  const context = buildExtractionContext(row.data.document, projection);
  const { system, user } = buildExtractionPrompt(context);
  try {
    const { text, model } = await adapter.complete(system, user);
    const raw = parseRawProposal(text);
    const { items, warnings } = checkProposal(raw, context, projection);
    const signed = signProposal({
      checksum: parsed.checksum,
      rowIndex,
      provider: config.name,
      model: model ?? null,
      items,
      warnings: context.truncated ? [`Only the first part of the document was sent to the model.`, ...warnings] : warnings,
      truncated: context.truncated,
    });
    return Response.json(signed);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The model request failed." }, { status: 502 });
  }
}
