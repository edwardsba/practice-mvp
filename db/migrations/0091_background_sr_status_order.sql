-- Round AY.2: reorder BACKGROUND_SR relationship_status options.
-- Dating moves from display_order 4 → 2; the next two shift down one place.
-- display_order only — no add / rename / delete.

UPDATE assessment_options o
SET display_order = v.display_order
FROM assessment_elements e
JOIN assessment_definitions d
  ON d.assessment_definition_id = e.assessment_definition_id
JOIN (
  VALUES
    ('single', 1),
    ('dating', 2),
    ('in_relationship_not_living_together', 3),
    ('engaged', 4),
    ('defacto', 5),
    ('married', 6),
    ('separated', 7),
    ('divorced', 8),
    ('widowed', 9),
    ('other', 10)
) AS v(option_value, display_order)
  ON TRUE
WHERE o.assessment_element_id = e.assessment_element_id
  AND e.element_key = 'relationship_status'
  AND d.assessment_code = 'BACKGROUND_SR'
  AND o.option_value = v.option_value;
