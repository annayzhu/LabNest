-- Cardinality-aware Result Templates may create several Result instances for
-- one Experiment (for example one per sample or one per timepoint).
ALTER TABLE "Result"
ADD COLUMN "templateInstanceKey" TEXT,
ADD COLUMN "templateInstanceLabel" TEXT;

CREATE INDEX "Result_experimentId_templateKey_templateInstanceKey_idx"
ON "Result"("experimentId", "templateKey", "templateInstanceKey");
