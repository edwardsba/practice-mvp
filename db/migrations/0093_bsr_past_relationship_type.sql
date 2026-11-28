-- Round AY.4: BACKGROUND_SR previous_relationships include relationship type.
-- CP-7 / past relationships: fields, labels, relationshipChoices, addButtonLabel.
-- No responses on this element. Claude applies — do not run from the agent.

UPDATE assessment_elements e
SET list_config_json = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(e.list_config_json, '{}'::jsonb),
        '{addButtonLabel}',
        '"+ Add a past relationship"'::jsonb,
        true
      ),
      '{fields}',
      '["firstName","relationship","fromYear","toYear","howEnded"]'::jsonb,
      true
    ),
    '{labels}',
    COALESCE(e.list_config_json->'labels', '{}'::jsonb) ||
      '{"relationship":"What kind of relationship was it?","fromYear":"From (year)","toYear":"To (year)","howEnded":"How did it end?"}'::jsonb,
    true
  ),
  '{relationshipChoices}',
  '[
    {"label":"Married","value":"married"},
    {"label":"De facto (lived together)","value":"defacto"},
    {"label":"Engaged","value":"engaged"},
    {"label":"Together, not living together","value":"in_relationship_not_living_together"},
    {"label":"Dating","value":"dating"},
    {"label":"Other","value":"other"}
  ]'::jsonb,
  true
)
FROM assessment_definitions d
WHERE e.assessment_definition_id = d.assessment_definition_id
  AND d.assessment_code = 'BACKGROUND_SR'
  AND e.element_key = 'previous_relationships'
  AND e.assessment_instance_id IS NULL;
