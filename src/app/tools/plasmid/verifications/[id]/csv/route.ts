import { downloadResponse } from "@/lib/export";
import { prisma } from "@/lib/db";
import { itemRows, toCsv } from "@/lib/plasmid/verification";

export const runtime = "nodejs";

/** 差异表 (Q379): every item of one check with its disposition, 1-based. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await prisma.plasmidVerification.findUnique({ where: { id }, select: { id: true, product: { select: { name: true } }, items: { orderBy: { order: "asc" } } } });
  if (!record) return new Response("Not found", { status: 404 });
  const name = record.product.name.replace(/[^\w.-]+/g, "_").slice(0, 60) || "plasmid";
  return downloadResponse(`﻿${toCsv(itemRows(record.items))}`, `${name}-check-${record.id.slice(-6)}.csv`, "text/csv; charset=utf-8");
}
