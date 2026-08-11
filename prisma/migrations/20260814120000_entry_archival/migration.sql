-- Entry review state records scientific maturity; archival is a separate,
-- reversible visibility lifecycle and must not overwrite that audit state.
ALTER TABLE "Entry" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Entry_archivedAt_idx" ON "Entry"("archivedAt");
