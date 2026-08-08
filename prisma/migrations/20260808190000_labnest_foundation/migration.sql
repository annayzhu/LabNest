-- LabNest foundation migration.
-- Adds the Project -> ResearchPlan -> ProtocolVersion -> Experiment backbone
-- without resetting or discarding existing development data.

CREATE TYPE "ResearchPlanStatus" AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');
CREATE TYPE "ProtocolReviewStage" AS ENUM ('draft', 'ready_for_review', 'reviewed');
CREATE TYPE "ProtocolScope" AS ENUM ('general', 'project');
CREATE TYPE "ExperimentProtocolRole" AS ENUM ('primary', 'supporting');

ALTER TABLE "Entry" ADD COLUMN "researchPlanId" TEXT;
ALTER TABLE "Experiment" ADD COLUMN "researchPlanId" TEXT;

ALTER TABLE "Protocol"
ADD COLUMN "canonicalTitle" TEXT,
ADD COLUMN "englishTitle" TEXT,
ADD COLUMN "humanCode" TEXT,
ADD COLUMN "scope" "ProtocolScope" NOT NULL DEFAULT 'general',
ADD COLUMN "shortTitle" TEXT;

ALTER TABLE "ProtocolVersion"
ADD COLUMN "adaptationRationale" TEXT,
ADD COLUMN "derivedFromVersionId" TEXT,
ADD COLUMN "displayVersion" TEXT NOT NULL DEFAULT '0.1',
ADD COLUMN "previousVersionId" TEXT,
ADD COLUMN "reviewStage" "ProtocolReviewStage" NOT NULL DEFAULT 'draft';

-- Preserve the old revision lineage before removing the ambiguous column.
UPDATE "ProtocolVersion"
SET "previousVersionId" = "createdFromVersionId"
WHERE "createdFromVersionId" IS NOT NULL;

UPDATE "ProtocolVersion"
SET
  "displayVersion" = '0.' || "versionNumber"::TEXT,
  "reviewStage" = CASE
    WHEN "recordStatus" = 'reviewed' THEN 'reviewed'::"ProtocolReviewStage"
    WHEN "recordStatus" = 'submitted' THEN 'ready_for_review'::"ProtocolReviewStage"
    ELSE 'draft'::"ProtocolReviewStage"
  END;

DROP INDEX "ProtocolVersion_createdFromVersionId_idx";
ALTER TABLE "ProtocolVersion" DROP COLUMN "createdFromVersionId";

-- Backfill one canonical, human-readable code per existing protocol.
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS row_number
  FROM "Protocol"
)
UPDATE "Protocol" AS protocol
SET
  "humanCode" = 'PRT-' || LPAD((100000 + numbered.row_number)::TEXT, 6, '0'),
  "canonicalTitle" = protocol."title",
  "scope" = CASE
    WHEN protocol."projectId" IS NULL THEN 'general'::"ProtocolScope"
    ELSE 'project'::"ProtocolScope"
  END
FROM numbered
WHERE protocol."id" = numbered."id";

CREATE TABLE "ResearchPlan" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "code" TEXT,
  "title" TEXT NOT NULL,
  "objective" TEXT,
  "hypothesis" TEXT,
  "rationale" TEXT,
  "design" TEXT,
  "status" "ResearchPlanStatus" NOT NULL DEFAULT 'draft',
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchPlanProtocol" (
  "researchPlanId" TEXT NOT NULL,
  "protocolId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchPlanProtocol_pkey" PRIMARY KEY ("researchPlanId", "protocolId")
);

CREATE TABLE "ExperimentProtocolVersion" (
  "experimentId" TEXT NOT NULL,
  "protocolVersionId" TEXT NOT NULL,
  "role" "ExperimentProtocolRole" NOT NULL DEFAULT 'supporting',
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExperimentProtocolVersion_pkey" PRIMARY KEY ("experimentId", "protocolVersionId")
);

CREATE TABLE "AISettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "defaultProviderId" TEXT,
  "externalDataPolicy" TEXT NOT NULL DEFAULT 'explicit_context',
  "attachmentsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AISettings_pkey" PRIMARY KEY ("id")
);

-- Existing projects receive an explicit initial plan so old records keep context.
INSERT INTO "ResearchPlan" (
  "id", "projectId", "code", "title", "objective", "rationale", "status", "tags"
)
SELECT
  'rp-' || MD5(project."id"),
  project."id",
  'RP-001',
  project."name" || ' — Initial research plan',
  project."description",
  'Backfilled during the LabNest foundation migration. Review and refine before formal use.',
  'active'::"ResearchPlanStatus",
  project."tags"
FROM "Project" AS project;

UPDATE "Entry" AS entry
SET "researchPlanId" = 'rp-' || MD5(entry."projectId")
WHERE entry."projectId" IS NOT NULL;

UPDATE "Experiment" AS experiment
SET "researchPlanId" = 'rp-' || MD5(experiment."projectId")
WHERE experiment."projectId" IS NOT NULL;

INSERT INTO "ResearchPlanProtocol" ("researchPlanId", "protocolId", "isPrimary", "note")
SELECT
  'rp-' || MD5(protocol."projectId"),
  protocol."id",
  true,
  'Backfilled from the existing project-scoped protocol relationship.'
FROM "Protocol" AS protocol
WHERE protocol."projectId" IS NOT NULL;

INSERT INTO "ExperimentProtocolVersion" ("experimentId", "protocolVersionId", "role", "order")
SELECT experiment."id", experiment."protocolVersionId", 'primary'::"ExperimentProtocolRole", 0
FROM "Experiment" AS experiment
WHERE experiment."protocolVersionId" IS NOT NULL;

INSERT INTO "AISettings" ("id", "enabled", "externalDataPolicy", "attachmentsEnabled")
VALUES ('default', false, 'explicit_context', false)
ON CONFLICT ("id") DO NOTHING;

CREATE INDEX "ResearchPlan_projectId_idx" ON "ResearchPlan"("projectId");
CREATE INDEX "ResearchPlan_status_idx" ON "ResearchPlan"("status");
CREATE UNIQUE INDEX "ResearchPlan_projectId_code_key" ON "ResearchPlan"("projectId", "code");
CREATE INDEX "ResearchPlanProtocol_protocolId_idx" ON "ResearchPlanProtocol"("protocolId");
CREATE INDEX "ExperimentProtocolVersion_protocolVersionId_idx" ON "ExperimentProtocolVersion"("protocolVersionId");
CREATE INDEX "ExperimentProtocolVersion_experimentId_order_idx" ON "ExperimentProtocolVersion"("experimentId", "order");
CREATE INDEX "AISettings_defaultProviderId_idx" ON "AISettings"("defaultProviderId");
CREATE INDEX "Entry_researchPlanId_idx" ON "Entry"("researchPlanId");
CREATE INDEX "Experiment_researchPlanId_idx" ON "Experiment"("researchPlanId");
CREATE UNIQUE INDEX "Protocol_humanCode_key" ON "Protocol"("humanCode");
CREATE INDEX "Protocol_scope_idx" ON "Protocol"("scope");
CREATE INDEX "ProtocolVersion_reviewStage_idx" ON "ProtocolVersion"("reviewStage");
CREATE INDEX "ProtocolVersion_previousVersionId_idx" ON "ProtocolVersion"("previousVersionId");
CREATE INDEX "ProtocolVersion_derivedFromVersionId_idx" ON "ProtocolVersion"("derivedFromVersionId");

ALTER TABLE "ResearchPlan" ADD CONSTRAINT "ResearchPlan_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchPlanProtocol" ADD CONSTRAINT "ResearchPlanProtocol_researchPlanId_fkey"
FOREIGN KEY ("researchPlanId") REFERENCES "ResearchPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchPlanProtocol" ADD CONSTRAINT "ResearchPlanProtocol_protocolId_fkey"
FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_researchPlanId_fkey"
FOREIGN KEY ("researchPlanId") REFERENCES "ResearchPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_researchPlanId_fkey"
FOREIGN KEY ("researchPlanId") REFERENCES "ResearchPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExperimentProtocolVersion" ADD CONSTRAINT "ExperimentProtocolVersion_experimentId_fkey"
FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperimentProtocolVersion" ADD CONSTRAINT "ExperimentProtocolVersion_protocolVersionId_fkey"
FOREIGN KEY ("protocolVersionId") REFERENCES "ProtocolVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProtocolVersion" ADD CONSTRAINT "ProtocolVersion_previousVersionId_fkey"
FOREIGN KEY ("previousVersionId") REFERENCES "ProtocolVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProtocolVersion" ADD CONSTRAINT "ProtocolVersion_derivedFromVersionId_fkey"
FOREIGN KEY ("derivedFromVersionId") REFERENCES "ProtocolVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AISettings" ADD CONSTRAINT "AISettings_defaultProviderId_fkey"
FOREIGN KEY ("defaultProviderId") REFERENCES "AIProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
