-- Add explicit library/Project ownership, recover the already-deployed
-- first-class SequencePair model, and add auditable design workflows.
-- Every operation is additive; legacy Sequence and Collection rows are kept.

DO $$ BEGIN
  CREATE TYPE "SequenceOwnershipScope" AS ENUM ('library', 'project');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "SequenceEntryClass" AS ENUM ('nucleic_acid', 'amino_acid', 'oligo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "SequencePairType" AS ENUM ('primer_pair', 'sirna_duplex');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "SequencePairRole" AS ENUM ('forward', 'reverse', 'sense', 'antisense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "SequenceWorkflowType" AS ENUM ('alignment', 'assembly', 'crispr');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "SequenceCollectionType" ADD VALUE IF NOT EXISTS 'primer_panel';
ALTER TYPE "SequenceCollectionType" ADD VALUE IF NOT EXISTS 'sirna_series';
ALTER TYPE "SequenceCollectionType" ADD VALUE IF NOT EXISTS 'sequence_series';

ALTER TABLE "Sequence"
  ADD COLUMN IF NOT EXISTS "entryClass" "SequenceEntryClass" NOT NULL DEFAULT 'nucleic_acid',
  ADD COLUMN IF NOT EXISTS "ownershipScope" "SequenceOwnershipScope" NOT NULL DEFAULT 'library';

UPDATE "Sequence"
SET "ownershipScope" = CASE WHEN "projectId" IS NULL THEN 'library'::"SequenceOwnershipScope" ELSE 'project'::"SequenceOwnershipScope" END,
    "entryClass" = CASE
      WHEN "designType" IN ('peptide', 'protein') THEN 'amino_acid'::"SequenceEntryClass"
      WHEN "designType" IN ('primer', 'probe', 'siRNA', 'shRNA', 'gRNA', 'oligo') THEN 'oligo'::"SequenceEntryClass"
      ELSE 'nucleic_acid'::"SequenceEntryClass"
    END;

CREATE TABLE IF NOT EXISTS "SequencePair" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "SequencePairType" NOT NULL,
  "status" "SequenceLifecycleStatus" NOT NULL DEFAULT 'draft',
  "description" TEXT,
  "projectId" TEXT,
  "targetName" TEXT,
  "organism" TEXT,
  "metadataJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SequencePair_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SequencePair_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "SequencePair"
  ADD COLUMN IF NOT EXISTS "ownershipScope" "SequenceOwnershipScope" NOT NULL DEFAULT 'library';
UPDATE "SequencePair"
SET "ownershipScope" = CASE WHEN "projectId" IS NULL THEN 'library'::"SequenceOwnershipScope" ELSE 'project'::"SequenceOwnershipScope" END;

CREATE TABLE IF NOT EXISTS "SequencePairMember" (
  "id" TEXT NOT NULL,
  "pairId" TEXT NOT NULL,
  "sequenceId" TEXT NOT NULL,
  "sequenceVersionId" TEXT NOT NULL,
  "role" "SequencePairRole" NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  CONSTRAINT "SequencePairMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SequencePairMember_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "SequencePair"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SequencePairMember_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SequencePairMember_sequenceVersionId_fkey" FOREIGN KEY ("sequenceVersionId") REFERENCES "SequenceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SequenceCollectionPairMember" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "pairId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "order" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  CONSTRAINT "SequenceCollectionPairMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SequenceCollectionPairMember_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "SequenceCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SequenceCollectionPairMember_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "SequencePair"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "SequenceCollection"
  ADD COLUMN IF NOT EXISTS "ownershipScope" "SequenceOwnershipScope" NOT NULL DEFAULT 'library';
UPDATE "SequenceCollection"
SET "ownershipScope" = CASE WHEN "projectId" IS NULL THEN 'library'::"SequenceOwnershipScope" ELSE 'project'::"SequenceOwnershipScope" END;

CREATE UNIQUE INDEX IF NOT EXISTS "SequencePair_code_key" ON "SequencePair"("code");
CREATE INDEX IF NOT EXISTS "SequencePair_type_idx" ON "SequencePair"("type");
CREATE INDEX IF NOT EXISTS "SequencePair_status_idx" ON "SequencePair"("status");
CREATE INDEX IF NOT EXISTS "SequencePair_ownershipScope_idx" ON "SequencePair"("ownershipScope");
CREATE INDEX IF NOT EXISTS "SequencePair_projectId_idx" ON "SequencePair"("projectId");
CREATE INDEX IF NOT EXISTS "SequencePair_targetName_idx" ON "SequencePair"("targetName");
CREATE UNIQUE INDEX IF NOT EXISTS "SequencePairMember_sequenceId_key" ON "SequencePairMember"("sequenceId");
CREATE UNIQUE INDEX IF NOT EXISTS "SequencePairMember_sequenceVersionId_key" ON "SequencePairMember"("sequenceVersionId");
CREATE UNIQUE INDEX IF NOT EXISTS "SequencePairMember_pairId_role_key" ON "SequencePairMember"("pairId", "role");
CREATE UNIQUE INDEX IF NOT EXISTS "SequencePairMember_pairId_sequenceId_key" ON "SequencePairMember"("pairId", "sequenceId");
CREATE INDEX IF NOT EXISTS "SequencePairMember_pairId_order_idx" ON "SequencePairMember"("pairId", "order");
CREATE UNIQUE INDEX IF NOT EXISTS "SequenceCollectionPairMember_collectionId_pairId_role_key" ON "SequenceCollectionPairMember"("collectionId", "pairId", "role");
CREATE INDEX IF NOT EXISTS "SequenceCollectionPairMember_collectionId_order_idx" ON "SequenceCollectionPairMember"("collectionId", "order");
CREATE INDEX IF NOT EXISTS "SequenceCollectionPairMember_pairId_idx" ON "SequenceCollectionPairMember"("pairId");
CREATE INDEX IF NOT EXISTS "Sequence_entryClass_idx" ON "Sequence"("entryClass");
CREATE INDEX IF NOT EXISTS "Sequence_ownershipScope_idx" ON "Sequence"("ownershipScope");
CREATE INDEX IF NOT EXISTS "SequenceCollection_ownershipScope_idx" ON "SequenceCollection"("ownershipScope");

-- Convert only unambiguous, complete unpaired strand groups. Source Sequence
-- rows and any legacy Collections remain unchanged for auditability.
WITH candidates AS (
  SELECT
    sequence_record."id" AS "sequenceId",
    latest_version."id" AS "sequenceVersionId",
    sequence_record."designType",
    sequence_record."status",
    sequence_record."projectId",
    sequence_record."targetName",
    sequence_record."organism",
    sequence_record."createdAt",
    sequence_record."updatedAt",
    CASE WHEN sequence_record."designType" = 'primer' THEN 'primer_pair'::"SequencePairType" ELSE 'sirna_duplex'::"SequencePairType" END AS "pairType",
    CASE
      WHEN sequence_record."designType" = 'primer' AND sequence_record."name" ~* 'f[0-9]*$' THEN 'forward'::"SequencePairRole"
      WHEN sequence_record."designType" = 'primer' THEN 'reverse'::"SequencePairRole"
      WHEN sequence_record."name" ~* 'antisense$' THEN 'antisense'::"SequencePairRole"
      ELSE 'sense'::"SequencePairRole"
    END AS "pairRole",
    CASE
      WHEN sequence_record."designType" = 'primer' THEN regexp_replace(sequence_record."name", '[-_ ]?q?[fr][0-9]*$', '', 'i') || CASE WHEN substring(sequence_record."name" FROM '([0-9]+)$') IS NULL THEN '' ELSE ' #' || substring(sequence_record."name" FROM '([0-9]+)$') END
      ELSE regexp_replace(sequence_record."name", '[-_ ]*(antisense|sense)$', '', 'i')
    END AS "pairName",
    lower(sequence_record."designType"::text || '|' || coalesce(sequence_record."projectId", '') || '|' || CASE WHEN sequence_record."designType" = 'primer' THEN regexp_replace(sequence_record."name", '[-_ ]?q?[fr][0-9]*$', '', 'i') || '|' || coalesce(substring(sequence_record."name" FROM '([0-9]+)$'), '1') ELSE regexp_replace(sequence_record."name", '[-_ ]*(antisense|sense)$', '', 'i') END) AS "pairKey"
  FROM "Sequence" sequence_record
  JOIN LATERAL (
    SELECT version."id" FROM "SequenceVersion" version
    WHERE version."sequenceId" = sequence_record."id"
    ORDER BY version."versionNumber" DESC LIMIT 1
  ) latest_version ON true
  LEFT JOIN "SequencePairMember" existing_member ON existing_member."sequenceId" = sequence_record."id"
  WHERE existing_member."id" IS NULL AND (
    (sequence_record."designType" = 'primer' AND sequence_record."name" ~* '[-_ ]?q?[fr][0-9]*$') OR
    (sequence_record."designType" = 'siRNA' AND sequence_record."name" ~* '[-_ ]*(antisense|sense)$')
  )
), complete_groups AS (
  SELECT "pairKey", min("pairName") AS "pairName", min("pairType"::text)::"SequencePairType" AS "pairType",
    CASE WHEN bool_and("status" = 'active') THEN 'active'::"SequenceLifecycleStatus" WHEN bool_and("status" = 'inactive') THEN 'inactive'::"SequenceLifecycleStatus" WHEN bool_and("status" = 'archived') THEN 'archived'::"SequenceLifecycleStatus" ELSE 'draft'::"SequenceLifecycleStatus" END AS "pairStatus",
    min("projectId") AS "projectId", min("targetName") AS "targetName", min("organism") AS "organism", min("createdAt") AS "createdAt", max("updatedAt") AS "updatedAt"
  FROM candidates GROUP BY "pairKey" HAVING count(*) = 2 AND count(DISTINCT "pairRole") = 2
)
INSERT INTO "SequencePair" ("id", "code", "name", "type", "status", "ownershipScope", "projectId", "targetName", "organism", "metadataJson", "createdAt", "updatedAt")
SELECT 'pair_' || substr(md5(groups."pairKey"), 1, 24), 'PAI-' || substr(md5(groups."pairKey"), 1, 10), groups."pairName", groups."pairType", groups."pairStatus",
  CASE WHEN groups."projectId" IS NULL THEN 'library'::"SequenceOwnershipScope" ELSE 'project'::"SequenceOwnershipScope" END,
  groups."projectId", groups."targetName", groups."organism", jsonb_build_object('migratedFromLegacySequences', true), groups."createdAt", groups."updatedAt"
FROM complete_groups groups ON CONFLICT ("id") DO NOTHING;

WITH candidates AS (
  SELECT sequence_record."id" AS "sequenceId", latest_version."id" AS "sequenceVersionId",
    CASE WHEN sequence_record."designType" = 'primer' AND sequence_record."name" ~* 'f[0-9]*$' THEN 'forward'::"SequencePairRole" WHEN sequence_record."designType" = 'primer' THEN 'reverse'::"SequencePairRole" WHEN sequence_record."name" ~* 'antisense$' THEN 'antisense'::"SequencePairRole" ELSE 'sense'::"SequencePairRole" END AS "pairRole",
    lower(sequence_record."designType"::text || '|' || coalesce(sequence_record."projectId", '') || '|' || CASE WHEN sequence_record."designType" = 'primer' THEN regexp_replace(sequence_record."name", '[-_ ]?q?[fr][0-9]*$', '', 'i') || '|' || coalesce(substring(sequence_record."name" FROM '([0-9]+)$'), '1') ELSE regexp_replace(sequence_record."name", '[-_ ]*(antisense|sense)$', '', 'i') END) AS "pairKey"
  FROM "Sequence" sequence_record
  JOIN LATERAL (SELECT version."id" FROM "SequenceVersion" version WHERE version."sequenceId" = sequence_record."id" ORDER BY version."versionNumber" DESC LIMIT 1) latest_version ON true
  LEFT JOIN "SequencePairMember" existing_member ON existing_member."sequenceId" = sequence_record."id"
  WHERE existing_member."id" IS NULL AND ((sequence_record."designType" = 'primer' AND sequence_record."name" ~* '[-_ ]?q?[fr][0-9]*$') OR (sequence_record."designType" = 'siRNA' AND sequence_record."name" ~* '[-_ ]*(antisense|sense)$'))
), complete_candidates AS (
  SELECT candidate.* FROM candidates candidate JOIN (SELECT "pairKey" FROM candidates GROUP BY "pairKey" HAVING count(*) = 2 AND count(DISTINCT "pairRole") = 2) groups USING ("pairKey")
)
INSERT INTO "SequencePairMember" ("id", "pairId", "sequenceId", "sequenceVersionId", "role", "order")
SELECT 'pairmember_' || substr(md5(candidate."pairKey" || '|' || candidate."sequenceId"), 1, 18), 'pair_' || substr(md5(candidate."pairKey"), 1, 24), candidate."sequenceId", candidate."sequenceVersionId", candidate."pairRole", CASE WHEN candidate."pairRole" IN ('forward', 'sense') THEN 0 ELSE 1 END
FROM complete_candidates candidate ON CONFLICT DO NOTHING;

CREATE TABLE "SequenceWorkflow" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" "SequenceWorkflowType" NOT NULL,
  "name" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "status" "SequenceLifecycleStatus" NOT NULL DEFAULT 'draft',
  "method" TEXT NOT NULL,
  "reference" TEXT,
  "pam" TEXT,
  "description" TEXT,
  "metadataJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SequenceWorkflow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SequenceWorkflow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "SequenceWorkflowInput" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "sequenceVersionId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'input',
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SequenceWorkflowInput_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SequenceWorkflowInput_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "SequenceWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SequenceWorkflowInput_sequenceVersionId_fkey" FOREIGN KEY ("sequenceVersionId") REFERENCES "SequenceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SequenceWorkflow_code_key" ON "SequenceWorkflow"("code");
CREATE INDEX "SequenceWorkflow_type_idx" ON "SequenceWorkflow"("type");
CREATE INDEX "SequenceWorkflow_projectId_idx" ON "SequenceWorkflow"("projectId");
CREATE INDEX "SequenceWorkflow_status_idx" ON "SequenceWorkflow"("status");
CREATE UNIQUE INDEX "SequenceWorkflowInput_workflowId_sequenceVersionId_role_key" ON "SequenceWorkflowInput"("workflowId", "sequenceVersionId", "role");
CREATE INDEX "SequenceWorkflowInput_workflowId_order_idx" ON "SequenceWorkflowInput"("workflowId", "order");
CREATE INDEX "SequenceWorkflowInput_sequenceVersionId_idx" ON "SequenceWorkflowInput"("sequenceVersionId");

CREATE TABLE "ScientificSchemaDefinition" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "entityType" "EntityType" NOT NULL,
  "objectKind" TEXT NOT NULL DEFAULT 'entity',
  "prefix" TEXT,
  "fieldDefinitions" JSONB NOT NULL DEFAULT '[]',
  "defaultSettings" JSONB NOT NULL DEFAULT '{}',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScientificSchemaDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScientificSchemaDefinition_key_key" ON "ScientificSchemaDefinition"("key");
CREATE INDEX "ScientificSchemaDefinition_enabled_label_idx" ON "ScientificSchemaDefinition"("enabled", "label");
CREATE INDEX "ScientificSchemaDefinition_entityType_idx" ON "ScientificSchemaDefinition"("entityType");

INSERT INTO "ScientificSchemaDefinition" ("id", "key", "label", "entityType", "objectKind", "prefix", "fieldDefinitions", "defaultSettings", "updatedAt") VALUES
  ('schema_plasmid', 'plasmid', 'Plasmid', 'plasmid', 'sequence_entity', 'PLS', '[{"key":"backbone","label":"Backbone"},{"key":"selectionMarker","label":"Selection marker"}]', '{"entryClass":"nucleic_acid","moleculeType":"DNA"}', CURRENT_TIMESTAMP),
  ('schema_primer', 'primer', 'Primer', 'primer', 'sequence_entity', 'PRM', '[{"key":"application","label":"Application"},{"key":"expectedTmC","label":"Expected Tm (C)"}]', '{"entryClass":"oligo","moleculeType":"DNA"}', CURRENT_TIMESTAMP),
  ('schema_probe', 'probe', 'Probe', 'oligo', 'sequence_entity', 'PRB', '[{"key":"chemistry","label":"Chemistry"},{"key":"fluorophore","label":"Fluorophore"}]', '{"entryClass":"oligo","moleculeType":"DNA"}', CURRENT_TIMESTAMP),
  ('schema_sirna', 'sirna', 'siRNA', 'oligo', 'sequence_entity', 'SIR', '[{"key":"transcriptAccession","label":"Transcript accession"},{"key":"targetRegion","label":"Target region"}]', '{"entryClass":"oligo","moleculeType":"RNA"}', CURRENT_TIMESTAMP),
  ('schema_grna', 'grna', 'gRNA', 'oligo', 'sequence_entity', 'GRN', '[{"key":"pam","label":"PAM"},{"key":"targetRegion","label":"Target region"}]', '{"entryClass":"oligo","moleculeType":"RNA"}', CURRENT_TIMESTAMP),
  ('schema_protein', 'protein', 'Protein', 'protein', 'sequence_entity', 'PRO', '[{"key":"accession","label":"Accession"},{"key":"domain","label":"Domain"}]', '{"entryClass":"amino_acid","moleculeType":"Protein"}', CURRENT_TIMESTAMP),
  ('schema_cell_line', 'cell_line', 'Cell line', 'cell_line', 'entity', 'CL', '[{"key":"organism","label":"Organism"},{"key":"tissue","label":"Tissue"}]', '{}', CURRENT_TIMESTAMP),
  ('schema_antibody', 'antibody', 'Antibody', 'antibody', 'entity', 'AB', '[{"key":"target","label":"Target"},{"key":"clone","label":"Clone"}]', '{}', CURRENT_TIMESTAMP),
  ('schema_custom', 'custom', 'Custom entity', 'other', 'entity', NULL, '[]', '{}', CURRENT_TIMESTAMP);
