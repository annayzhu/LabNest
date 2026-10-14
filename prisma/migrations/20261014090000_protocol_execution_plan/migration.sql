-- Additive only: old runs remain on their captured legacy contract.
ALTER TABLE "ProtocolRun" ADD COLUMN "executionPlanJson" JSONB NOT NULL DEFAULT '{}';
