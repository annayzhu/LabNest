-- Every Research Plan, Protocol, and Experiment receives a globally unique,
-- type-prefixed code. Existing missing values are assigned deterministically
-- by creation order before the columns become required.

WITH current_max AS (
  SELECT COALESCE(MAX(CASE WHEN "code" ~ '^RP-[0-9]+$' THEN substring("code" from '^RP-([0-9]+)$')::integer END), 0) AS value
  FROM "ResearchPlan"
), missing_codes AS (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS offset
  FROM "ResearchPlan"
  WHERE "code" IS NULL
)
UPDATE "ResearchPlan" AS plan
SET "code" = 'RP-' || lpad((current_max.value + missing_codes.offset)::text, 3, '0')
FROM current_max, missing_codes
WHERE plan."id" = missing_codes."id";

WITH current_max AS (
  SELECT COALESCE(MAX(CASE WHEN "runCode" ~ '^EXP-[0-9]+$' THEN substring("runCode" from '^EXP-([0-9]+)$')::integer END), 0) AS value
  FROM "Experiment"
), missing_codes AS (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS offset
  FROM "Experiment"
  WHERE "runCode" IS NULL
)
UPDATE "Experiment" AS experiment
SET "runCode" = 'EXP-' || lpad((current_max.value + missing_codes.offset)::text, 3, '0')
FROM current_max, missing_codes
WHERE experiment."id" = missing_codes."id";

WITH current_max AS (
  SELECT COALESCE(MAX(CASE WHEN "humanCode" ~ '^PRT-[0-9]+$' THEN substring("humanCode" from '^PRT-([0-9]+)$')::integer END), 100000) AS value
  FROM "Protocol"
), missing_codes AS (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS offset
  FROM "Protocol"
  WHERE "humanCode" IS NULL
)
UPDATE "Protocol" AS protocol
SET "humanCode" = 'PRT-' || lpad((current_max.value + missing_codes.offset)::text, 6, '0')
FROM current_max, missing_codes
WHERE protocol."id" = missing_codes."id";

ALTER TABLE "ResearchPlan" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "Experiment" ALTER COLUMN "runCode" SET NOT NULL;
ALTER TABLE "Protocol" ALTER COLUMN "humanCode" SET NOT NULL;

DROP INDEX IF EXISTS "ResearchPlan_projectId_code_key";
DROP INDEX IF EXISTS "Experiment_researchPlanId_runCode_key";
CREATE UNIQUE INDEX "ResearchPlan_code_key" ON "ResearchPlan"("code");
CREATE UNIQUE INDEX "Experiment_runCode_key" ON "Experiment"("runCode");

CREATE TABLE "RecordCodeCounter" (
  "key" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecordCodeCounter_pkey" PRIMARY KEY ("key")
);

INSERT INTO "RecordCodeCounter" ("key", "value", "updatedAt")
SELECT 'research-plan', COALESCE(MAX(substring("code" from '^RP-([0-9]+)$')::integer), 0), CURRENT_TIMESTAMP
FROM "ResearchPlan"
WHERE "code" ~ '^RP-[0-9]+$';

INSERT INTO "RecordCodeCounter" ("key", "value", "updatedAt")
SELECT 'protocol', COALESCE(MAX(substring("humanCode" from '^PRT-([0-9]+)$')::integer), 100000), CURRENT_TIMESTAMP
FROM "Protocol"
WHERE "humanCode" ~ '^PRT-[0-9]+$';

INSERT INTO "RecordCodeCounter" ("key", "value", "updatedAt")
SELECT 'experiment', COALESCE(MAX(substring("runCode" from '^EXP-([0-9]+)$')::integer), 0), CURRENT_TIMESTAMP
FROM "Experiment"
WHERE "runCode" ~ '^EXP-[0-9]+$';
