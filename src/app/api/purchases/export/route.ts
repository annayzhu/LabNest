import { prisma } from "@/lib/db";
import { toCsv, downloadResponse } from "@/lib/export";
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("snapshot");
  if (id) {
    const saved = await prisma.purchaseExportSnapshot.findUnique({where:{id}});
    if (!saved) return Response.json({error:"Export snapshot not found"},{status:404});
    return downloadResponse(saved.content, `purchases-${saved.id}.csv`, "text/csv; charset=utf-8");
  }
  const purchases = await prisma.purchaseRequest.findMany({
    where: { status: { in: ["ordered", "received"] } },
    orderBy: { createdAt: "asc" },
  });
  const content = toCsv(
    purchases.map((p) => ({
      id: p.id,
      title: p.title,
      quantity: p.quantity,
      unit: p.unit,
      actualAmount: p.actualAmount?.toFixed(2) ?? "",
      currency: p.currency,
      vendor: p.vendor,
      invoiceStatus: p.invoiceStatus,
      invoiceReference: p.invoiceReference,
      status: p.status,
    })),
    [
      "id",
      "title",
      "quantity",
      "unit",
      "actualAmount",
      "currency",
      "vendor",
      "invoiceStatus",
      "invoiceReference",
      "status",
    ],
  );
  const snapshot = await prisma.purchaseExportSnapshot.create({
    data: { content, format: "csv" },
  });
  return downloadResponse(
    content,
    `purchases-${snapshot.id}.csv`,
    "text/csv; charset=utf-8",
  );
}
