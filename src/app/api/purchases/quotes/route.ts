import { z } from "zod";
import { prisma } from "@/lib/db";
import { toCsv, downloadResponse } from "@/lib/export";
export async function GET(request: Request) {
  const rows = await prisma.procurementQuoteLine.findMany({
    orderBy: { createdAt: "desc" },
  });
  if (new URL(request.url).searchParams.get("format") === "csv")
    return downloadResponse(
      toCsv(
        rows.map((r) => ({
          id: r.id,
          product: r.productName,
          supplier: r.supplierName,
          quantity: r.quantity,
          unit: r.packageUnit,
          quotedAmount: r.amountInclTax,
          status: r.status,
          decision: r.decisionReason,
        })),
        [
          "id",
          "product",
          "supplier",
          "quantity",
          "unit",
          "quotedAmount",
          "status",
          "decision",
        ],
      ),
      "quotes.csv",
      "text/csv; charset=utf-8",
    );
  return Response.json(rows);
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "Origin mismatch" }, { status: 403 });
  try {
    const input = z
      .object({
        id: z.string().min(1),
        status: z.enum(["candidate", "selected", "not_selected"]),
        reason: z.string().trim().max(1000),
      })
      .parse(await request.json());
    return Response.json(
      await prisma.$transaction(async (tx) => {
        const old = await tx.procurementQuoteLine.findUniqueOrThrow({
          where: { id: input.id },
        });
        if (old.status === "converted")
          throw new Error("Converted quote must retain its purchase history.");
        await tx.activityLog.create({
          data: {
            action: "quote_decision",
            targetType: "procurement_quote_line",
            targetId: old.id,
            metadataJson: {
              previousStatus: old.status,
              previousReason: old.decisionReason,
              status: input.status,
              reason: input.reason,
            },
          },
        });
        return tx.procurementQuoteLine.update({
          where: { id: input.id },
          data: {
            status: input.status,
            decisionReason: input.reason || null,
            selectedAt: input.status === "selected" ? new Date() : null,
          },
        });
      }),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Decision failed" },
      { status: 409 },
    );
  }
}
