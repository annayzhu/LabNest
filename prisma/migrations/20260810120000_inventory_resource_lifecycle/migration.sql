ALTER TABLE "InventoryItem"
ADD COLUMN "englishName" TEXT,
ADD COLUMN "category" TEXT,
ADD COLUMN "brand" TEXT,
ADD COLUMN "casNumber" TEXT,
ADD COLUMN "lowThreshold" DOUBLE PRECISION;

ALTER TABLE "InventoryTransaction"
ADD COLUMN "performedBy" TEXT;

CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");
