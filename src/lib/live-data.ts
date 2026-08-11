import { prisma } from "@/lib/db";
import type {
  EntityRecord,
  InventoryItem,
  ProcurementInquiry,
  ProcurementQuoteLine,
  ProposedAction,
  PurchaseRequest,
  SampleLifecycleEvent,
  SampleProfile,
  SampleWarning,
  SequenceRecord,
} from "@/lib/types";

function optional<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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
    include: { entities: { select: { name: true }, orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });

  return records.map((record) => ({
    id: record.id,
    name: record.name,
    type: record.type,
    sequence: record.sequence,
    description: record.description ?? "",
    linkedEntity: record.entities.map((entity) => entity.name).join(", ") || undefined,
  }));
}

export async function getProposedActionRecords(): Promise<ProposedAction[]> {
  const records = await prisma.proposedAction.findMany({
    orderBy: { createdAt: "desc" },
  });

  return records.map((record) => {
    const payload = jsonRecord(record.payloadJson);
    const affectedItem = [
      payload.inventory_item_name,
      payload.title,
      payload.product_name,
      payload.entity_name,
    ].find((value): value is string => typeof value === "string" && value.length > 0);

    return {
      id: record.id,
      sourceType: record.sourceType,
      sourceLabel: record.sourceId ? `${record.sourceType}:${record.sourceId}` : record.sourceType,
      actionType: record.actionType,
      status: record.status,
      confidence: optional(record.confidence),
      reason: record.reason ?? "No reason recorded.",
      payload,
      affectedItem,
      createdAt: record.createdAt.toISOString(),
    };
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

function serializeInventoryItem(record: {
  id: string;
  name: string;
  englishName: string | null;
  category: string | null;
  brand: string | null;
  principalInvestigator: string | null;
  entityId: string | null;
  containerType: string | null;
  barcode: string | null;
  aliquotCode: string | null;
  lotNumber: string | null;
  vendor: string | null;
  catalogNumber: string | null;
  casNumber: string | null;
  currentQuantity: number;
  unit: string;
  lowThreshold: number | null;
  concentration: string | null;
  positionCode: string | null;
  parentInventoryItemId: string | null;
  freezeThawCount: number;
  expiryDate: Date | null;
  storageCondition: string | null;
  status: "active" | "inactive" | "archived";
  notes: string | null;
  location: { name: string } | null;
}): InventoryItem {
  return {
    id: record.id,
    name: record.name,
    englishName: optional(record.englishName),
    category: optional(record.category),
    brand: optional(record.brand),
    principalInvestigator: optional(record.principalInvestigator),
    entityId: optional(record.entityId),
    containerType: optional(record.containerType),
    barcode: optional(record.barcode),
    aliquotCode: optional(record.aliquotCode),
    lotNumber: optional(record.lotNumber),
    vendor: optional(record.vendor),
    catalogNumber: optional(record.catalogNumber),
    casNumber: optional(record.casNumber),
    currentQuantity: record.currentQuantity,
    unit: record.unit,
    lowThreshold: optional(record.lowThreshold),
    concentration: optional(record.concentration),
    location: record.location?.name ?? "not placed",
    positionCode: optional(record.positionCode),
    parentInventoryItemId: optional(record.parentInventoryItemId),
    freezeThawCount: record.freezeThawCount,
    expiryDate: record.expiryDate?.toISOString(),
    storageCondition: optional(record.storageCondition),
    status: record.status,
    notes: optional(record.notes),
  };
}

function sampleWarnings(
  items: InventoryItem[],
  profileFreezeThawCount: number,
  now: Date,
): SampleWarning[] {
  const warnings: SampleWarning[] = [];
  const activeItems = items.filter((item) => item.status === "active");

  if (activeItems.some((item) => item.location === "not placed")) {
    warnings.push({
      type: "missing_location",
      severity: "action",
      message: "At least one active aliquot has no storage location.",
    });
  }

  if (activeItems.some((item) => item.lowThreshold !== undefined && item.currentQuantity <= item.lowThreshold)) {
    warnings.push({
      type: "low_quantity",
      severity: "action",
      message: "At least one active aliquot is at or below its low-quantity threshold.",
    });
  }

  const warningHorizon = now.getTime() + 30 * 24 * 60 * 60 * 1000;
  if (activeItems.some((item) => item.expiryDate && new Date(item.expiryDate).getTime() <= warningHorizon)) {
    warnings.push({
      type: "expiry",
      severity: "watch",
      message: "At least one active aliquot is expired or will expire within 30 days.",
    });
  }

  if (profileFreezeThawCount >= 2 || activeItems.some((item) => (item.freezeThawCount ?? 0) >= 2)) {
    warnings.push({
      type: "freeze_thaw",
      severity: "watch",
      message: "Freeze-thaw history has reached the review threshold.",
    });
  }

  return warnings;
}

export async function getSampleLedger(): Promise<{
  sampleProfiles: SampleProfile[];
  inventoryItems: InventoryItem[];
  sampleLifecycleEvents: SampleLifecycleEvent[];
}> {
  const records = await prisma.sampleProfile.findMany({
    include: {
      entity: {
        include: {
          project: true,
          inventoryItems: { include: { location: true }, orderBy: { createdAt: "asc" } },
        },
      },
      events: {
        include: {
          experiment: true,
          inventoryItem: true,
          fromLocation: true,
          toLocation: true,
        },
        orderBy: { occurredAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  const inventoryItems = records.flatMap((record) =>
    record.entity.inventoryItems.map(serializeInventoryItem),
  );

  const sampleProfiles: SampleProfile[] = records.map((record) => {
    const items = record.entity.inventoryItems.map(serializeInventoryItem);
    const unit = items[0]?.unit ?? "item";
    const relatedExperimentIds = Array.from(new Set(
      record.events.flatMap((event) => event.experimentId ? [event.experimentId] : []),
    ));

    return {
      id: record.id,
      entityId: record.entityId,
      name: record.entity.name,
      sampleCode: record.sampleCode,
      sampleType: record.sampleType,
      sourceLabel: optional(record.sourceLabel),
      sourceType: optional(record.sourceType),
      parentSampleId: optional(record.parentSampleId),
      projectId: optional(record.entity.projectId),
      projectName: record.entity.project?.name,
      status: record.status,
      collectedAt: record.collectedAt?.toISOString(),
      preparedAt: record.preparedAt?.toISOString(),
      biosafetyLevel: optional(record.biosafetyLevel),
      storageRequirement: optional(record.storageRequirement),
      freezeThawCount: record.freezeThawCount,
      aliquotCount: items.length,
      totalQuantity: items
        .filter((item) => item.unit === unit)
        .reduce((sum, item) => sum + item.currentQuantity, 0),
      unit,
      primaryLocation: items.find((item) => item.status === "active")?.location,
      relatedExperimentIds,
      warnings: sampleWarnings(items, record.freezeThawCount, now),
      notes: optional(record.notes),
    };
  });

  const sampleLifecycleEvents: SampleLifecycleEvent[] = records.flatMap((record) =>
    record.events.map((event) => ({
      id: event.id,
      sampleProfileId: event.sampleProfileId,
      type: event.type,
      title: event.title,
      occurredAt: event.occurredAt.toISOString(),
      experimentId: optional(event.experimentId),
      experimentTitle: event.experiment?.title,
      inventoryItemId: optional(event.inventoryItemId),
      aliquotCode: event.inventoryItem?.aliquotCode ?? undefined,
      fromLocation: event.fromLocation?.name,
      toLocation: event.toLocation?.name,
      quantityChange: optional(event.quantityChange),
      unit: optional(event.unit),
      notes: optional(event.notes),
    })),
  );

  return { sampleProfiles, inventoryItems, sampleLifecycleEvents };
}
