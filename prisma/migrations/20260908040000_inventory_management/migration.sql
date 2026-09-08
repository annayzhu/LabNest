-- Keep legacy balances and IDs intact. Unknown is explicit, never inferred from zero.
ALTER TABLE "InventoryItem" ADD COLUMN "managementMode" TEXT NOT NULL DEFAULT 'precise', ADD COLUMN "quantityRecorded" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_managementMode_check" CHECK ("managementMode" IN ('information','package','precise'));
