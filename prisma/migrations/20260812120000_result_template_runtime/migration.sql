-- Result Templates remain immutable ProtocolVersion projections. Result rows
-- store a frozen snapshot and actual values separately so later Protocol edits
-- cannot rewrite historical evidence.

CREATE TYPE "ResultValidationStatus" AS ENUM ('not_applicable', 'incomplete', 'valid', 'warning', 'invalid');

ALTER TABLE "Result"
ADD COLUMN "protocolVersionId" TEXT,
ADD COLUMN "templateKey" TEXT,
ADD COLUMN "templateSnapshotJson" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "valuesJson" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "validationStatus" "ResultValidationStatus" NOT NULL DEFAULT 'not_applicable',
ADD COLUMN "validationJson" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "viewSpecJson" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "ResultDataset"
ADD COLUMN "templateDatasetKey" TEXT,
ADD COLUMN "schemaJson" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "validationStatus" "ResultValidationStatus" NOT NULL DEFAULT 'not_applicable',
ADD COLUMN "validationJson" JSONB NOT NULL DEFAULT '{}';

-- Recover the explicit ProtocolVersion relationship from the existing
-- provenance JSON only when the referenced version still exists.
UPDATE "Result" AS result
SET "protocolVersionId" = version."id"
FROM "ProtocolVersion" AS version
WHERE result."provenanceJson"->>'protocolVersionId' = version."id";

-- Older template-created Results stored only templateFields in metadataJson.
-- Preserve that schema as a version-1 snapshot instead of silently discarding it.
UPDATE "Result"
SET "templateKey" = regexp_replace(lower("resultType"), '[^a-z0-9]+', '_', 'g'),
    "templateSnapshotJson" = jsonb_build_object(
      'schemaVersion', 1,
      'templateKey', regexp_replace(lower("resultType"), '[^a-z0-9]+', '_', 'g'),
      'result_type', "resultType",
      'title', "resultType",
      'resultKind', 'measurement',
      'cardinality', 'per_run',
      'fields', COALESCE("metadataJson"->'templateFields', "metadataJson"->'template_fields', '[]'::jsonb),
      'datasets', '[]'::jsonb,
      'artifacts', '[]'::jsonb,
      'view', jsonb_build_object('preset', 'generic', 'charts', '[]'::jsonb)
    ),
    "validationStatus" = 'incomplete'
WHERE "sourceType" = 'protocol_template';

CREATE INDEX "Result_validationStatus_idx" ON "Result"("validationStatus");
CREATE INDEX "Result_protocolVersionId_idx" ON "Result"("protocolVersionId");
CREATE INDEX "Result_templateKey_idx" ON "Result"("templateKey");
CREATE INDEX "ResultDataset_templateDatasetKey_idx" ON "ResultDataset"("templateDatasetKey");
CREATE INDEX "ResultDataset_validationStatus_idx" ON "ResultDataset"("validationStatus");

ALTER TABLE "Result"
ADD CONSTRAINT "Result_protocolVersionId_fkey"
FOREIGN KEY ("protocolVersionId") REFERENCES "ProtocolVersion"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
