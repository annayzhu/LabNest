import { prisma } from "@/lib/db";
import { saveManagedDataset } from "@/lib/result-datasets";
import { resultTemplateDatasetByKey, validateDatasetPreview } from "@/lib/result-templates";
import { refreshResultValidation } from "@/lib/result-validation";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: resultId } = await context.params;
  const result = await prisma.result.findUnique({ where: { id: resultId }, select: { id: true, templateSnapshotJson: true } });
  if (!result) return Response.json({ error: "Result not found." }, { status: 404 });
  try {
    const formData = await request.formData();
    const name = String(formData.get("name") ?? "").trim();
    const storageMode = String(formData.get("storageMode") ?? "managed_file");
    const templateDatasetKey = String(formData.get("templateDatasetKey") ?? "").trim() || undefined;
    const templateDataset = resultTemplateDatasetByKey(result.templateSnapshotJson, templateDatasetKey);
    if (templateDatasetKey && !templateDataset) return Response.json({ error: "The selected Dataset slot is not part of this Result Template." }, { status: 400 });
    if (!name) return Response.json({ error: "Dataset name is required." }, { status: 400 });
    if (storageMode === "external_reference") {
      const externalUri = String(formData.get("externalUri") ?? "").trim();
      if (!externalUri) return Response.json({ error: "External URI is required." }, { status: 400 });
      const validation = templateDataset
        ? { status: "warning" as const, errors: [], warnings: ["External Dataset schema was not inspected by LabNest."], checkedAt: new Date().toISOString() }
        : { status: "not_applicable" as const, errors: [], warnings: [], checkedAt: new Date().toISOString() };
      const dataset = await prisma.resultDataset.create({ data: { resultId, name, storageMode: "external_reference", externalUri, templateDatasetKey, schemaJson: templateDataset ?? {}, validationStatus: validation.status, validationJson: validation } });
      await refreshResultValidation(resultId);
      return Response.json({ dataset, validation }, { status: 201 });
    }
    const file = formData.get("file");
    if (!(file instanceof File)) return Response.json({ error: "A dataset file is required." }, { status: 400 });
    const inspected = await saveManagedDataset(file);
    const validation = validateDatasetPreview(templateDataset, inspected);
    const dataset = await prisma.resultDataset.create({ data: { resultId, name, storageMode: "managed_file", sourceFileName: inspected.sourceFileName, mimeType: inspected.mimeType, size: inspected.size, storagePath: inspected.storagePath, checksum: inspected.checksum, rowCount: inspected.rowCount, columnCount: inspected.columnCount, columnsJson: inspected.columns, previewJson: inspected.rows, templateDatasetKey, schemaJson: templateDataset ?? {}, validationStatus: validation.status, validationJson: validation } });
    await refreshResultValidation(resultId);
    return Response.json({ dataset, validation }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Dataset registration failed." }, { status: 400 }); }
}
