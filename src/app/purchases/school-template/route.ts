import { getProcurementRecords } from "@/lib/live-data";
import { groupSelectedQuoteLinesBySupplier, toSchoolSelfPurchaseRows } from "@/lib/procurement";
import { writeSchoolSelfPurchaseWorkbook } from "@/lib/procurement-excel";

export const runtime = "nodejs";

function workbookResponse(buffer: Buffer, filename: string): Response {
  const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

function safeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .slice(0, 60);
}

export async function GET(request: Request) {
  const supplierName = new URL(request.url).searchParams.get("supplier");

  if (!supplierName) {
    return Response.json({ error: "Missing supplier query parameter." }, { status: 400 });
  }

  const { procurementQuoteLines } = await getProcurementRecords();
  const group = groupSelectedQuoteLinesBySupplier(procurementQuoteLines).find(
    (candidate) => candidate.supplierName === supplierName,
  );

  if (!group) {
    return Response.json({ error: "No selected quote lines found for this supplier." }, { status: 404 });
  }

  const rows = toSchoolSelfPurchaseRows(group.quoteLines);
  const buffer = await writeSchoolSelfPurchaseWorkbook(rows);
  const filename = `labnest-zju-self-purchase-${safeFilenamePart(group.supplierName) || "supplier"}.xlsx`;

  return workbookResponse(buffer, filename);
}
