-- A later version may intentionally restore the exact sequence of an earlier
-- version. Keep the checksum searchable for duplicate warnings, but do not
-- reject a scientifically meaningful revert in the audit trail.
DROP INDEX "SequenceVersion_sequenceId_checksum_key";
CREATE INDEX "SequenceVersion_sequenceId_checksum_idx" ON "SequenceVersion"("sequenceId", "checksum");
