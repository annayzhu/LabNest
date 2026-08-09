-- Phase 2 Entry multimedia foundation.
-- Existing plain-text entries remain valid; contentJson is progressively populated.

ALTER TABLE "Entry"
ADD COLUMN "contentJson" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "Attachment"
ADD COLUMN "sha256" TEXT,
ADD COLUMN "metadataJson" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "derivedFromId" TEXT,
ADD COLUMN "derivativeKind" TEXT;

ALTER TABLE "AttachmentLink"
ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Attachment_sha256_idx" ON "Attachment"("sha256");
CREATE INDEX "Attachment_derivedFromId_idx" ON "Attachment"("derivedFromId");

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_derivedFromId_fkey"
FOREIGN KEY ("derivedFromId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
