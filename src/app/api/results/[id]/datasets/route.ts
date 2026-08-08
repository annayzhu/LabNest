import { prisma } from "@/lib/db";
import { saveManagedDataset } from "@/lib/result-datasets";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: resultId } = await context.params;
  const result = await prisma.result.findUnique({ where: { id: resultId }, select: { id: true } });
  if (!result) return Response.json({ error: "Result not found." }, { status: 404 });
  try {
    const formData = await request.formData();
    const name = String(formData.get("name") ?? "").trim();
    const storageMode = String(formData.get("storageMode") ?? "managed_file");
    if (!name) return Response.json({ error: "Dataset name is required." }, { status: 400 });
    if (storageMode === "external_reference") {
      const externalUri = String(formData.get("externalUri") ?? "").trim();
      if (!externalUri) return Response.json({ error: "External URI is required." }, { status: 400 });
      const dataset = await prisma.resultDataset.create({ data: { resultId, name, storageMode: "external_reference", externalUri } });
      return Response.json({ dataset }, { status: 201 });
    }
    const file = formData.get("file");
    if (!(file instanceof File)) return Response.json({ error: "A dataset file is required." }, { status: 400 });
    const inspected = await saveManagedDataset(file);
    const dataset = await prisma.resultDataset.create({ data: { resultId, name, storageMode: "managed_file", sourceFileName: inspected.sourceFileName, mimeType: inspected.mimeType, size: inspected.size, storagePath: inspected.storagePath, checksum: inspected.checksum, rowCount: inspected.rowCount, columnCount: inspected.columnCount, columnsJson: inspected.columns, previewJson: inspected.rows } });
    return Response.json({ dataset }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Dataset registration failed." }, { status: 400 }); }
}
