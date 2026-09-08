-- AlterTable
ALTER TABLE "PurchaseRequest" ADD COLUMN     "actualAmount" DECIMAL(18,2),
ADD COLUMN     "clientMutationId" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'CNY',
ADD COLUMN     "invoiceReference" TEXT,
ADD COLUMN     "invoiceStatus" TEXT NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "PurchaseReceipt" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "inventoryItemId" TEXT,
    "clientMutationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseExportSnapshot" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseExportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReceipt_clientMutationId_key" ON "PurchaseReceipt"("clientMutationId");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_purchaseId_idx" ON "PurchaseReceipt"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_clientMutationId_key" ON "PurchaseRequest"("clientMutationId");

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "PurchaseRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

