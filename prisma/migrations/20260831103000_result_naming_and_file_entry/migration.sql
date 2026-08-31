-- Keep the historical system template key for compatibility, but make the
-- user-facing Result classification and default title describe the record as a
-- Result rather than a report.
UPDATE "Result"
SET
  "title" = regexp_replace("title", ' · Result report$', ' · Result'),
  "resultType" = 'Experiment result',
  "templateSnapshotJson" = CASE
    WHEN jsonb_typeof("templateSnapshotJson") = 'object' THEN
      jsonb_set(
        jsonb_set("templateSnapshotJson", '{result_type}', to_jsonb('Experiment result'::text), true),
        '{title}',
        to_jsonb('Experiment result'::text),
        true
      )
    ELSE "templateSnapshotJson"
  END,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "templateKey" = 'experiment_result_report';
