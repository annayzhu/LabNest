import { prisma } from "@/lib/db";
import type {
  EntityRecord,
  ProcurementInquiry,
  ProcurementQuoteLine,
  PurchaseRequest,
  SequenceRecord,
} from "@/lib/types";

function optional<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

export async function getEntityRecords(): Promise<EntityRecord[]> {
  const records = await prisma.entity.findMany({
    include: { project: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return records.map((record) => ({
    id: record.id,
    name: record.name,
    type: record.type,
    code: optional(record.code),
    projectName: record.project?.name,
    status: record.status,
    description: record.description ?? "",
  }));
}

export async function getSequenceRecords(): Promise<SequenceRecord[]> {
  const records = await prisma.sequence.findMany({
    include: {
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      entityLinks: { include: { entity: { select: { name: true } } }, orderBy: { order: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  return records.flatMap((record) => {
    const latest = record.versions[0];
    if (!latest) return [];
    return [{
      id: record.id,
      code: record.code,
      name: record.name,
      designType: record.designType,
      status: record.status,
      type: latest.moleculeType,
      sequence: latest.sequence,
      version: latest.displayVersion,
      validationStatus: latest.validationStatus,
      description: record.description ?? "",
      linkedEntity: record.entityLinks.map((link) => link.entity.name).join(", ") || undefined,
    }];
  });
}

export async function getProcurementRecords(): Promise<{
  procurementInquiries: ProcurementInquiry[];
  procurementQuoteLines: ProcurementQuoteLine[];
  purchases: PurchaseRequest[];
}> {
  const [inquiryRecords, quoteLineRecords, purchaseRecords] = await Promise.all([
    prisma.procurementInquiry.findMany({
      include: { project: true, quoteLines: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.procurementQuoteLine.findMany({
      include: { purchaseRequest: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchaseRequest.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return {
    procurementInquiries: inquiryRecords.map((record) => ({
      id: record.id,
      title: record.title,
      status: record.status,
      sourceType: record.sourceType,
      projectId: optional(record.projectId),
      projectName: record.project?.name,
      importedFileName: optional(record.importedFileName),
      supplierScope: optional(record.supplierScope),
      quotedAt: record.quotedAt?.toISOString(),
      notes: optional(record.notes),
      quoteLineIds: record.quoteLines.map((line) => line.id),
      createdAt: record.createdAt.toISOString(),
    })),
    procurementQuoteLines: quoteLineRecords.map((record) => ({
      id: record.id,
      inquiryId: record.inquiryId,
      status: record.status,
      supplierName: optional(record.supplierName),
      productCategory: optional(record.productCategory),
      productName: record.productName,
      casNumber: optional(record.casNumber),
      specification: optional(record.specification),
      quantity: record.quantity,
      packageUnit: record.packageUnit,
      amountExclTax: optional(record.amountExclTax),
      taxAmount: optional(record.taxAmount),
      unitPriceExclTax: optional(record.unitPriceExclTax),
      specialPurchaseNote: optional(record.specialPurchaseNote),
      capacity: optional(record.capacity),
      capacityUnit: optional(record.capacityUnit),
      brand: optional(record.brand),
      catalogNumber: optional(record.catalogNumber),
      taxRate: optional(record.taxRate),
      amountInclTax: optional(record.amountInclTax),
      decisionReason: optional(record.decisionReason),
      selectedAt: record.selectedAt?.toISOString(),
      purchaseRequestId: record.purchaseRequest?.id,
    })),
    purchases: purchaseRecords.map((record) => ({
      id: record.id,
      title: record.title,
      status: record.status,
      vendor: optional(record.vendor),
      catalogNumber: optional(record.catalogNumber),
      procurementQuoteLineId: optional(record.procurementQuoteLineId),
      quantity: record.quantity,
      unit: record.unit,
      price: optional(record.price),
      orderDate: record.orderDate?.toISOString(),
      receivedDate: record.receivedDate?.toISOString(),
      notes: optional(record.notes),
    })),
  };
}
