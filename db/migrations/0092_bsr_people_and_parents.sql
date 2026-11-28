-- Round AY.3: BACKGROUND_SR people lists and parents questions.
-- CP-7 / FM-5: deathYear on parents and siblings; parents_together adapts when
-- a parent is marked Passed away; new bsr_parents_were_together.
-- Idempotent where practical. Do not run from the agent — Claude applies it.

BEGIN;

-- parents: Age, Passed away, death year, then relationship
UPDATE assessment_elements e
SET list_config_json = jsonb_set(
  COALESCE(e.list_config_json, '{}'::jsonb),
  '{fields}',
  '["firstName","age","passedAway","deathYear","relationship"]'::jsonb,
  true
)
FROM assessment_definitions d
WHERE e.assessment_definition_id = d.assessment_definition_id
  AND d.assessment_code = 'BACKGROUND_SR'
  AND e.element_key = 'parents'
  AND e.assessment_instance_id IS NULL;

-- siblings: same fields (Passed away was missing)
UPDATE assessment_elements e
SET list_config_json = jsonb_set(
  COALESCE(e.list_config_json, '{}'::jsonb),
  '{fields}',
  '["firstName","age","passedAway","deathYear","relationship"]'::jsonb,
  true
)
FROM assessment_definitions d
WHERE e.assessment_definition_id = d.assessment_definition_id
  AND d.assessment_code = 'BACKGROUND_SR'
  AND e.element_key = 'siblings'
  AND e.assessment_instance_id IS NULL;

-- Drop unused option (no responses)
DELETE FROM assessment_options o
USING assessment_elements e, assessment_definitions d
WHERE o.assessment_element_id = e.assessment_element_id
  AND e.assessment_definition_id = d.assessment_definition_id
  AND d.assessment_code = 'BACKGROUND_SR'
  AND e.element_key = 'parents_together'
  AND o.option_value = 'one_or_both_passed_away';

-- parents_together only when no parent is marked Passed away
UPDATE assessment_elements e
SET show_when_json = '{"key":"parents","list":{"none":{"passedAway":true}}}'::jsonb
FROM assessment_definitions d
WHERE e.assessment_definition_id = d.assessment_definition_id
  AND d.assessment_code = 'BACKGROUND_SR'
  AND e.element_key = 'parents_together'
  AND e.assessment_instance_id IS NULL;

-- New question when any parent is marked Passed away (between parents_together 280 and siblings 290)
INSERT INTO assessment_elements (
  assessment_definition_id,
  element_key,
  question_text,
  element_type,
  data_type,
  display_order,
  is_required,
  is_active,
  group_label,
  subgroup_label,
  parent_element_key,
  show_when_json,
  required_group_key,
  help_text,
  allow_in_person,
  list_config_json
)
SELECT
  d.assessment_definition_id,
  'bsr_parents_were_together',
  'Were your parents together?',
  'radio',
  'text',
  285,
  false,
  true,
  'The family you grew up with',
  NULL,
  NULL,
  '{"key":"parents","list":{"any":{"passedAway":true}}}'::jsonb,
  NULL,
  NULL,
  false,
  NULL
FROM assessment_definitions d
WHERE d.assessment_code = 'BACKGROUND_SR'
ON CONFLICT (element_key) DO UPDATE SET
  assessment_definition_id = EXCLUDED.assessment_definition_id,
  question_text = EXCLUDED.question_text,
  element_type = EXCLUDED.element_type,
  data_type = EXCLUDED.data_type,
  display_order = EXCLUDED.display_order,
  is_required = EXCLUDED.is_required,
  is_active = EXCLUDED.is_active,
  group_label = EXCLUDED.group_label,
  subgroup_label = EXCLUDED.subgroup_label,
  parent_element_key = EXCLUDED.parent_element_key,
  show_when_json = EXCLUDED.show_when_json,
  required_group_key = EXCLUDED.required_group_key,
  help_text = EXCLUDED.help_text,
  allow_in_person = EXCLUDED.allow_in_person,
  list_config_json = EXCLUDED.list_config_json;

INSERT INTO assessment_options (
  assessment_element_id,
  assessment_definition_id,
  option_label,
  option_value,
  score_value,
  display_order
)
SELECT
  e.assessment_element_id,
  d.assessment_definition_id,
  v.option_label,
  v.option_value,
  0,
  v.display_order
FROM assessment_elements e
JOIN assessment_definitions d
  ON d.assessment_definition_id = e.assessment_definition_id
JOIN (
  VALUES
    ('Together until one passed away', 'together_until_passed_away', 1),
    ('Separated or divorced', 'separated_or_divorced', 2),
    ('Never together', 'never_together', 3),
    ('Not sure', 'not_sure', 4)
) AS v(option_label, option_value, display_order)
  ON TRUE
WHERE e.element_key = 'bsr_parents_were_together'
  AND d.assessment_code = 'BACKGROUND_SR'
  AND NOT EXISTS (
    SELECT 1
    FROM assessment_options o
    WHERE o.assessment_element_id = e.assessment_element_id
      AND o.option_value = v.option_value
  );

-- Re-number remaining parents_together options after removing one_or_both_passed_away
UPDATE assessment_options o
SET display_order = v.display_order
FROM assessment_elements e
JOIN assessment_definitions d
  ON d.assessment_definition_id = e.assessment_definition_id
JOIN (
  VALUES
    ('yes_still_together', 1),
    ('separated_or_divorced', 2),
    ('never_together', 3),
    ('not_sure', 4)
) AS v(option_value, display_order)
  ON TRUE
WHERE o.assessment_element_id = e.assessment_element_id
  AND e.element_key = 'parents_together'
  AND d.assessment_code = 'BACKGROUND_SR'
  AND o.option_value = v.option_value;

COMMIT;
