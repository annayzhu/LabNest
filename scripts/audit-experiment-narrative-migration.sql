\pset pager off

-- Read-only post-migration audit. A row is incomplete when contentJson does
-- not expose the six canonical Experiment sections or searchText is missing
-- despite authored narrative blocks.
WITH document_audit AS (
  SELECT
    e.id,
    e."runCode",
    e.title,
    COALESCE(jsonb_array_length(e."contentJson"->'sections'), 0) AS section_count,
    COALESCE((
      SELECT count(*)
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(e."contentJson"->'sections') = 'array'
          THEN e."contentJson"->'sections'
          ELSE '[]'::jsonb
        END
      ) AS section
      WHERE section->>'key' IN ('background', 'setup', 'execution', 'observations', 'deviations', 'conclusion')
    ), 0) AS canonical_section_count,
    COALESCE((
      SELECT count(*)
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(e."contentJson"->'sections') = 'array'
          THEN e."contentJson"->'sections'
          ELSE '[]'::jsonb
        END
      ) AS section
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(section->'blocks') = 'array'
          THEN section->'blocks'
          ELSE '[]'::jsonb
        END
      ) AS block
    ), 0) AS block_count,
    NULLIF(btrim(COALESCE(e."searchText", '')), '') IS NOT NULL AS has_search_text
  FROM "Experiment" e
)
SELECT
  id,
  "runCode",
  title,
  section_count,
  canonical_section_count,
  block_count,
  has_search_text,
  CASE
    WHEN canonical_section_count <> 6 THEN 'invalid_sections'
    WHEN block_count > 0 AND NOT has_search_text THEN 'missing_search_text'
    ELSE 'ok'
  END AS audit_status
FROM document_audit
ORDER BY "runCode";
