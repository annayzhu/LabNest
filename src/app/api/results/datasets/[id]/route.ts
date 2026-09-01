import { unlink } from "node:fs/promises";
import { readManagedDataset, resolveDatasetPath } from "@/lib/result-datasets";
import { prisma } from "@/lib/db";
import { refreshResultValidation } from "@/lib/result-validation";
import { cleanupErrorMessage, runPostCommitCleanup } from "@/lib/post-commit-cleanup";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const dataset = await prisma.resultDataset.findUnique({ where: { id } });
  if (!dataset) return Response.json({ error: "Dataset not found." }, { status: 404 });
  if (dataset.storageMode === "external_reference") return Response.json({ error: "External datasets are not downloaded through LabNest.", externalUri: dataset.externalUri }, { status: 409 });
  if (!dataset.storagePath) return Response.json({ error: "Dataset storage path is missing." }, { status: 500 });
  const buffer = await readManagedDataset(dataset.storagePath);
  return new Response(new Uint8Array(buffer), { headers: { "content-type": dataset.mimeType ?? "application/octet-stream", "content-length": String(buffer.length), "content-disposition": `attachment; filename="${(dataset.sourceFileName ?? dataset.name).replaceAll('"', "'")}"` } });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const dataset = await prisma.resultDataset.findUnique({ where: { id } });
  if (!dataset) return Response.json({ error: "Dataset not found." }, { status: 404 });
  await prisma.$transaction([
    prisma.activityLog.create({ data: { action: "delete_dataset", targetType: "result", targetId: dataset.resultId, metadataJson: { datasetId: dataset.id, name: dataset.name, checksum: dataset.checksum } } }),
    prisma.resultDataset.delete({ where: { id: dataset.id } }),
  ]);
  const cleanupWarnings = await runPostCommitCleanup([
    ...(dataset.storagePath ? [{ name: "remove dataset storage", run: async () => {
      await unlink(resolveDatasetPath(dataset.storagePath!)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
    } }] : []),
    { name: "refresh result validation", run: async () => { await refreshResultValidation(dataset.resultId); } },
  ], async (taskName, error) => {
    await prisma.activityLog.create({ data: {
      action: "dataset_cleanup_pending",
      targetType: "result",
      targetId: dataset.resultId,
      metadataJson: { datasetId: dataset.id, storagePath: dataset.storagePath, resultId: dataset.resultId, taskName, error: cleanupErrorMessage(error) },
    } });
  });
  return Response.json({ removed: true, cleanupWarnings });
}
