-- Experiments may select reusable Protocols from the whole library. Keep the
-- association separate from Protocol ownership so one library method can be
-- used by several Projects without being moved between them.
CREATE TABLE "ProjectProtocol" (
    "projectId" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectProtocol_pkey" PRIMARY KEY ("projectId", "protocolId")
);

CREATE INDEX "ProjectProtocol_protocolId_idx" ON "ProjectProtocol"("protocolId");

ALTER TABLE "ProjectProtocol"
ADD CONSTRAINT "ProjectProtocol_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectProtocol"
ADD CONSTRAINT "ProjectProtocol_protocolId_fkey"
FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing project-owned Protocols are also visible in the new association
-- list. This is additive and does not change Protocol.projectId.
INSERT INTO "ProjectProtocol" ("projectId", "protocolId")
SELECT "projectId", "id"
FROM "Protocol"
WHERE "projectId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- A group is one selected ProtocolVersion (or the custom/manual block). The
-- title is snapshotted for bench readability and remains stable historically.
ALTER TABLE "ExperimentStep"
ADD COLUMN "groupKey" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN "groupTitle" TEXT NOT NULL DEFAULT 'Custom experiment steps',
ADD COLUMN "groupOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "ExperimentStep" AS step
SET "groupKey" = experiment."protocolVersionId",
    "groupTitle" = protocol."title" || ' · ' || version."title" || ' · v' || version."displayVersion"
FROM "Experiment" AS experiment
JOIN "ProtocolVersion" AS version ON version."id" = experiment."protocolVersionId"
JOIN "Protocol" AS protocol ON protocol."id" = version."protocolId"
WHERE step."experimentId" = experiment."id";

DROP INDEX IF EXISTS "ExperimentStep_experimentId_order_idx";
CREATE INDEX "ExperimentStep_experimentId_groupOrder_order_idx"
ON "ExperimentStep"("experimentId", "groupOrder", "order");

-- Result types are a user-editable vocabulary. Result.resultType deliberately
-- stays denormalized so later edits/deletions cannot rewrite prior evidence.
CREATE TABLE "ResultTypeDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultTypeDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResultTypeDefinition_key_key" ON "ResultTypeDefinition"("key");
CREATE UNIQUE INDEX "ResultTypeDefinition_label_key" ON "ResultTypeDefinition"("label");
CREATE INDEX "ResultTypeDefinition_sortOrder_label_idx" ON "ResultTypeDefinition"("sortOrder", "label");

INSERT INTO "ResultTypeDefinition" ("id", "key", "label", "description", "sortOrder") VALUES
('result-type-observation', 'observation', 'Observation', 'Qualitative observation or bench note.', 10),
('result-type-measurement', 'measurement', 'Measurement', 'A general quantitative measurement.', 20),
('result-type-qpcr', 'qpcr', 'qPCR', 'qPCR or RT-qPCR result.', 30),
('result-type-imaging', 'imaging', 'Imaging', 'Microscopy or other image-based result.', 40),
('result-type-cell-count', 'cell_count', 'Cell count', 'Cell number, viability or confluence result.', 50),
('result-type-western-blot', 'western_blot', 'Western blot', 'Immunoblot image or densitometry result.', 60),
('result-type-flow-cytometry', 'flow_cytometry', 'Flow cytometry', 'Flow cytometry acquisition or analysis result.', 70),
('result-type-omics', 'omics', 'Omics dataset', 'Sequencing, proteomics, metabolomics or another omics result.', 80),
('result-type-other', 'other', 'Other', 'A result that does not fit the current vocabulary.', 999);

-- Preserve currently used free-text types as selectable options as well.
INSERT INTO "ResultTypeDefinition" ("id", "key", "label", "description", "sortOrder")
SELECT
  'result-type-existing-' || md5("resultType"),
  'existing_' || md5("resultType"),
  "resultType",
  'Imported from an existing Result record.',
  500
FROM (SELECT DISTINCT "resultType" FROM "Result" WHERE btrim("resultType") <> '') AS existing
WHERE NOT EXISTS (
  SELECT 1 FROM "ResultTypeDefinition" definition
  WHERE lower(definition."label") = lower(existing."resultType")
)
ON CONFLICT DO NOTHING;
