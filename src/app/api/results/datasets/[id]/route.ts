import { readManagedDataset } from "@/lib/result-datasets";
import { prisma } from "@/lib/db";

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
