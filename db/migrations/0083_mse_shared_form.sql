-- Round AH: reshape MSE template elements for the shared form.
-- Safe for Production while legacy MSE pages still run on the same DB.
-- Only touches mse definition template elements (assessment_instance_id IS NULL)
-- and their options. Does not change responses or instances.

BEGIN;

-- 1. Five sections: promote Mental Function subgroups to top-level groups,
--    then clear all subgroup labels. Final order by display_order:
--    Presentation, Perceptions, Thoughts, Cognitions, Discernment.

UPDATE assessment_elements e
SET group_label = e.subgroup_label
FROM assessment_definitions d
WHERE e.assessment_definition_id = d.assessment_definition_id
  AND d.assessment_code = 'mse'
  AND e.assessment_instance_id IS NULL
  AND e.subgroup_label IS NOT NULL;

UPDATE assessment_elements e
SET subgroup_label = NULL
FROM assessment_definitions d
WHERE e.assessment_definition_id = d.assessment_definition_id
  AND d.assessment_code = 'mse'
  AND e.assessment_instance_id IS NULL;

-- 2. Orientation options (mse_orientation): rename, revalue, reorder; delete object.

-- none → "Fully oriented" (value unchanged; default/baseline unchanged)
UPDATE assessment_options o
SET option_label = 'Fully oriented',
    display_order = 1
FROM assessment_elements e
JOIN assessment_definitions d
  ON d.assessment_definition_id = e.assessment_definition_id
WHERE o.assessment_element_id = e.assessment_element_id
  AND d.assessment_code = 'mse'
  AND e.element_key = 'mse_orientation'
  AND e.assessment_instance_id IS NULL
  AND o.option_value = 'none';

-- time → "Disoriented to time"
UPDATE assessment_options o
SET option_label = 'Disoriented to time',
    display_order = 2
FROM assessment_elements e
JOIN assessment_definitions d
  ON d.assessment_definition_id = e.assessment_definition_id
WHERE o.assessment_element_id = e.assessment_element_id
  AND d.assessment_code = 'mse'
  AND e.element_key = 'mse_orientation'
  AND e.assessment_instance_id IS NULL
  AND o.option_value = 'time';

-- place → value time_place, "Disoriented to time and place"
UPDATE assessment_options o
SET option_value = 'time_place',
    option_label = 'Disoriented to time and place',
    display_order = 3
FROM assessment_elements e
JOIN assessment_definitions d
  ON d.assessment_definition_id = e.assessment_definition_id
WHERE o.assessment_element_id = e.assessment_element_id
  AND d.assessment_code = 'mse'
  AND e.element_key = 'mse_orientation'
  AND e.assessment_instance_id IS NULL
  AND o.option_value = 'place';

-- person → value time_place_person, "Disoriented to time, place and person"
UPDATE assessment_options o
SET option_value = 'time_place_person',
    option_label = 'Disoriented to time, place and person',
    display_order = 4
FROM assessment_elements e
JOIN assessment_definitions d
  ON d.assessment_definition_id = e.assessment_definition_id
WHERE o.assessment_element_id = e.assessment_element_id
  AND d.assessment_code = 'mse'
  AND e.element_key = 'mse_orientation'
  AND e.assessment_instance_id IS NULL
  AND o.option_value = 'person';

-- Delete object only when zero responses use that value (expected: 0).
DELETE FROM assessment_options o
USING assessment_elements e, assessment_definitions d
WHERE o.assessment_element_id = e.assessment_element_id
  AND e.assessment_definition_id = d.assessment_definition_id
  AND d.assessment_code = 'mse'
  AND e.element_key = 'mse_orientation'
  AND e.assessment_instance_id IS NULL
  AND o.option_value = 'object'
  AND NOT EXISTS (
    SELECT 1
    FROM assessment_responses r
    WHERE r.assessment_element_id = o.assessment_element_id
      AND r.response_value = 'object'
  );

-- 3. Memory options (mse_memory): rename/reorder; insert short_long_term.

UPDATE assessment_options o
SET option_label = 'Intact',
    display_order = 1
FROM assessment_elements e
JOIN assessment_definitions d
  ON d.assessment_definition_id = e.assessment_definition_id
WHERE o.assessment_element_id = e.assessment_element_id
  AND d.assessment_code = 'mse'
  AND e.element_key = 'mse_memory'
  AND e.assessment_instance_id IS NULL
  AND o.option_value = 'none';

UPDATE assessment_options o
SET option_label = 'Short-term impaired',
    display_order = 2
FROM assessment_elements e
JOIN assessment_definitions d
  ON d.assessment_definition_id = e.assessment_definition_id
WHERE o.assessment_element_id = e.assessment_element_id
  AND d.assessment_code = 'mse'
  AND e.element_key = 'mse_memory'
  AND e.assessment_instance_id IS NULL
  AND o.option_value = 'short_term';

UPDATE assessment_options o
SET option_label = 'Long-term impaired',
    display_order = 3
FROM assessment_elements e
JOIN assessment_definitions d
  ON d.assessment_definition_id = e.assessment_definition_id
WHERE o.assessment_element_id = e.assessment_element_id
  AND d.assessment_code = 'mse'
  AND e.element_key = 'mse_memory'
  AND e.assessment_instance_id IS NULL
  AND o.option_value = 'long_term';

INSERT INTO assessment_options (
  assessment_element_id,
  assessment_definition_id,
  option_label,
  option_value,
  score_value,
  display_order,
  is_default_selection,
  is_reporting_baseline
)
SELECT
  e.assessment_element_id,
  e.assessment_definition_id,
  'Short- and long-term impaired',
  'short_long_term',
  0,
  4,
  false,
  false
FROM assessment_elements e
JOIN assessment_definitions d
  ON d.assessment_definition_id = e.assessment_definition_id
WHERE d.assessment_code = 'mse'
  AND e.element_key = 'mse_memory'
  AND e.assessment_instance_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM assessment_options existing
    WHERE existing.assessment_element_id = e.assessment_element_id
      AND existing.option_value = 'short_long_term'
  );

COMMIT;
