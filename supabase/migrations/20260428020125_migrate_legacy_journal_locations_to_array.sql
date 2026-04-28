-- Convert legacy journal_entries.location shapes to `{ locations: [...] }`.
-- Handles legacy string, object, and array values.

UPDATE journal_entries
SET location = CASE
  WHEN location IS NULL THEN NULL
  WHEN jsonb_typeof(location) = 'object' AND location ? 'locations' THEN
    jsonb_build_object(
      'locations',
      COALESCE(
        (
          SELECT jsonb_agg(loc)
          FROM (
            SELECT
              CASE
                WHEN jsonb_typeof(item) = 'object' THEN item
                WHEN jsonb_typeof(item) = 'string' THEN
                  jsonb_build_object(
                    'displayName',
                    NULLIF(trim(BOTH '"' FROM item::text), '')
                  )
                ELSE NULL
              END AS loc
            FROM jsonb_array_elements(location->'locations') AS item
          ) normalized
          WHERE loc IS NOT NULL
            AND COALESCE(loc->>'displayName', '') <> ''
        ),
        '[]'::jsonb
      )
    )
  WHEN jsonb_typeof(location) = 'object' THEN
    CASE
      WHEN COALESCE(location->>'displayName', location->>'name', location->>'label', location->>'city', location->>'state', location->>'country', '') = ''
        THEN NULL
      ELSE jsonb_build_object('locations', jsonb_build_array(location - 'transitionTimes'))
    END
  WHEN jsonb_typeof(location) = 'array' THEN
    jsonb_build_object(
      'locations',
      COALESCE(
        (
          SELECT jsonb_agg(loc)
          FROM (
            SELECT
              CASE
                WHEN jsonb_typeof(item) = 'object' THEN item
                WHEN jsonb_typeof(item) = 'string' THEN
                  jsonb_build_object(
                    'displayName',
                    NULLIF(trim(BOTH '"' FROM item::text), '')
                  )
                ELSE NULL
              END AS loc
            FROM jsonb_array_elements(location) AS item
          ) normalized
          WHERE loc IS NOT NULL
            AND COALESCE(loc->>'displayName', '') <> ''
        ),
        '[]'::jsonb
      )
    )
  WHEN jsonb_typeof(location) = 'string' THEN
    CASE
      WHEN NULLIF(trim(BOTH '"' FROM location::text), '') IS NULL THEN NULL
      ELSE jsonb_build_object(
        'locations',
        jsonb_build_array(
          jsonb_build_object(
            'displayName',
            trim(BOTH '"' FROM location::text)
          )
        )
      )
    END
  ELSE NULL
END
WHERE location IS NOT NULL;
