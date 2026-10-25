-- Medication and stressors on the living client background, plus label rewrites
-- for housing type and free-text pronouns.
ALTER TABLE client_backgrounds
  ADD COLUMN IF NOT EXISTS medication_json jsonb;
--> statement-breakpoint
ALTER TABLE client_backgrounds
  ADD COLUMN IF NOT EXISTS stressors_json jsonb;
--> statement-breakpoint
WITH updated AS (
  UPDATE client_backgrounds
  SET living_situation_json = jsonb_set(
    living_situation_json,
    '{housingType}',
    to_jsonb(
      CASE living_situation_json->>'housingType'
        WHEN 'Owner-occupied' THEN 'Own home'
        WHEN 'Social / community housing' THEN 'Social or community housing'
        WHEN 'Living with family' THEN 'Parent''s home'
        WHEN 'Temporary / unstable' THEN 'Temporary housing'
        ELSE living_situation_json->>'housingType'
      END
    )
  )
  WHERE living_situation_json->>'housingType' IN (
    'Owner-occupied',
    'Social / community housing',
    'Living with family',
    'Temporary / unstable'
  )
  RETURNING 1
)
SELECT count(*)::int AS housing_rewritten FROM updated;
--> statement-breakpoint
WITH updated AS (
  UPDATE client_backgrounds
  SET identity_json = jsonb_set(
    CASE
      WHEN identity_json->>'pronouns' = 'Other'
      THEN jsonb_set(
        identity_json,
        '{pronouns}',
        to_jsonb(COALESCE(identity_json->>'pronounsOther', ''))
      )
      ELSE identity_json
    END,
    '{pronounsOther}',
    '""'::jsonb
  )
  WHERE identity_json IS NOT NULL
    AND jsonb_typeof(identity_json) = 'object'
    AND (
      identity_json->>'pronouns' = 'Other'
      OR COALESCE(identity_json->>'pronounsOther', '') <> ''
    )
  RETURNING 1
)
SELECT count(*)::int AS pronouns_rewritten FROM updated;
