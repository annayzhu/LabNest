-- Keep material, bottle, receipt and correction provenance addressable.
ALTER TABLE "InventoryObservation" ADD CONSTRAINT "InventoryObservation_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RunMaterialUse" ADD CONSTRAINT "RunMaterialUse_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RunMaterialUse" ADD CONSTRAINT "RunMaterialUse_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "InventoryContainer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RunMaterialUse" ADD CONSTRAINT "RunMaterialUse_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "InventoryTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RunMaterialUse" ADD CONSTRAINT "RunMaterialUse_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "RunMaterialUse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
