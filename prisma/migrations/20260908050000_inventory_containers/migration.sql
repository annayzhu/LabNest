-- CreateTable
CREATE TABLE "InventoryContainer" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'warehouse',
    "holder" TEXT,
    "location" TEXT,
    "openedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryContainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryContainerEvent" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT,
    "snapshotJson" JSONB NOT NULL,
    "clientMutationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryContainerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryObservation" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "remaining" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "experimentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryContainer_inventoryItemId_state_idx" ON "InventoryContainer"("inventoryItemId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryContainerEvent_clientMutationId_key" ON "InventoryContainerEvent"("clientMutationId");

-- CreateIndex
CREATE INDEX "InventoryContainerEvent_containerId_createdAt_idx" ON "InventoryContainerEvent"("containerId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryObservation_containerId_createdAt_idx" ON "InventoryObservation"("containerId", "createdAt");

-- AddForeignKey
ALTER TABLE "InventoryContainer" ADD CONSTRAINT "InventoryContainer_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryContainerEvent" ADD CONSTRAINT "InventoryContainerEvent_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "InventoryContainer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryObservation" ADD CONSTRAINT "InventoryObservation_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "InventoryContainer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "SequenceCollectionMember_collectionId_sequenceVersionId_role_ke" RENAME TO "SequenceCollectionMember_collectionId_sequenceVersionId_rol_key";

