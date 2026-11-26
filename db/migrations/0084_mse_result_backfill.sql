-- Round AH: insert assessment_results for mse instances that have none.
-- Values match the shared practitioner save (Part 4 noted-count rule):
--   status = 'scored' (column default)
--   score = NULL
--   severity = 'Within limits' | 'N noted'
--   structured_score_json = {"notedCount": N, "notedElementKeys": [...]}
--   assessment_date = COALESCE(submitted_at, created_at, now())
-- Idempotent: WHERE NOT EXISTS a result for that instance.
-- Insight/Judgement: only option_label 'Poor' counts as noted; Fair/Good do not.
-- Other elements: noted when the selected option is not the reporting baseline.

BEGIN;

INSERT INTO assessment_results (
  assessment_instance_id,
  client_id,
  practice_id,
  score,
  severity,
  structured_score_json,
  assessment_date,
  status
)
SELECT
  i.assessment_instance_id,
  i.client_id,
  i.practice_id,
  NULL,
  CASE
    WHEN COALESCE(noted.noted_count, 0) = 0 THEN 'Within limits'
    ELSE COALESCE(noted.noted_count, 0)::text || ' noted'
  END,
  jsonb_build_object(
    'notedCount', COALESCE(noted.noted_count, 0),
    'notedElementKeys', COALESCE(noted.noted_keys, '[]'::jsonb)
  ),
  COALESCE(i.submitted_at, i.created_at, now()),
  'scored'
FROM assessment_instances i
JOIN assessment_definitions d
  ON d.assessment_definition_id = i.assessment_definition_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int AS noted_count,
    COALESCE(
      jsonb_agg(e.element_key ORDER BY e.display_order),
      '[]'::jsonb
    ) AS noted_keys
  FROM assessment_responses r
  JOIN assessment_elements e
    ON e.assessment_element_id = r.assessment_element_id
  JOIN assessment_options o
    ON o.assessment_element_id = r.assessment_element_id
   AND o.option_value = r.response_value
  WHERE r.assessment_instance_id = i.assessment_instance_id
    AND (
      (
        e.element_key IN ('mse_insight', 'mse_judgement')
        AND o.option_label = 'Poor'
      )
      OR (
        e.element_key NOT IN ('mse_insight', 'mse_judgement')
        AND o.is_reporting_baseline = false
      )
    )
) noted ON true
WHERE d.assessment_code = 'mse'
  AND NOT EXISTS (
    SELECT 1
    FROM assessment_results ar
    WHERE ar.assessment_instance_id = i.assessment_instance_id
  );

COMMIT;
