-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EntrySourceType" AS ENUM ('text', 'photo', 'file', 'voice', 'manual');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('planned', 'running', 'completed', 'failed', 'archived');

-- CreateEnum
CREATE TYPE "ProtocolStatus" AS ENUM ('draft', 'active', 'retired', 'archived');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'paused', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('plasmid', 'primer', 'oligo', 'cell_line', 'antibody', 'protein', 'reagent', 'compound', 'bacteria', 'mixture', 'sample', 'other');

-- CreateEnum
CREATE TYPE "ObjectStatus" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "InventoryLocationType" AS ENUM ('freezer', 'fridge', 'shelf', 'box', 'drawer', 'plate', 'rack', 'room', 'other');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('add', 'consume', 'transfer', 'adjust', 'discard', 'receive', 'aliquot');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('planned', 'ordered', 'received', 'stocked', 'cancelled');

-- CreateEnum
CREATE TYPE "SequenceType" AS ENUM ('DNA', 'RNA', 'Protein');

-- CreateEnum
CREATE TYPE "LinkCreatedBy" AS ENUM ('user', 'system', 'ai');

-- CreateEnum
CREATE TYPE "ProposedActionSourceType" AS ENUM ('ai', 'protocol', 'entry', 'import', 'manual', 'system');

-- CreateEnum
CREATE TYPE "ProposedActionStatus" AS ENUM ('pending', 'accepted', 'rejected', 'edited', 'executed');

-- CreateEnum
CREATE TYPE "ProposedActionType" AS ENUM ('create_experiment', 'update_experiment', 'consume_inventory', 'create_entity', 'create_result', 'create_purchase_request', 'receive_purchase', 'link_attachment', 'link_item', 'create_inventory_item', 'create_protocol_run');

-- CreateEnum
CREATE TYPE "AIProviderType" AS ENUM ('openai', 'anthropic', 'openai_compatible', 'manual_copy_paste');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "moodStatus" TEXT,
    "sourceType" "EntrySourceType" NOT NULL DEFAULT 'text',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "projectId" TEXT,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'planned',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purpose" TEXT,
    "background" TEXT,
    "materialsText" TEXT,
    "stepsText" TEXT,
    "observations" TEXT,
    "resultSummary" TEXT,
    "conclusion" TEXT,
    "deviations" TEXT,
    "protocolVersionId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Protocol" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProtocolStatus" NOT NULL DEFAULT 'draft',
    "projectId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Protocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolVersion" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT,
    "background" TEXT,
    "scope" TEXT,
    "notes" TEXT,
    "parametersJson" JSONB NOT NULL DEFAULT '[]',
    "materialsJson" JSONB NOT NULL DEFAULT '[]',
    "equipmentJson" JSONB NOT NULL DEFAULT '[]',
    "stepsJson" JSONB NOT NULL DEFAULT '[]',
    "consumptionRulesJson" JSONB NOT NULL DEFAULT '[]',
    "resultTemplatesJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtocolVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolRun" (
    "id" TEXT NOT NULL,
    "protocolVersionId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "parametersJson" JSONB NOT NULL DEFAULT '{}',
    "calculatedConsumptionJson" JSONB NOT NULL DEFAULT '[]',
    "status" "ExperimentStatus" NOT NULL DEFAULT 'planned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocolRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentStep" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "protocolStepRef" TEXT,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "deviationNote" TEXT,

    CONSTRAINT "ExperimentStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EntityType" NOT NULL DEFAULT 'other',
    "code" TEXT,
    "projectId" TEXT,
    "status" "ObjectStatus" NOT NULL DEFAULT 'active',
    "description" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "parentEntityId" TEXT,
    "sequenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InventoryLocationType" NOT NULL DEFAULT 'other',
    "parentLocationId" TEXT,
    "temperature" TEXT,
    "description" TEXT,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "entityId" TEXT,
    "name" TEXT NOT NULL,
    "containerType" TEXT,
    "barcode" TEXT,
    "lotNumber" TEXT,
    "vendor" TEXT,
    "catalogNumber" TEXT,
    "currentQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "concentration" TEXT,
    "locationId" TEXT,
    "expiryDate" TIMESTAMP(3),
    "storageCondition" TEXT,
    "status" "ObjectStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "type" "InventoryTransactionType" NOT NULL,
    "quantityChange" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "experimentId" TEXT,
    "purchaseId" TEXT,
    "proposedActionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT,
    "entityId" TEXT,
    "projectId" TEXT,
    "resultType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "textValue" TEXT,
    "numericValue" DOUBLE PRECISION,
    "unit" TEXT,
    "status" "ObjectStatus" NOT NULL DEFAULT 'active',
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'planned',
    "vendor" TEXT,
    "catalogNumber" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "orderDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "lotNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "storageCondition" TEXT,
    "linkedInventoryItemId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttachmentLink" (
    "id" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "linkType" TEXT NOT NULL DEFAULT 'attached_to',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttachmentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SequenceType" NOT NULL,
    "sequence" TEXT NOT NULL,
    "description" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceFeature" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,
    "strand" TEXT,
    "note" TEXT,

    CONSTRAINT "SequenceFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemLink" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "linkType" TEXT NOT NULL,
    "createdBy" "LinkCreatedBy" NOT NULL DEFAULT 'user',
    "confidence" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposedAction" (
    "id" TEXT NOT NULL,
    "sourceType" "ProposedActionSourceType" NOT NULL,
    "sourceId" TEXT,
    "actionType" "ProposedActionType" NOT NULL,
    "status" "ProposedActionStatus" NOT NULL DEFAULT 'pending',
    "confidence" DOUBLE PRECISION,
    "reason" TEXT,
    "payloadJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "ProposedAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AIProviderType" NOT NULL,
    "baseUrl" TEXT,
    "apiKeyEncrypted" TEXT,
    "defaultModel" TEXT,
    "capabilitiesJson" JSONB NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "Entry_occurredAt_idx" ON "Entry"("occurredAt");

-- CreateIndex
CREATE INDEX "Entry_projectId_idx" ON "Entry"("projectId");

-- CreateIndex
CREATE INDEX "Experiment_status_idx" ON "Experiment"("status");

-- CreateIndex
CREATE INDEX "Experiment_date_idx" ON "Experiment"("date");

-- CreateIndex
CREATE INDEX "Experiment_projectId_idx" ON "Experiment"("projectId");

-- CreateIndex
CREATE INDEX "Experiment_protocolVersionId_idx" ON "Experiment"("protocolVersionId");

-- CreateIndex
CREATE INDEX "Protocol_status_idx" ON "Protocol"("status");

-- CreateIndex
CREATE INDEX "Protocol_projectId_idx" ON "Protocol"("projectId");

-- CreateIndex
CREATE INDEX "ProtocolVersion_protocolId_idx" ON "ProtocolVersion"("protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolVersion_protocolId_versionNumber_key" ON "ProtocolVersion"("protocolId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolRun_experimentId_key" ON "ProtocolRun"("experimentId");

-- CreateIndex
CREATE INDEX "ProtocolRun_protocolVersionId_idx" ON "ProtocolRun"("protocolVersionId");

-- CreateIndex
CREATE INDEX "ExperimentStep_experimentId_order_idx" ON "ExperimentStep"("experimentId", "order");

-- CreateIndex
CREATE INDEX "Entity_type_idx" ON "Entity"("type");

-- CreateIndex
CREATE INDEX "Entity_status_idx" ON "Entity"("status");

-- CreateIndex
CREATE INDEX "Entity_projectId_idx" ON "Entity"("projectId");

-- CreateIndex
CREATE INDEX "Entity_sequenceId_idx" ON "Entity"("sequenceId");

-- CreateIndex
CREATE INDEX "InventoryLocation_type_idx" ON "InventoryLocation"("type");

-- CreateIndex
CREATE INDEX "InventoryLocation_parentLocationId_idx" ON "InventoryLocation"("parentLocationId");

-- CreateIndex
CREATE INDEX "InventoryItem_entityId_idx" ON "InventoryItem"("entityId");

-- CreateIndex
CREATE INDEX "InventoryItem_locationId_idx" ON "InventoryItem"("locationId");

-- CreateIndex
CREATE INDEX "InventoryItem_expiryDate_idx" ON "InventoryItem"("expiryDate");

-- CreateIndex
CREATE INDEX "InventoryItem_status_idx" ON "InventoryItem"("status");

-- CreateIndex
CREATE INDEX "InventoryTransaction_inventoryItemId_idx" ON "InventoryTransaction"("inventoryItemId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_type_idx" ON "InventoryTransaction"("type");

-- CreateIndex
CREATE INDEX "InventoryTransaction_experimentId_idx" ON "InventoryTransaction"("experimentId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_purchaseId_idx" ON "InventoryTransaction"("purchaseId");

-- CreateIndex
CREATE INDEX "Result_experimentId_idx" ON "Result"("experimentId");

-- CreateIndex
CREATE INDEX "Result_entityId_idx" ON "Result"("entityId");

-- CreateIndex
CREATE INDEX "Result_projectId_idx" ON "Result"("projectId");

-- CreateIndex
CREATE INDEX "Result_resultType_idx" ON "Result"("resultType");

-- CreateIndex
CREATE INDEX "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");

-- CreateIndex
CREATE INDEX "PurchaseRequest_linkedInventoryItemId_idx" ON "PurchaseRequest"("linkedInventoryItemId");

-- CreateIndex
CREATE INDEX "AttachmentLink_attachmentId_idx" ON "AttachmentLink"("attachmentId");

-- CreateIndex
CREATE INDEX "AttachmentLink_targetType_targetId_idx" ON "AttachmentLink"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Sequence_type_idx" ON "Sequence"("type");

-- CreateIndex
CREATE INDEX "SequenceFeature_sequenceId_idx" ON "SequenceFeature"("sequenceId");

-- CreateIndex
CREATE INDEX "ItemLink_sourceType_sourceId_idx" ON "ItemLink"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "ItemLink_targetType_targetId_idx" ON "ItemLink"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ProposedAction_status_idx" ON "ProposedAction"("status");

-- CreateIndex
CREATE INDEX "ProposedAction_sourceType_sourceId_idx" ON "ProposedAction"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "ProposedAction_actionType_idx" ON "ProposedAction"("actionType");

-- CreateIndex
CREATE INDEX "AIProvider_type_idx" ON "AIProvider"("type");

-- CreateIndex
CREATE INDEX "AIProvider_enabled_idx" ON "AIProvider"("enabled");

-- CreateIndex
CREATE INDEX "ActivityLog_targetType_targetId_idx" ON "ActivityLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_protocolVersionId_fkey" FOREIGN KEY ("protocolVersionId") REFERENCES "ProtocolVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol" ADD CONSTRAINT "Protocol_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolVersion" ADD CONSTRAINT "ProtocolVersion_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolRun" ADD CONSTRAINT "ProtocolRun_protocolVersionId_fkey" FOREIGN KEY ("protocolVersionId") REFERENCES "ProtocolVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolRun" ADD CONSTRAINT "ProtocolRun_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentStep" ADD CONSTRAINT "ExperimentStep_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_parentEntityId_fkey" FOREIGN KEY ("parentEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLocation" ADD CONSTRAINT "InventoryLocation_parentLocationId_fkey" FOREIGN KEY ("parentLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "PurchaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_proposedActionId_fkey" FOREIGN KEY ("proposedActionId") REFERENCES "ProposedAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_linkedInventoryItemId_fkey" FOREIGN KEY ("linkedInventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttachmentLink" ADD CONSTRAINT "AttachmentLink_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceFeature" ADD CONSTRAINT "SequenceFeature_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
