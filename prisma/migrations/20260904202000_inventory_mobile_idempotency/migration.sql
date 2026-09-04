ALTER TABLE "InventoryTransaction"
ADD COLUMN "experimentStepId" TEXT,
ADD COLUMN "clientMutationId" TEXT,
ADD COLUMN "deviceCreatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "InventoryTransaction_clientMutationId_key" ON "InventoryTransaction"("clientMutationId");
CREATE INDEX "InventoryTransaction_experimentStepId_idx" ON "InventoryTransaction"("experimentStepId");
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_experimentStepId_fkey" FOREIGN KEY ("experimentStepId") REFERENCES "ExperimentStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
