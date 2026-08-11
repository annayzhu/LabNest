ALTER TABLE "InventoryLocation"
ADD COLUMN "status" "ObjectStatus" NOT NULL DEFAULT 'active';

CREATE INDEX "InventoryLocation_status_idx"
ON "InventoryLocation"("status");
