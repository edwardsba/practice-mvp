-- Round AM: backfill living_situation_json.household from legacy livesWith.
-- Does not remove livesWith (later round). No new columns.

UPDATE client_backgrounds
SET living_situation_json = jsonb_set(
  COALESCE(living_situation_json, '{}'::jsonb),
  '{household}',
  to_jsonb(
    CASE
      WHEN living_situation_json->>'livesWith' = 'alone' THEN 'alone'
      WHEN living_situation_json->>'livesWith' = 'no_fixed_address' THEN 'no_fixed_address'
      WHEN COALESCE(living_situation_json->>'livesWith', '') <> '' THEN 'with_others'
      ELSE NULL
    END
  ),
  true
)
WHERE living_situation_json IS NOT NULL
  AND (
    living_situation_json->>'household' IS NULL
    OR living_situation_json->>'household' = ''
  )
  AND COALESCE(living_situation_json->>'livesWith', '') <> '';

-- Ensure othersInHome is an array when missing on rows that already have living JSON.
UPDATE client_backgrounds
SET living_situation_json = jsonb_set(
  living_situation_json,
  '{othersInHome}',
  '[]'::jsonb,
  true
)
WHERE living_situation_json IS NOT NULL
  AND living_situation_json->'othersInHome' IS NULL;
