-- Sequence Registry phase 1/2.
-- Existing Sequence rows are retained as stable records and their current
-- content is promoted to immutable version 1 before legacy columns are removed.

CREATE TYPE "SequenceDesignType" AS ENUM ('plasmid', 'primer', 'probe', 'siRNA', 'shRNA', 'gRNA', 'oligo', 'peptide', 'protein', 'fragment', 'other');
CREATE TYPE "SequenceLifecycleStatus" AS ENUM ('draft', 'active', 'inactive', 'archived');
CREATE TYPE "SequenceValidationStatus" AS ENUM ('unverified', 'validation_in_progress', 'validated_recommended', 'validated_limited', 'validated_not_recommended', 'inconclusive');
CREATE TYPE "SequenceTopology" AS ENUM ('linear', 'circular');
CREATE TYPE "SequenceStrandedness" AS ENUM ('single', 'double', 'unknown');
CREATE TYPE "SequenceSourceType" AS ENUM ('manual', 'fasta_import', 'csv_import', 'xlsx_import');
CREATE TYPE "SequenceCollectionType" AS ENUM ('primer_pair', 'sirna_duplex', 'shrna_construct', 'probe_panel', 'plasmid_construct', 'peptide_set', 'other');

ALTER TABLE "Sequence"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "designType" "SequenceDesignType" NOT NULL DEFAULT 'other',
  ADD COLUMN "status" "SequenceLifecycleStatus" NOT NULL DEFAULT 'draft',
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "targetName" TEXT,
  ADD COLUMN "organism" TEXT;

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS row_number
  FROM "Sequence"
)
UPDATE "Sequence" AS sequence_record
SET "code" = 'SEQ-' || LPAD(numbered.row_number::TEXT, 6, '0')
FROM numbered
WHERE sequence_record."id" = numbered."id";

UPDATE "Sequence" AS sequence_record
SET "designType" = CASE
  WHEN EXISTS (SELECT 1 FROM "Entity" WHERE "Entity"."sequenceId" = sequence_record."id" AND "Entity"."type" = 'plasmid') THEN 'plasmid'::"SequenceDesignType"
  WHEN EXISTS (SELECT 1 FROM "Entity" WHERE "Entity"."sequenceId" = sequence_record."id" AND "Entity"."type" = 'primer') THEN 'primer'::"SequenceDesignType"
  WHEN EXISTS (SELECT 1 FROM "Entity" WHERE "Entity"."sequenceId" = sequence_record."id" AND "Entity"."type" = 'oligo') THEN 'oligo'::"SequenceDesignType"
  WHEN "type" = 'Protein' THEN 'protein'::"SequenceDesignType"
  ELSE 'other'::"SequenceDesignType"
END;

ALTER TABLE "Sequence" ALTER COLUMN "code" SET NOT NULL;

CREATE TABLE "SequenceVersion" (
  "id" TEXT NOT NULL,
  "sequenceId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "displayVersion" TEXT NOT NULL DEFAULT '1.0',
  "moleculeType" "SequenceType" NOT NULL,
  "sequence" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "topology" "SequenceTopology" NOT NULL DEFAULT 'linear',
  "strandedness" "SequenceStrandedness" NOT NULL DEFAULT 'unknown',
  "orientation" TEXT NOT NULL DEFAULT '5to3',
  "validationStatus" "SequenceValidationStatus" NOT NULL DEFAULT 'unverified',
  "validationSummary" TEXT,
  "validatedAt" TIMESTAMP(3),
  "changeSummary" TEXT,
  "sourceType" "SequenceSourceType" NOT NULL DEFAULT 'manual',
  "sourceFileName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SequenceVersion_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SequenceVersion" (
  "id", "sequenceId", "versionNumber", "displayVersion", "moleculeType",
  "sequence", "checksum", "topology", "strandedness", "orientation",
  "sourceType", "createdAt"
)
SELECT
  "id" || '-v1', "id", 1, '1.0', "type", UPPER(REGEXP_REPLACE("sequence", '\s+', '', 'g')),
  MD5(UPPER(REGEXP_REPLACE("sequence", '\s+', '', 'g'))),
  CASE WHEN "designType" = 'plasmid' THEN 'circular'::"SequenceTopology" ELSE 'linear'::"SequenceTopology" END,
  'unknown'::"SequenceStrandedness", '5to3', 'manual'::"SequenceSourceType", "createdAt"
FROM "Sequence";

ALTER TABLE "SequenceFeature" ADD COLUMN "sequenceVersionId" TEXT;
UPDATE "SequenceFeature"
SET "sequenceVersionId" = "sequenceId" || '-v1';
ALTER TABLE "SequenceFeature" ALTER COLUMN "sequenceVersionId" SET NOT NULL;
ALTER TABLE "SequenceFeature" DROP CONSTRAINT "SequenceFeature_sequenceId_fkey";
ALTER TABLE "SequenceFeature" DROP COLUMN "sequenceId";

CREATE TABLE "SequenceModification" (
  "id" TEXT NOT NULL,
  "sequenceVersionId" TEXT NOT NULL,
  "position" TEXT NOT NULL,
  "modification" TEXT NOT NULL,
  "note" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SequenceModification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EntitySequenceLink" (
  "id" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "sequenceId" TEXT NOT NULL,
  "sequenceVersionId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'primary',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntitySequenceLink_pkey" PRIMARY KEY ("id")
);

INSERT INTO "EntitySequenceLink" (
  "id", "entityId", "sequenceId", "sequenceVersionId", "role", "isPrimary", "order", "createdAt"
)
SELECT
  "Entity"."id" || '-sequence-link', "Entity"."id", "Entity"."sequenceId",
  "Entity"."sequenceId" || '-v1', 'primary', true, 0, CURRENT_TIMESTAMP
FROM "Entity"
WHERE "Entity"."sequenceId" IS NOT NULL;

CREATE TABLE "SequenceCollection" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "SequenceCollectionType" NOT NULL,
  "status" "SequenceLifecycleStatus" NOT NULL DEFAULT 'draft',
  "description" TEXT,
  "projectId" TEXT,
  "metadataJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SequenceCollection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SequenceCollectionMember" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "sequenceVersionId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "order" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  CONSTRAINT "SequenceCollectionMember_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Sequence"
  ADD CONSTRAINT "Sequence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SequenceVersion"
  ADD CONSTRAINT "SequenceVersion_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SequenceFeature"
  ADD CONSTRAINT "SequenceFeature_sequenceVersionId_fkey" FOREIGN KEY ("sequenceVersionId") REFERENCES "SequenceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SequenceModification"
  ADD CONSTRAINT "SequenceModification_sequenceVersionId_fkey" FOREIGN KEY ("sequenceVersionId") REFERENCES "SequenceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntitySequenceLink"
  ADD CONSTRAINT "EntitySequenceLink_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EntitySequenceLink_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EntitySequenceLink_sequenceVersionId_fkey" FOREIGN KEY ("sequenceVersionId") REFERENCES "SequenceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SequenceCollection"
  ADD CONSTRAINT "SequenceCollection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SequenceCollectionMember"
  ADD CONSTRAINT "SequenceCollectionMember_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "SequenceCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SequenceCollectionMember_sequenceVersionId_fkey" FOREIGN KEY ("sequenceVersionId") REFERENCES "SequenceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Sequence_code_key" ON "Sequence"("code");
CREATE INDEX "Sequence_designType_idx" ON "Sequence"("designType");
CREATE INDEX "Sequence_status_idx" ON "Sequence"("status");
CREATE INDEX "Sequence_projectId_idx" ON "Sequence"("projectId");
CREATE INDEX "Sequence_targetName_idx" ON "Sequence"("targetName");
CREATE UNIQUE INDEX "SequenceVersion_sequenceId_versionNumber_key" ON "SequenceVersion"("sequenceId", "versionNumber");
CREATE UNIQUE INDEX "SequenceVersion_sequenceId_checksum_key" ON "SequenceVersion"("sequenceId", "checksum");
CREATE INDEX "SequenceVersion_moleculeType_idx" ON "SequenceVersion"("moleculeType");
CREATE INDEX "SequenceVersion_validationStatus_idx" ON "SequenceVersion"("validationStatus");
CREATE INDEX "SequenceVersion_checksum_idx" ON "SequenceVersion"("checksum");
CREATE INDEX "SequenceFeature_sequenceVersionId_idx" ON "SequenceFeature"("sequenceVersionId");
CREATE INDEX "SequenceModification_sequenceVersionId_order_idx" ON "SequenceModification"("sequenceVersionId", "order");
CREATE UNIQUE INDEX "EntitySequenceLink_entityId_sequenceVersionId_role_key" ON "EntitySequenceLink"("entityId", "sequenceVersionId", "role");
CREATE INDEX "EntitySequenceLink_entityId_order_idx" ON "EntitySequenceLink"("entityId", "order");
CREATE INDEX "EntitySequenceLink_sequenceId_idx" ON "EntitySequenceLink"("sequenceId");
CREATE INDEX "EntitySequenceLink_sequenceVersionId_idx" ON "EntitySequenceLink"("sequenceVersionId");
CREATE UNIQUE INDEX "SequenceCollection_code_key" ON "SequenceCollection"("code");
CREATE INDEX "SequenceCollection_type_idx" ON "SequenceCollection"("type");
CREATE INDEX "SequenceCollection_status_idx" ON "SequenceCollection"("status");
CREATE INDEX "SequenceCollection_projectId_idx" ON "SequenceCollection"("projectId");
CREATE UNIQUE INDEX "SequenceCollectionMember_collectionId_sequenceVersionId_role_key" ON "SequenceCollectionMember"("collectionId", "sequenceVersionId", "role");
CREATE INDEX "SequenceCollectionMember_collectionId_order_idx" ON "SequenceCollectionMember"("collectionId", "order");
CREATE INDEX "SequenceCollectionMember_sequenceVersionId_idx" ON "SequenceCollectionMember"("sequenceVersionId");

ALTER TABLE "Sequence" DROP COLUMN "type", DROP COLUMN "sequence";
