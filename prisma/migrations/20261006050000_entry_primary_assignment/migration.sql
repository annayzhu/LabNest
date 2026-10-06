-- Additive migration: no historical record timestamps or documents are rewritten.
ALTER TABLE "Entry" ADD COLUMN "entryType" TEXT NOT NULL DEFAULT 'unclassified';
CREATE UNIQUE INDEX "ItemLink_one_primary_entry_target" ON "ItemLink" ("sourceId")
WHERE "sourceType" = 'entry' AND "linkType" = 'entry_primary';
-- Existing explicit Run context is a primary experiment reference, not copied content.
INSERT INTO "ItemLink" (id,"sourceType","sourceId","targetType","targetId","linkType","createdBy","createdAt")
SELECT 'entry-primary-' || id, 'entry', id, 'experiment', "experimentId", 'entry_primary', 'system', "createdAt"
FROM "Entry" WHERE "experimentId" IS NOT NULL;

