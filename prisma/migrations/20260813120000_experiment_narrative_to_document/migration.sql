-- Retire the Experiment narrative columns in favour of the single contentJson
-- document. Each column becomes a text block at the head of its section, so no
-- recorded text is lost. Section keys mirror `experimentSections` in
-- src/lib/scientific-document.ts.
--
-- `purpose` is deliberately kept: it is the one-line subtitle shown in lists,
-- the calendar and search results, so it stays a queryable column.

ALTER TABLE "Experiment" ADD COLUMN "searchText" TEXT;

UPDATE "Experiment" AS e
SET "contentJson" = sub."doc"
FROM (
  SELECT
    x."id" AS "id",
    jsonb_build_object(
      'schemaVersion', 1,
      'sections', jsonb_agg(b."section" ORDER BY m."ord")
    ) AS "doc"
  FROM "Experiment" x
  CROSS JOIN LATERAL (
    VALUES
      (1, 'background',   'Background & rationale', x."background"),
      (2, 'setup',        'Setup & samples',        x."materialsText"),
      (3, 'execution',    'Execution notes',        x."stepsText"),
      (4, 'observations', 'Observations & media',   x."observations"),
      (5, 'deviations',   'Deviations & incidents', x."deviations"),
      (6, 'conclusion',   'Summary & conclusion',
          concat_ws(
            E'\n\n',
            NULLIF(btrim(COALESCE(x."resultSummary", '')), ''),
            NULLIF(btrim(COALESCE(x."conclusion", '')), '')
          ))
  ) AS m("ord", "key", "title", "text")
  -- Blocks already authored in this section keep their position after the
  -- migrated legacy text.
  LEFT JOIN LATERAL (
    SELECT s->'blocks' AS "blocks"
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(x."contentJson"->'sections') = 'array'
           THEN x."contentJson"->'sections'
           ELSE '[]'::jsonb END
    ) AS s
    WHERE s->>'key' = m."key"
    LIMIT 1
  ) AS ex ON TRUE
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object(
      'key', m."key",
      'title', m."title",
      'blocks',
        CASE
          WHEN NULLIF(btrim(COALESCE(m."text", '')), '') IS NOT NULL THEN
            jsonb_build_array(
              jsonb_build_object(
                'id', m."key" || '-legacy',
                'type', 'text',
                'text', btrim(m."text")
              )
            )
            || (CASE WHEN jsonb_typeof(ex."blocks") = 'array' THEN ex."blocks" ELSE '[]'::jsonb END)
          ELSE
            (CASE WHEN jsonb_typeof(ex."blocks") = 'array' THEN ex."blocks" ELSE '[]'::jsonb END)
        END
    ) AS "section"
  ) AS b
  GROUP BY x."id"
) AS sub
WHERE e."id" = sub."id";

-- Seed the derived search mirror from the freshly folded document.
UPDATE "Experiment" AS e
SET "searchText" = NULLIF(
  btrim(
    concat_ws(
      E'\n',
      NULLIF(btrim(COALESCE(e."purpose", '')), ''),
      (
        SELECT string_agg(btrim(bl->>'text'), E'\n')
        FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(e."contentJson"->'sections') = 'array'
                    THEN e."contentJson"->'sections'
                    ELSE '[]'::jsonb END
             ) AS s,
             LATERAL jsonb_array_elements(
               CASE WHEN jsonb_typeof(s->'blocks') = 'array'
                    THEN s->'blocks'
                    ELSE '[]'::jsonb END
             ) AS bl
        WHERE NULLIF(btrim(COALESCE(bl->>'text', '')), '') IS NOT NULL
      )
    )
  ),
  ''
);

ALTER TABLE "Experiment"
  DROP COLUMN "background",
  DROP COLUMN "materialsText",
  DROP COLUMN "stepsText",
  DROP COLUMN "observations",
  DROP COLUMN "resultSummary",
  DROP COLUMN "conclusion",
  DROP COLUMN "deviations";
