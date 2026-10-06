-- Preserve all historical timestamps; unknown event precision is not inferred.
ALTER TABLE "Entry" ADD COLUMN "eventTimePrecision" TEXT NOT NULL DEFAULT 'unknown';
