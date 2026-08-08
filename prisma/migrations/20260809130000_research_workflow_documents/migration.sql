-- CreateEnum
CREATE TYPE "ResultSourceType" AS ENUM ('manual', 'protocol_template', 'file_import', 'tool', 'analysis');

-- CreateEnum
CREATE TYPE "ResultQualityStatus" AS ENUM ('not_assessed', 'pass', 'warning', 'fail');

-- CreateEnum
CREATE TYPE "ResultDatasetStorageMode" AS ENUM ('managed_file', 'external_reference');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('draft', 'ready_for_review', 'final', 'archived');

-- AlterTable
ALTER TABLE "Experiment" ADD COLUMN "contentJson" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "protocolSnapshotJson" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "runCode" TEXT;

-- AlterTable
ALTER TABLE "ResearchPlan" ADD COLUMN "contentJson" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Result" ADD COLUMN "analysisMethod" TEXT,
ADD COLUMN "contentJson" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "provenanceJson" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "qualityStatus" "ResultQualityStatus" NOT NULL DEFAULT 'not_assessed',
ADD COLUMN "recordStatus" "RecordLifecycleStatus" NOT NULL DEFAULT 'draft',
ADD COLUMN "researchPlanId" TEXT,
ADD COLUMN "sourceType" "ResultSourceType" NOT NULL DEFAULT 'manual';

-- Backfill the plan relationship from existing experiments before indexing it.
UPDATE "Result" AS result
SET "researchPlanId" = experiment."researchPlanId"
FROM "Experiment" AS experiment
WHERE result."experimentId" = experiment."id"
  AND result."researchPlanId" IS NULL;

-- CreateTable
CREATE TABLE "ResultDataset" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageMode" "ResultDatasetStorageMode" NOT NULL DEFAULT 'managed_file',
    "sourceFileName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "storagePath" TEXT,
    "externalUri" TEXT,
    "checksum" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "columnCount" INTEGER NOT NULL DEFAULT 0,
    "columnsJson" JSONB NOT NULL DEFAULT '[]',
    "previewJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResultDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "researchPlanId" TEXT,
    "title" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'draft',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "contentJson" JSONB NOT NULL DEFAULT '{}',
    "sourceSnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSource" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "versionSnapshot" TEXT,
    "hrefSnapshot" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "order" INTEGER NOT NULL DEFAULT 0,
    "includedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultId" TEXT,
    CONSTRAINT "ReportSource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResultDataset_resultId_idx" ON "ResultDataset"("resultId");
CREATE INDEX "ResultDataset_storageMode_idx" ON "ResultDataset"("storageMode");
CREATE INDEX "Report_projectId_idx" ON "Report"("projectId");
CREATE INDEX "Report_researchPlanId_idx" ON "Report"("researchPlanId");
CREATE INDEX "Report_status_idx" ON "Report"("status");
CREATE INDEX "Report_updatedAt_idx" ON "Report"("updatedAt");
CREATE INDEX "ReportSource_reportId_order_idx" ON "ReportSource"("reportId", "order");
CREATE INDEX "ReportSource_sourceType_sourceId_idx" ON "ReportSource"("sourceType", "sourceId");
CREATE INDEX "ReportSource_resultId_idx" ON "ReportSource"("resultId");
CREATE UNIQUE INDEX "ReportSource_reportId_sourceType_sourceId_key" ON "ReportSource"("reportId", "sourceType", "sourceId");
CREATE UNIQUE INDEX "Experiment_researchPlanId_runCode_key" ON "Experiment"("researchPlanId", "runCode");
CREATE INDEX "Result_researchPlanId_idx" ON "Result"("researchPlanId");
CREATE INDEX "Result_recordStatus_idx" ON "Result"("recordStatus");
CREATE INDEX "Result_sourceType_idx" ON "Result"("sourceType");
CREATE INDEX "Result_qualityStatus_idx" ON "Result"("qualityStatus");

ALTER TABLE "Result" ADD CONSTRAINT "Result_researchPlanId_fkey" FOREIGN KEY ("researchPlanId") REFERENCES "ResearchPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResultDataset" ADD CONSTRAINT "ResultDataset_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_researchPlanId_fkey" FOREIGN KEY ("researchPlanId") REFERENCES "ResearchPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReportSource" ADD CONSTRAINT "ReportSource_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportSource" ADD CONSTRAINT "ReportSource_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE SET NULL ON UPDATE CASCADE;
