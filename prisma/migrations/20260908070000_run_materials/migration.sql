-- CreateTable
CREATE TABLE "RunMaterialUse" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expected" DOUBLE PRECISION,
    "actual" DOUBLE PRECISION,
    "unit" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "containerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'recorded',
    "transactionId" TEXT,
    "correctionOfId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunMaterialUse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RunMaterialUse_transactionId_key" ON "RunMaterialUse"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "RunMaterialUse_correctionOfId_key" ON "RunMaterialUse"("correctionOfId");

-- CreateIndex
CREATE INDEX "RunMaterialUse_experimentId_idx" ON "RunMaterialUse"("experimentId");

-- AddForeignKey
ALTER TABLE "RunMaterialUse" ADD CONSTRAINT "RunMaterialUse_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

