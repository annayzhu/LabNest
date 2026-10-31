-- Inventory classification (docs/modules/inventory/classification-20261030/PLAN.md):
-- five fixed 大类, types in ScientificSchemaDefinition, a product layer above stock lots,
-- kit components, container labels and component states, and movement reversals.

-- AlterTable
ALTER TABLE "InventoryContainer" ADD COLUMN     "componentStates" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "label" TEXT;

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "productId" TEXT;

-- AlterTable
ALTER TABLE "InventoryTransaction" ADD COLUMN     "reversesTransactionId" TEXT;

-- AlterTable
ALTER TABLE "ScientificSchemaDefinition" ADD COLUMN     "inventoryGroupKey" TEXT,
ALTER COLUMN "entityType" DROP NOT NULL;

-- CreateTable
CREATE TABLE "InventoryGroup" (
    "key" TEXT NOT NULL,
    "label" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryGroup_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "InventoryProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "englishName" TEXT,
    "brand" TEXT,
    "catalogNumber" TEXT,
    "casNumber" TEXT,
    "groupKey" TEXT,
    "typeId" TEXT,
    "entityId" TEXT,
    "fieldValues" JSONB NOT NULL DEFAULT '{}',
    "controlLevels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lowThreshold" DOUBLE PRECISION,
    "lowThresholdUnit" TEXT,
    "notes" TEXT,
    "status" "ObjectStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryKitComponent" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spec" TEXT,
    "storageCondition" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryKitComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryProduct_groupKey_idx" ON "InventoryProduct"("groupKey");

-- CreateIndex
CREATE INDEX "InventoryProduct_typeId_idx" ON "InventoryProduct"("typeId");

-- CreateIndex
CREATE INDEX "InventoryProduct_catalogNumber_idx" ON "InventoryProduct"("catalogNumber");

-- CreateIndex
CREATE INDEX "InventoryProduct_entityId_idx" ON "InventoryProduct"("entityId");

-- CreateIndex
CREATE INDEX "InventoryProduct_status_idx" ON "InventoryProduct"("status");

-- CreateIndex
CREATE INDEX "InventoryKitComponent_productId_sortOrder_idx" ON "InventoryKitComponent"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "InventoryItem_productId_idx" ON "InventoryItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransaction_reversesTransactionId_key" ON "InventoryTransaction"("reversesTransactionId");

-- CreateIndex
CREATE INDEX "ScientificSchemaDefinition_inventoryGroupKey_idx" ON "ScientificSchemaDefinition"("inventoryGroupKey");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_reversesTransactionId_fkey" FOREIGN KEY ("reversesTransactionId") REFERENCES "InventoryTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScientificSchemaDefinition" ADD CONSTRAINT "ScientificSchemaDefinition_inventoryGroupKey_fkey" FOREIGN KEY ("inventoryGroupKey") REFERENCES "InventoryGroup"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryProduct" ADD CONSTRAINT "InventoryProduct_groupKey_fkey" FOREIGN KEY ("groupKey") REFERENCES "InventoryGroup"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryProduct" ADD CONSTRAINT "InventoryProduct_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ScientificSchemaDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryProduct" ADD CONSTRAINT "InventoryProduct_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryKitComponent" ADD CONSTRAINT "InventoryKitComponent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The five 大类; a null label shows the built-in name.
INSERT INTO "InventoryGroup" ("key", "sortOrder", "updatedAt") VALUES
  ('reagent', 1, CURRENT_TIMESTAMP),
  ('consumable', 2, CURRENT_TIMESTAMP),
  ('biological', 3, CURRENT_TIMESTAMP),
  ('sample', 4, CURRENT_TIMESTAMP),
  ('equipment', 5, CURRENT_TIMESTAMP);

-- Existing types join inventory with their defaults; custom entities stay outside.
UPDATE "ScientificSchemaDefinition" SET "inventoryGroupKey" = 'reagent',
  "defaultSettings" = "defaultSettings" || '{"inventory":{"managementMode":"precise","unit":"µL","tracksLot":true,"tracksExpiry":true}}'::jsonb,
  "fieldDefinitions" = "fieldDefinitions" || '[{"key":"host","label":"Host"},{"key":"conjugate","label":"Conjugate"},{"key":"class","label":"Primary or secondary","kind":"choice","options":["Primary antibody","Secondary antibody"]}]'::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'antibody';
UPDATE "ScientificSchemaDefinition" SET "inventoryGroupKey" = 'reagent',
  "defaultSettings" = "defaultSettings" || '{"inventory":{"managementMode":"information","unit":"µL","tracksLot":false,"tracksExpiry":false}}'::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" IN ('primer', 'probe', 'sirna', 'grna');
UPDATE "ScientificSchemaDefinition" SET "inventoryGroupKey" = 'reagent',
  "defaultSettings" = "defaultSettings" || '{"inventory":{"managementMode":"precise","unit":"µL","tracksLot":true,"tracksExpiry":true}}'::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'protein';
UPDATE "ScientificSchemaDefinition" SET "inventoryGroupKey" = 'biological',
  "defaultSettings" = "defaultSettings" || '{"inventory":{"managementMode":"package","unit":"vial","tracksLot":false,"tracksExpiry":false}}'::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'cell_line';
UPDATE "ScientificSchemaDefinition" SET "inventoryGroupKey" = 'biological',
  "defaultSettings" = "defaultSettings" || '{"inventory":{"managementMode":"information","unit":"tube","tracksLot":false,"tracksExpiry":false}}'::jsonb,
  "fieldDefinitions" = "fieldDefinitions" || '[{"key":"form","label":"Form","kind":"choice","options":["Glycerol stock","DNA"]}]'::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'plasmid';

-- Types only inventory uses.
INSERT INTO "ScientificSchemaDefinition" ("id", "key", "label", "entityType", "objectKind", "inventoryGroupKey", "fieldDefinitions", "defaultSettings", "updatedAt") VALUES
  ('schema_inv_solution', 'solution', 'Solutions & buffers', NULL, 'inventory', 'reagent', '[{"key":"ph","label":"pH"}]', '{"inventory":{"managementMode":"information","unit":"mL","tracksLot":false,"tracksExpiry":true}}', CURRENT_TIMESTAMP),
  ('schema_inv_medium', 'medium', 'Media & sera', NULL, 'inventory', 'reagent', '[]', '{"inventory":{"managementMode":"package","unit":"bottle","tracksLot":true,"tracksExpiry":true}}', CURRENT_TIMESTAMP),
  ('schema_inv_kit', 'kit', 'Kit', NULL, 'inventory', 'reagent', '[{"key":"reactionsPerKit","label":"Reactions per kit","kind":"number"}]', '{"inventory":{"managementMode":"package","unit":"box","tracksLot":true,"tracksExpiry":true}}', CURRENT_TIMESTAMP),
  ('schema_inv_chemical', 'chemical', 'Chemical', NULL, 'inventory', 'reagent', '[{"key":"purity","label":"Purity"},{"key":"grade","label":"Grade"},{"key":"molecularWeight","label":"Molecular weight","kind":"number"}]', '{"inventory":{"managementMode":"package","unit":"bottle","tracksLot":true,"tracksExpiry":true}}', CURRENT_TIMESTAMP),
  ('schema_inv_gas', 'gas', 'Gas', NULL, 'inventory', 'reagent', '[{"key":"gas","label":"Gas"},{"key":"purity","label":"Purity"},{"key":"rental","label":"Deposit or rental","kind":"choice","options":["Deposit","Rental"]},{"key":"inspectionDue","label":"Cylinder inspection due","kind":"date"}]', '{"inventory":{"managementMode":"package","unit":"cylinder","tracksLot":false,"tracksExpiry":false}}', CURRENT_TIMESTAMP),
  ('schema_inv_strain', 'strain', 'Bacterial strain', NULL, 'inventory', 'biological', '[{"key":"genotype","label":"Genotype"},{"key":"resistance","label":"Antibiotic resistance"}]', '{"inventory":{"managementMode":"package","unit":"tube","tracksLot":false,"tracksExpiry":false}}', CURRENT_TIMESTAMP),
  ('schema_inv_accessory', 'accessory', 'Accessory', NULL, 'inventory', 'equipment', '[{"key":"instrument","label":"Instrument"},{"key":"model","label":"Model number"}]', '{"inventory":{"managementMode":"information","unit":"piece","tracksLot":false,"tracksExpiry":false}}', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Products for existing stock: one per brand + catalogue number, one per linked design, otherwise one per item.
-- The legacy category maps as inventoryClassFromCategory does (src/lib/inventory-types.ts); unknown values stay unclassified (待归类).
CREATE TEMP TABLE "_inventory_product_keys" AS
SELECT i."id" AS "itemId",
  'ip' || substr(md5('inventory-product:' || CASE
    WHEN NULLIF(btrim(i."catalogNumber"), '') IS NOT NULL THEN 'cat:' || lower(btrim(coalesce(i."brand", i."vendor", ''))) || '|' || lower(btrim(i."catalogNumber"))
    WHEN i."entityId" IS NOT NULL THEN 'entity:' || i."entityId"
    ELSE 'item:' || i."id"
  END), 1, 23) AS "productId"
FROM "InventoryItem" i;

INSERT INTO "InventoryProduct" ("id", "name", "englishName", "brand", "catalogNumber", "casNumber", "groupKey", "typeId", "entityId", "lowThreshold", "lowThresholdUnit", "createdAt", "updatedAt")
SELECT DISTINCT ON (k."productId") k."productId", i."name", i."englishName", i."brand", NULLIF(btrim(i."catalogNumber"), ''), i."casNumber",
  CASE i."category" WHEN 'reagent' THEN 'reagent' WHEN 'antibody' THEN 'reagent' WHEN 'kit' THEN 'reagent' WHEN 'chemical' THEN 'reagent'
    WHEN 'consumable' THEN 'consumable' WHEN 'instrument_accessory' THEN 'equipment' END,
  CASE i."category" WHEN 'antibody' THEN (SELECT "id" FROM "ScientificSchemaDefinition" WHERE "key" = 'antibody')
    WHEN 'kit' THEN (SELECT "id" FROM "ScientificSchemaDefinition" WHERE "key" = 'kit')
    WHEN 'chemical' THEN (SELECT "id" FROM "ScientificSchemaDefinition" WHERE "key" = 'chemical')
    WHEN 'instrument_accessory' THEN (SELECT "id" FROM "ScientificSchemaDefinition" WHERE "key" = 'accessory') END,
  i."entityId", i."lowThreshold", CASE WHEN i."lowThreshold" IS NULL THEN NULL ELSE i."unit" END, i."createdAt", CURRENT_TIMESTAMP
FROM "_inventory_product_keys" k JOIN "InventoryItem" i ON i."id" = k."itemId"
ORDER BY k."productId", i."createdAt", i."id";

UPDATE "InventoryItem" i SET "productId" = k."productId" FROM "_inventory_product_keys" k WHERE k."itemId" = i."id";

-- Manuals move from the item to its product, where every lot sees them.
UPDATE "AttachmentLink" l SET "targetType" = 'inventory_product', "targetId" = i."productId"
FROM "InventoryItem" i
WHERE l."targetType" = 'inventory_item' AND l."linkType" = 'product_manual' AND l."targetId" = i."id";

DROP TABLE "_inventory_product_keys";
