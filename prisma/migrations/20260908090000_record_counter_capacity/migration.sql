-- Preserve existing counters while accepting valid long numeric record identifiers.
ALTER TABLE "RecordCodeCounter" ALTER COLUMN "value" TYPE BIGINT;
