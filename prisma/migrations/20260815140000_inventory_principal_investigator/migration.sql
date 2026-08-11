ALTER TABLE "InventoryItem"
ADD COLUMN "principalInvestigator" TEXT;

CREATE INDEX "InventoryItem_principalInvestigator_idx"
ON "InventoryItem"("principalInvestigator");
