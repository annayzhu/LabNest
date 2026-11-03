-- 质粒工作台 A 批 (PLAN §9.3): sequence completeness, an unknown topology and file source types, multi-part
-- features, and the sequencing folder with its reads. Additive only: new enum values, defaulted columns, two new tables.

-- CreateEnum
CREATE TYPE "SequenceCompleteness" AS ENUM ('full_length', 'partial', 'unknown');

-- AlterEnum
ALTER TYPE "SequenceTopology" ADD VALUE 'unknown';

-- AlterEnum

ALTER TYPE "SequenceSourceType" ADD VALUE 'genbank_import';
ALTER TYPE "SequenceSourceType" ADD VALUE 'snapgene_import';
ALTER TYPE "SequenceSourceType" ADD VALUE 'abif_import';
ALTER TYPE "SequenceSourceType" ADD VALUE 'seq_import';

-- AlterTable
ALTER TABLE "SequenceVersion" ADD COLUMN     "completeness" "SequenceCompleteness" NOT NULL DEFAULT 'unknown';

-- AlterTable
ALTER TABLE "SequenceFeature" ADD COLUMN     "codonStart" INTEGER,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "evidence" TEXT NOT NULL DEFAULT 'file',
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "qualifiersJson" JSONB,
ADD COLUMN     "segmentsJson" JSONB,
ADD COLUMN     "sourceLabel" TEXT;

-- CreateTable
CREATE TABLE "SequencingFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequencingFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequencingRead" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "attachmentId" TEXT,
    "relativePath" TEXT NOT NULL,
    "memberPath" TEXT,
    "format" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bases" TEXT NOT NULL,
    "qualityJson" JSONB,
    "peaksJson" JSONB,
    "fileSha256" TEXT NOT NULL,
    "basesSha256" TEXT NOT NULL,
    "evidenceGroup" TEXT NOT NULL,
    "metadataJson" JSONB,
    "warningsJson" JSONB,
    "parserVersion" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SequencingRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SequencingFolder_entityId_idx" ON "SequencingFolder"("entityId");

-- CreateIndex
CREATE INDEX "SequencingRead_folderId_order_idx" ON "SequencingRead"("folderId", "order");

-- CreateIndex
CREATE INDEX "SequencingRead_fileSha256_idx" ON "SequencingRead"("fileSha256");

-- AddForeignKey
ALTER TABLE "SequencingFolder" ADD CONSTRAINT "SequencingFolder_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequencingRead" ADD CONSTRAINT "SequencingRead_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "SequencingFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
