-- Deleted scientific records need a durable recovery path. The snapshot keeps
-- the complete deletable draft plus its owned links; ActivityLog remains the
-- immutable audit trail for delete, restore, and purge events.
CREATE TABLE "DeletedRecord" (
  "id" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "snapshotJson" JSONB NOT NULL,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "restoredAt" TIMESTAMP(3),

  CONSTRAINT "DeletedRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeletedRecord_restoredAt_deletedAt_idx" ON "DeletedRecord"("restoredAt", "deletedAt");
CREATE INDEX "DeletedRecord_targetType_targetId_idx" ON "DeletedRecord"("targetType", "targetId");
