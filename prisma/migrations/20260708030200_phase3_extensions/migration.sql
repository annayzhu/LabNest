-- CreateEnum
CREATE TYPE "RecordLifecycleStatus" AS ENUM ('draft', 'recorded', 'submitted', 'reviewed');

-- CreateEnum
CREATE TYPE "SampleLifecycleStatus" AS ENUM ('registered', 'prepared', 'stocked', 'in_use', 'depleted', 'discarded', 'archived');

-- CreateEnum
CREATE TYPE "SampleLifecycleEventType" AS ENUM ('register', 'collect', 'prepare', 'aliquot', 'receive', 'store', 'transfer', 'thaw', 'refreeze', 'consume', 'qc', 'discard', 'result_link', 'note');

-- CreateEnum
CREATE TYPE "ProcurementInquiryStatus" AS ENUM ('draft', 'quoted', 'selected', 'converted', 'archived');

-- CreateEnum
CREATE TYPE "ProcurementQuoteLineStatus" AS ENUM ('candidate', 'selected', 'not_selected', 'expired', 'rejected', 'duplicate', 'future_candidate', 'converted');

-- CreateEnum
CREATE TYPE "ProcurementSourceType" AS ENUM ('excel', 'manual', 'school_template');

-- CreateEnum
CREATE TYPE "ReferenceProviderType" AS ENUM ('zotero', 'endnote');

-- AlterEnum
ALTER TYPE "InventoryLocationType" ADD VALUE 'position';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryTransactionType" ADD VALUE 'thaw';
ALTER TYPE "InventoryTransactionType" ADD VALUE 'refreeze';
ALTER TYPE "InventoryTransactionType" ADD VALUE 'qc';
ALTER TYPE "InventoryTransactionType" ADD VALUE 'return';

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "recordStatus" "RecordLifecycleStatus" NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE "Experiment" ADD COLUMN     "recordStatus" "RecordLifecycleStatus" NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "aliquotCode" TEXT,
ADD COLUMN     "freezeThawCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "parentInventoryItemId" TEXT,
ADD COLUMN     "positionCode" TEXT;

-- AlterTable
ALTER TABLE "Protocol" ADD COLUMN     "recordStatus" "RecordLifecycleStatus" NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE "ProtocolVersion" ADD COLUMN     "changeSummary" TEXT,
ADD COLUMN     "createdFromVersionId" TEXT,
ADD COLUMN     "recordStatus" "RecordLifecycleStatus" NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE "PurchaseRequest" ADD COLUMN     "procurementQuoteLineId" TEXT;

-- CreateTable
CREATE TABLE "SampleProfile" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sampleCode" TEXT NOT NULL,
    "sampleType" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "sourceType" TEXT,
    "parentSampleId" TEXT,
    "collectedAt" TIMESTAMP(3),
    "preparedAt" TIMESTAMP(3),
    "status" "SampleLifecycleStatus" NOT NULL DEFAULT 'registered',
    "biosafetyLevel" TEXT,
    "storageRequirement" TEXT,
    "freezeThawCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SampleProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleLifecycleEvent" (
    "id" TEXT NOT NULL,
    "sampleProfileId" TEXT NOT NULL,
    "type" "SampleLifecycleEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "experimentId" TEXT,
    "inventoryItemId" TEXT,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "quantityChange" DOUBLE PRECISION,
    "unit" TEXT,
    "notes" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SampleLifecycleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementInquiry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ProcurementInquiryStatus" NOT NULL DEFAULT 'draft',
    "sourceType" "ProcurementSourceType" NOT NULL DEFAULT 'excel',
    "projectId" TEXT,
    "importedFileName" TEXT,
    "supplierScope" TEXT,
    "quotedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementQuoteLine" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "status" "ProcurementQuoteLineStatus" NOT NULL DEFAULT 'candidate',
    "supplierName" TEXT,
    "productCategory" TEXT,
    "productName" TEXT NOT NULL,
    "casNumber" TEXT,
    "specification" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "packageUnit" TEXT NOT NULL,
    "amountExclTax" DOUBLE PRECISION,
    "taxAmount" DOUBLE PRECISION,
    "unitPriceExclTax" DOUBLE PRECISION,
    "specialPurchaseNote" TEXT,
    "capacity" DOUBLE PRECISION,
    "capacityUnit" TEXT,
    "brand" TEXT,
    "catalogNumber" TEXT,
    "taxRate" DOUBLE PRECISION,
    "amountInclTax" DOUBLE PRECISION,
    "decisionReason" TEXT,
    "selectedAt" TIMESTAMP(3),
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementQuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceConnector" (
    "id" TEXT NOT NULL,
    "provider" "ReferenceProviderType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "libraryScope" TEXT,
    "baseUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceConnector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SampleProfile_entityId_key" ON "SampleProfile"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "SampleProfile_sampleCode_key" ON "SampleProfile"("sampleCode");

-- CreateIndex
CREATE INDEX "SampleProfile_sampleType_idx" ON "SampleProfile"("sampleType");

-- CreateIndex
CREATE INDEX "SampleProfile_status_idx" ON "SampleProfile"("status");

-- CreateIndex
CREATE INDEX "SampleProfile_parentSampleId_idx" ON "SampleProfile"("parentSampleId");

-- CreateIndex
CREATE INDEX "SampleLifecycleEvent_sampleProfileId_idx" ON "SampleLifecycleEvent"("sampleProfileId");

-- CreateIndex
CREATE INDEX "SampleLifecycleEvent_type_idx" ON "SampleLifecycleEvent"("type");

-- CreateIndex
CREATE INDEX "SampleLifecycleEvent_occurredAt_idx" ON "SampleLifecycleEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "SampleLifecycleEvent_experimentId_idx" ON "SampleLifecycleEvent"("experimentId");

-- CreateIndex
CREATE INDEX "SampleLifecycleEvent_inventoryItemId_idx" ON "SampleLifecycleEvent"("inventoryItemId");

-- CreateIndex
CREATE INDEX "ProcurementInquiry_status_idx" ON "ProcurementInquiry"("status");

-- CreateIndex
CREATE INDEX "ProcurementInquiry_sourceType_idx" ON "ProcurementInquiry"("sourceType");

-- CreateIndex
CREATE INDEX "ProcurementInquiry_projectId_idx" ON "ProcurementInquiry"("projectId");

-- CreateIndex
CREATE INDEX "ProcurementInquiry_quotedAt_idx" ON "ProcurementInquiry"("quotedAt");

-- CreateIndex
CREATE INDEX "ProcurementQuoteLine_inquiryId_idx" ON "ProcurementQuoteLine"("inquiryId");

-- CreateIndex
CREATE INDEX "ProcurementQuoteLine_status_idx" ON "ProcurementQuoteLine"("status");

-- CreateIndex
CREATE INDEX "ProcurementQuoteLine_supplierName_idx" ON "ProcurementQuoteLine"("supplierName");

-- CreateIndex
CREATE INDEX "ProcurementQuoteLine_productCategory_idx" ON "ProcurementQuoteLine"("productCategory");

-- CreateIndex
CREATE INDEX "ReferenceConnector_provider_idx" ON "ReferenceConnector"("provider");

-- CreateIndex
CREATE INDEX "ReferenceConnector_enabled_idx" ON "ReferenceConnector"("enabled");

-- CreateIndex
CREATE INDEX "Entry_recordStatus_idx" ON "Entry"("recordStatus");

-- CreateIndex
CREATE INDEX "Experiment_recordStatus_idx" ON "Experiment"("recordStatus");

-- CreateIndex
CREATE INDEX "InventoryItem_parentInventoryItemId_idx" ON "InventoryItem"("parentInventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_aliquotCode_key" ON "InventoryItem"("aliquotCode");

-- CreateIndex
CREATE INDEX "Protocol_recordStatus_idx" ON "Protocol"("recordStatus");

-- CreateIndex
CREATE INDEX "ProtocolVersion_recordStatus_idx" ON "ProtocolVersion"("recordStatus");

-- CreateIndex
CREATE INDEX "ProtocolVersion_createdFromVersionId_idx" ON "ProtocolVersion"("createdFromVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_procurementQuoteLineId_key" ON "PurchaseRequest"("procurementQuoteLineId");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_parentInventoryItemId_fkey" FOREIGN KEY ("parentInventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleProfile" ADD CONSTRAINT "SampleProfile_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleProfile" ADD CONSTRAINT "SampleProfile_parentSampleId_fkey" FOREIGN KEY ("parentSampleId") REFERENCES "SampleProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleLifecycleEvent" ADD CONSTRAINT "SampleLifecycleEvent_sampleProfileId_fkey" FOREIGN KEY ("sampleProfileId") REFERENCES "SampleProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleLifecycleEvent" ADD CONSTRAINT "SampleLifecycleEvent_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleLifecycleEvent" ADD CONSTRAINT "SampleLifecycleEvent_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleLifecycleEvent" ADD CONSTRAINT "SampleLifecycleEvent_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleLifecycleEvent" ADD CONSTRAINT "SampleLifecycleEvent_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_procurementQuoteLineId_fkey" FOREIGN KEY ("procurementQuoteLineId") REFERENCES "ProcurementQuoteLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementInquiry" ADD CONSTRAINT "ProcurementInquiry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementQuoteLine" ADD CONSTRAINT "ProcurementQuoteLine_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "ProcurementInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
