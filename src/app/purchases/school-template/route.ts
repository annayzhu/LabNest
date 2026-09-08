import { getProcurementRecords } from "@/lib/live-data";
import { groupSelectedQuoteLinesBySupplier, toSchoolSelfPurchaseRows, validateSchoolSelfPurchaseRow } from "@/lib/procurement";
import { writeSchoolSelfPurchaseWorkbook } from "@/lib/procurement-excel";
import { prisma } from "@/lib/db";

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
  const query = new URL(request.url).searchParams;
  const snapshotId = query.get("snapshot");
  if (snapshotId) {
    const saved=await prisma.purchaseExportSnapshot.findUnique({where:{id:snapshotId}});
    if(!saved||saved.format!=="xlsx")return Response.json({error:"Workbook snapshot not found"},{status:404});
    return workbookResponse(Buffer.from(saved.content,"base64"),`labnest-zju-${saved.id}.xlsx`);
  }
  const supplierName = query.get("supplier");

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
  const errors=rows.flatMap((row,index)=>{
    const line=group.quoteLines[index];const missing=validateSchoolSelfPurchaseRow(row);
    if(line.amountExclTax==null&&line.unitPriceExclTax==null)missing.push("未税金额或未税单价未记录；请补齐后导出。");
    if(line.taxAmount==null&&line.taxRate==null)missing.push("税额或税率未记录。");
    return missing.map(error=>({row:index+1,quoteId:line.id,error}));
  });
  if(errors.length)return Response.json({error:"请补齐所选模板的必填字段。",errors},{status:422});
  const buffer = await writeSchoolSelfPurchaseWorkbook(rows);
  const snapshot=await prisma.$transaction(async tx=>{
    const saved=await tx.purchaseExportSnapshot.create({data:{format:"xlsx",content:buffer.toString("base64")}});
    await tx.activityLog.create({data:{action:"export",targetType:"purchase_export",targetId:saved.id,metadataJson:{template:"school-self-purchase",supplier:supplierName,quoteIds:group.quoteLines.map(line=>line.id),rows}}});
    return saved;
  });
  const filename = `labnest-zju-self-purchase-${safeFilenamePart(group.supplierName) || "supplier"}-${snapshot.id}.xlsx`;
  const response=workbookResponse(buffer,filename);response.headers.set("X-Export-Snapshot",snapshot.id);return response;
}
