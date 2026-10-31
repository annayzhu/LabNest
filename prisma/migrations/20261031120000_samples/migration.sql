-- Samples leave inventory: one row per tube with its lineage, place and experiments. Inventory keeps four 大类.

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('available', 'depleted', 'discarded', 'sent_out');

-- CreateEnum
CREATE TYPE "ExperimentSampleRole" AS ENUM ('input', 'output');

-- AlterTable
ALTER TABLE "InventoryLocation" ADD COLUMN     "gridColumns" INTEGER,
ADD COLUMN     "gridRows" INTEGER;

-- CreateTable
CREATE TABLE "Sample" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "origin" TEXT,
    "parentId" TEXT,
    "projectId" TEXT,
    "locationId" TEXT,
    "position" TEXT,
    "amount" DOUBLE PRECISION,
    "amountUnit" TEXT,
    "concentration" DOUBLE PRECISION,
    "concentrationUnit" TEXT,
    "status" "SampleStatus" NOT NULL DEFAULT 'available',
    "biosafetyLevel" TEXT,
    "collectedAt" TIMESTAMP(3),
    "fieldValues" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "batchId" TEXT,
    "externalSource" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentSampleGroup" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExperimentSampleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentSample" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "role" "ExperimentSampleRole" NOT NULL,
    "groupId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "usedAmount" DOUBLE PRECISION,
    "usedUnit" TEXT,
    "deducted" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sample_code_key" ON "Sample"("code");

-- CreateIndex
CREATE INDEX "Sample_typeId_idx" ON "Sample"("typeId");

-- CreateIndex
CREATE INDEX "Sample_parentId_idx" ON "Sample"("parentId");

-- CreateIndex
CREATE INDEX "Sample_projectId_idx" ON "Sample"("projectId");

-- CreateIndex
CREATE INDEX "Sample_status_idx" ON "Sample"("status");

-- CreateIndex
CREATE INDEX "Sample_batchId_idx" ON "Sample"("batchId");

-- CreateIndex
CREATE INDEX "Sample_name_idx" ON "Sample"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_externalSource_externalId_key" ON "Sample"("externalSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_locationId_position_key" ON "Sample"("locationId", "position");

-- CreateIndex
CREATE INDEX "ExperimentSampleGroup_experimentId_sortOrder_idx" ON "ExperimentSampleGroup"("experimentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentSampleGroup_experimentId_label_key" ON "ExperimentSampleGroup"("experimentId", "label");

-- CreateIndex
CREATE INDEX "ExperimentSample_sampleId_idx" ON "ExperimentSample"("sampleId");

-- CreateIndex
CREATE INDEX "ExperimentSample_experimentId_role_sortOrder_idx" ON "ExperimentSample"("experimentId", "role", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentSample_experimentId_sampleId_key" ON "ExperimentSample"("experimentId", "sampleId");

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ScientificSchemaDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Sample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentSampleGroup" ADD CONSTRAINT "ExperimentSampleGroup_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentSample" ADD CONSTRAINT "ExperimentSample_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentSample" ADD CONSTRAINT "ExperimentSample_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentSample" ADD CONSTRAINT "ExperimentSample_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ExperimentSampleGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The ten preset sample types (S6): a code prefix, default units and the fields each type records.
INSERT INTO "ScientificSchemaDefinition" ("id", "key", "label", "entityType", "objectKind", "inventoryGroupKey", "prefix", "fieldDefinitions", "defaultSettings", "updatedAt") VALUES
  ('schema_sample_tissue', 'sample_tissue', 'Tissue', NULL, 'sample', NULL, 'TIS', '[{"key":"site","label":"Site"},{"key":"pathology","label":"Pathology"},{"key":"preservation","label":"Preservation","kind":"choice","options":["Frozen","FFPE","RNAlater","Fresh"]}]', '{"sample":{"amountUnit":"mg","concentrationUnit":""}}', CURRENT_TIMESTAMP),
  ('schema_sample_blood', 'sample_blood', 'Whole blood', NULL, 'sample', NULL, 'BLD', '[{"key":"anticoagulant","label":"Anticoagulant","kind":"choice","options":["EDTA","Heparin","Sodium citrate"]}]', '{"sample":{"amountUnit":"mL","concentrationUnit":""}}', CURRENT_TIMESTAMP),
  ('schema_sample_serum', 'sample_serum', 'Serum', NULL, 'sample', NULL, 'SER', '[]', '{"sample":{"amountUnit":"µL","concentrationUnit":""}}', CURRENT_TIMESTAMP),
  ('schema_sample_plasma', 'sample_plasma', 'Plasma', NULL, 'sample', NULL, 'PLA', '[]', '{"sample":{"amountUnit":"µL","concentrationUnit":""}}', CURRENT_TIMESTAMP),
  ('schema_sample_cells', 'sample_cells', 'Cells', NULL, 'sample', NULL, 'CEL', '[{"key":"cellCount","label":"Cell count","kind":"number"}]', '{"sample":{"amountUnit":"","concentrationUnit":""}}', CURRENT_TIMESTAMP),
  ('schema_sample_rna', 'sample_rna', 'RNA', NULL, 'sample', NULL, 'RNA', '[{"key":"a260_a280","label":"A260/A280","kind":"number"},{"key":"a260_a230","label":"A260/A230","kind":"number"},{"key":"rin","label":"RIN","kind":"number"}]', '{"sample":{"amountUnit":"µL","concentrationUnit":"ng/µL"}}', CURRENT_TIMESTAMP),
  ('schema_sample_cdna', 'sample_cdna', 'cDNA', NULL, 'sample', NULL, 'CDNA', '[]', '{"sample":{"amountUnit":"µL","concentrationUnit":"ng/µL"}}', CURRENT_TIMESTAMP),
  ('schema_sample_dna', 'sample_dna', 'Genomic DNA', NULL, 'sample', NULL, 'DNA', '[{"key":"a260_a280","label":"A260/A280","kind":"number"},{"key":"a260_a230","label":"A260/A230","kind":"number"}]', '{"sample":{"amountUnit":"µL","concentrationUnit":"ng/µL"}}', CURRENT_TIMESTAMP),
  ('schema_sample_protein', 'sample_protein', 'Protein lysate', NULL, 'sample', NULL, 'PRO', '[]', '{"sample":{"amountUnit":"µL","concentrationUnit":"µg/µL"}}', CURRENT_TIMESTAMP),
  ('schema_sample_other', 'sample_other', 'Other', NULL, 'sample', NULL, 'SMP', '[]', '{"sample":{"amountUnit":"","concentrationUnit":""}}', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- The old sample ledger (SampleProfile, empty on the formal database) moves into Sample under the same IDs, so parents still match.
INSERT INTO "Sample" ("id", "code", "name", "typeId", "origin", "projectId", "status", "biosafetyLevel", "collectedAt", "notes", "fieldValues", "createdAt", "updatedAt")
SELECT p."id", p."sampleCode", e."name",
  coalesce((SELECT d."id" FROM "ScientificSchemaDefinition" d WHERE d."key" = 'sample_' || lower(p."sampleType") AND d."objectKind" = 'sample'),
           (SELECT d."id" FROM "ScientificSchemaDefinition" d WHERE d."key" = 'sample_other')),
  p."sourceLabel", e."projectId",
  (CASE p."status"::text WHEN 'depleted' THEN 'depleted' WHEN 'discarded' THEN 'discarded' WHEN 'archived' THEN 'discarded' ELSE 'available' END)::"SampleStatus",
  p."biosafetyLevel", coalesce(p."collectedAt", p."preparedAt"),
  NULLIF(concat_ws(E'\n', p."notes", CASE WHEN NOT EXISTS (SELECT 1 FROM "ScientificSchemaDefinition" d WHERE d."key" = 'sample_' || lower(p."sampleType") AND d."objectKind" = 'sample') THEN 'Type in the old ledger: ' || p."sampleType" END), ''),
  '{}'::jsonb, p."createdAt", CURRENT_TIMESTAMP
FROM "SampleProfile" p JOIN "Entity" e ON e."id" = p."entityId";

UPDATE "Sample" s SET "parentId" = p."parentSampleId"
FROM "SampleProfile" p
WHERE p."id" = s."id" AND p."parentSampleId" IS NOT NULL;

-- Inventory's 大类 "样本" goes away. Its products become 待归类 (nothing is deleted); its own types become sample types.
UPDATE "InventoryProduct" SET "groupKey" = NULL, "typeId" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "groupKey" = 'sample' OR "typeId" IN (SELECT "id" FROM "ScientificSchemaDefinition" WHERE "inventoryGroupKey" = 'sample');

UPDATE "ScientificSchemaDefinition"
SET "objectKind" = CASE WHEN "entityType" IS NULL THEN 'sample' ELSE "objectKind" END, "inventoryGroupKey" = NULL, "updatedAt" = CURRENT_TIMESTAMP
WHERE "inventoryGroupKey" = 'sample';

DELETE FROM "InventoryGroup" WHERE "key" = 'sample';

-- DropForeignKey
ALTER TABLE "SampleProfile" DROP CONSTRAINT "SampleProfile_entityId_fkey";

-- DropForeignKey
ALTER TABLE "SampleProfile" DROP CONSTRAINT "SampleProfile_parentSampleId_fkey";

-- DropForeignKey
ALTER TABLE "SampleLifecycleEvent" DROP CONSTRAINT "SampleLifecycleEvent_sampleProfileId_fkey";

-- DropForeignKey
ALTER TABLE "SampleLifecycleEvent" DROP CONSTRAINT "SampleLifecycleEvent_experimentId_fkey";

-- DropForeignKey
ALTER TABLE "SampleLifecycleEvent" DROP CONSTRAINT "SampleLifecycleEvent_inventoryItemId_fkey";

-- DropForeignKey
ALTER TABLE "SampleLifecycleEvent" DROP CONSTRAINT "SampleLifecycleEvent_fromLocationId_fkey";

-- DropForeignKey
ALTER TABLE "SampleLifecycleEvent" DROP CONSTRAINT "SampleLifecycleEvent_toLocationId_fkey";

-- DropTable
DROP TABLE "SampleProfile";

-- DropTable
DROP TABLE "SampleLifecycleEvent";

-- DropEnum
DROP TYPE "SampleLifecycleStatus";

-- DropEnum
DROP TYPE "SampleLifecycleEventType";
