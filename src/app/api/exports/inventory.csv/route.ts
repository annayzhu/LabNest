import { downloadResponse, formatExportTimestamp, toCsv } from "@/lib/export";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const items = await prisma.inventoryItem.findMany({
    include: { entity: true, location: true, parentInventoryItem: true },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  const rows = items.map((item) => ({
    id: item.id,
    name: item.name,
    englishName: item.englishName,
    category: item.category,
    brand: item.brand,
    entity: item.entity?.name,
    containerType: item.containerType,
    barcode: item.barcode,
    aliquotCode: item.aliquotCode,
    lotNumber: item.lotNumber,
    vendor: item.vendor,
    catalogNumber: item.catalogNumber,
    casNumber: item.casNumber,
    currentQuantity: item.currentQuantity,
    unit: item.unit,
    lowThreshold: item.lowThreshold,
    concentration: item.concentration,
    location: item.location?.name,
    positionCode: item.positionCode,
    parentInventoryItem: item.parentInventoryItem?.name,
    freezeThawCount: item.freezeThawCount,
    expiryDate: item.expiryDate,
    storageCondition: item.storageCondition,
    status: item.status,
    notes: item.notes,
  }));
  const headers = [
    "id",
    "name",
    "englishName",
    "category",
    "brand",
    "entity",
    "containerType",
    "barcode",
    "aliquotCode",
    "lotNumber",
    "vendor",
    "catalogNumber",
    "casNumber",
    "currentQuantity",
    "unit",
    "lowThreshold",
    "concentration",
    "location",
    "positionCode",
    "parentInventoryItem",
    "freezeThawCount",
    "expiryDate",
    "storageCondition",
    "status",
    "notes",
  ] as const;

  return downloadResponse(
    toCsv(rows, headers),
    `labnest-inventory-${formatExportTimestamp()}.csv`,
    "text/csv; charset=utf-8",
  );
}
