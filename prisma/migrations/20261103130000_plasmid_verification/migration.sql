-- CreateEnum
CREATE TYPE "PlasmidVerificationStatus" AS ENUM ('draft', 'review', 'confirmed', 'superseded');

-- CreateEnum
CREATE TYPE "PlasmidVerificationResult" AS ENUM ('consistent', 'explained', 'mismatch', 'insufficient');

-- CreateEnum
CREATE TYPE "PlasmidReviewDisposition" AS ENUM ('pending', 'sequencing_issue', 'expected', 'sample_mismatch', 'excluded_read', 'acknowledged');

-- CreateTable
CREATE TABLE "PlasmidVerification" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sequenceVersionId" TEXT NOT NULL,
    "referenceSha256" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "sampleId" TEXT,
    "scopeJson" JSONB NOT NULL,
    "settingsJson" JSONB NOT NULL,
    "readsJson" JSONB NOT NULL,
    "groupsJson" JSONB NOT NULL,
    "structureJson" JSONB,
    "coverageJson" JSONB NOT NULL,
    "status" "PlasmidVerificationStatus" NOT NULL DEFAULT 'draft',
    "result" "PlasmidVerificationResult",
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "note" TEXT,
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlasmidVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlasmidVerificationItem" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,
    "readName" TEXT,
    "detailJson" JSONB NOT NULL,
    "disposition" "PlasmidReviewDisposition" NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "PlasmidVerificationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlasmidVerification_supersedesId_key" ON "PlasmidVerification"("supersedesId");

-- CreateIndex
CREATE INDEX "PlasmidVerification_productId_createdAt_idx" ON "PlasmidVerification"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "PlasmidVerification_inventoryItemId_idx" ON "PlasmidVerification"("inventoryItemId");

-- CreateIndex
CREATE INDEX "PlasmidVerification_sequenceVersionId_idx" ON "PlasmidVerification"("sequenceVersionId");

-- CreateIndex
CREATE INDEX "PlasmidVerificationItem_verificationId_order_idx" ON "PlasmidVerificationItem"("verificationId", "order");

-- AddForeignKey
ALTER TABLE "PlasmidVerification" ADD CONSTRAINT "PlasmidVerification_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlasmidVerification" ADD CONSTRAINT "PlasmidVerification_sequenceVersionId_fkey" FOREIGN KEY ("sequenceVersionId") REFERENCES "SequenceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlasmidVerification" ADD CONSTRAINT "PlasmidVerification_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlasmidVerification" ADD CONSTRAINT "PlasmidVerification_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlasmidVerification" ADD CONSTRAINT "PlasmidVerification_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "PlasmidVerification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlasmidVerificationItem" ADD CONSTRAINT "PlasmidVerificationItem_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "PlasmidVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

