CREATE TYPE "ProtocolVersionSourceType" AS ENUM ('manual', 'docx_import', 'derived');

ALTER TABLE "ProtocolVersion"
ADD COLUMN "contentJson" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "sourceFileChecksum" TEXT,
ADD COLUMN "sourceFileName" TEXT,
ADD COLUMN "sourceImportedAt" TIMESTAMP(3),
ADD COLUMN "sourceType" "ProtocolVersionSourceType" NOT NULL DEFAULT 'manual';

CREATE INDEX "ProtocolVersion_sourceType_idx" ON "ProtocolVersion"("sourceType");
