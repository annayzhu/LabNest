CREATE TABLE "QpcrWorkflowDraft" (
  "id" TEXT NOT NULL,
  "ownerType" TEXT NOT NULL,
  "ownerId" TEXT,
  "experimentId" TEXT,
  "documentJson" JSONB NOT NULL,
  "formJson" JSONB NOT NULL DEFAULT '{}',
  "sessionsJson" JSONB NOT NULL DEFAULT '{}',
  "boundRecordId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QpcrWorkflowDraft_pkey" PRIMARY KEY ("id")
);
