-- Products or stock lots marked as not duplicates (docs/modules/inventory/bulk-duplicates-20261030/PLAN.md).
CREATE TABLE "InventoryDuplicateDismissal" (
    "firstId" TEXT NOT NULL,
    "secondId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryDuplicateDismissal_pkey" PRIMARY KEY ("firstId","secondId")
);
