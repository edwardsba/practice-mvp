-- Additive: convert legacy Treated fields into Treatment events (other_event /
-- other_treatment are text event_type values — no enum change). Leave treated /
-- treatment_type / treatment_detail / outcome columns in place for main.
-- Apply once. Do not run from the agent; Claude applies after review.

--> statement-breakpoint
-- treated = true on a condition episode → Treatment event linked to the issue.
INSERT INTO client_event_records (
  event_record_id,
  client_id,
  practice_id,
  event_type,
  title,
  description,
  start_precision,
  start_value,
  end_precision,
  end_value,
  end_ongoing,
  resolved_or_ongoing,
  about,
  about_other,
  relationship_record_id,
  condition_group_id,
  parent_event_id,
  admission_type,
  facility,
  admission_length,
  display_order,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  e.client_id,
  e.practice_id,
  CASE
    WHEN lower(trim(COALESCE(e.treatment_type, ''))) IN ('hospital', 'hospital admission', 'admission')
      OR lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%hospital%'
      OR lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%admission%'
      THEN 'psychiatric_admission'
    WHEN lower(trim(COALESCE(e.treatment_type, ''))) IN ('psychology', 'therapy')
      OR lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%psychology%'
      OR lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%therapy%'
      THEN 'previous_therapy'
    ELSE 'other_treatment'
  END,
  CASE
    WHEN lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%psychology%' THEN 'psychologist'
    WHEN lower(trim(COALESCE(e.treatment_type, ''))) IN ('hospital', 'hospital admission', 'admission')
      OR lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%hospital%'
      OR lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%admission%'
      OR lower(trim(COALESCE(e.treatment_type, ''))) IN ('psychology', 'therapy')
      OR lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%therapy%'
      THEN ''
    ELSE COALESCE(NULLIF(trim(e.treatment_type), ''), 'Other treatment')
  END,
  NULLIF(
    trim(
      concat_ws(
        E'\n\n',
        NULLIF(trim(COALESCE(e.treatment_detail, '')), ''),
        NULLIF(trim(COALESCE(e.outcome, '')), '')
      )
    ),
    ''
  ),
  e.start_precision,
  e.start_value,
  NULL,
  NULL,
  false,
  NULL,
  COALESCE(e.about, 'self'),
  e.about_other,
  e.relationship_record_id,
  e.condition_group_id,
  NULL,
  CASE
    WHEN (
      lower(trim(COALESCE(e.treatment_type, ''))) IN ('hospital', 'hospital admission', 'admission')
      OR lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%hospital%'
      OR lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%admission%'
    )
    AND (
      lower(COALESCE(e.treatment_detail, '')) ~ '(^|[^a-z])(emergency|ed)([^a-z]|$)'
      OR lower(COALESCE(e.treatment_type, '')) ~ '(^|[^a-z])(emergency|ed)([^a-z]|$)'
    )
      THEN 'emergency_department'
    ELSE NULL
  END,
  NULL,
  NULL,
  e.display_order,
  now(),
  now()
FROM client_event_records e
WHERE e.treated = true
  AND e.event_type IN ('emotional_problems', 'substance_use', 'illness_injury')
  AND e.parent_event_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM client_event_records t
    WHERE t.client_id = e.client_id
      AND t.practice_id = e.practice_id
      AND t.event_type IN ('psychiatric_admission', 'previous_therapy', 'medication', 'other_treatment')
      AND t.condition_group_id IS NOT DISTINCT FROM e.condition_group_id
      AND t.start_value IS NOT DISTINCT FROM e.start_value
      AND coalesce(t.description, '') = coalesce(
        NULLIF(
          trim(
            concat_ws(
              E'\n\n',
              NULLIF(trim(COALESCE(e.treatment_detail, '')), ''),
              NULLIF(trim(COALESCE(e.outcome, '')), '')
            )
          ),
          ''
        ),
        ''
      )
  );
--> statement-breakpoint
-- treated = true on self-harm / traumatic / significant → Treatment under that event.
INSERT INTO client_event_records (
  event_record_id,
  client_id,
  practice_id,
  event_type,
  title,
  description,
  start_precision,
  start_value,
  end_precision,
  end_value,
  end_ongoing,
  resolved_or_ongoing,
  about,
  about_other,
  relationship_record_id,
  condition_group_id,
  parent_event_id,
  admission_type,
  facility,
  admission_length,
  display_order,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  e.client_id,
  e.practice_id,
  CASE
    WHEN lower(trim(COALESCE(e.treatment_type, ''))) IN ('hospital', 'hospital admission', 'admission')
      OR lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%hospital%'
      OR lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%admission%'
      THEN 'psychiatric_admission'
    WHEN lower(trim(COALESCE(e.treatment_type, ''))) IN ('psychology', 'therapy')
      OR lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%psychology%'
      OR lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%therapy%'
      THEN 'previous_therapy'
    ELSE 'other_treatment'
  END,
  CASE
    WHEN lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%psychology%' THEN 'psychologist'
    WHEN lower(trim(COALESCE(e.treatment_type, ''))) IN ('hospital', 'hospital admission', 'admission')
      OR lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%hospital%'
      OR lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%admission%'
      OR lower(trim(COALESCE(e.treatment_type, ''))) IN ('psychology', 'therapy')
      OR lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%therapy%'
      THEN ''
    ELSE COALESCE(NULLIF(trim(e.treatment_type), ''), 'Other treatment')
  END,
  NULLIF(
    trim(
      concat_ws(
        E'\n\n',
        NULLIF(trim(COALESCE(e.treatment_detail, '')), ''),
        NULLIF(trim(COALESCE(e.outcome, '')), '')
      )
    ),
    ''
  ),
  e.start_precision,
  e.start_value,
  NULL,
  NULL,
  false,
  NULL,
  COALESCE(e.about, 'self'),
  e.about_other,
  e.relationship_record_id,
  NULL,
  e.event_record_id,
  CASE
    WHEN (
      lower(trim(COALESCE(e.treatment_type, ''))) IN ('hospital', 'hospital admission', 'admission')
      OR lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%hospital%'
      OR lower(trim(COALESCE(e.treatment_type, ''))) LIKE '%admission%'
    )
    AND (
      lower(COALESCE(e.treatment_detail, '')) ~ '(^|[^a-z])(emergency|ed)([^a-z]|$)'
      OR lower(COALESCE(e.treatment_type, '')) ~ '(^|[^a-z])(emergency|ed)([^a-z]|$)'
    )
      THEN 'emergency_department'
    ELSE NULL
  END,
  NULL,
  NULL,
  e.display_order,
  now(),
  now()
FROM client_event_records e
WHERE e.treated = true
  AND e.event_type IN ('self_harm', 'traumatic_event', 'significant_history', 'family_events')
  AND e.parent_event_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM client_event_records t
    WHERE t.parent_event_id = e.event_record_id
      AND t.event_type IN ('psychiatric_admission', 'previous_therapy', 'medication', 'other_treatment')
  );
--> statement-breakpoint
-- Issues that gained a treatment from treated=true → treatment_answer = yes.
UPDATE client_history_issues i
SET treatment_answer = 'yes',
    updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM client_event_records t
  WHERE t.condition_group_id = i.issue_id
    AND t.event_type IN ('psychiatric_admission', 'previous_therapy', 'medication', 'other_treatment')
    AND t.parent_event_id IS NULL
)
AND (i.treatment_answer IS NULL OR i.treatment_answer = '' OR i.treatment_answer = 'not_asked' OR i.treatment_answer = 'none');
--> statement-breakpoint
-- treated = false on a condition → treatment_answer = none when the issue has no answer yet.
UPDATE client_history_issues i
SET treatment_answer = 'none',
    updated_at = now()
WHERE i.treatment_answer IS NULL
  AND EXISTS (
    SELECT 1
    FROM client_event_records e
    WHERE e.condition_group_id = i.issue_id
      AND e.event_type IN ('emotional_problems', 'substance_use', 'illness_injury')
      AND e.treated = false
      AND e.parent_event_id IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM client_event_records t
    WHERE t.condition_group_id = i.issue_id
      AND t.event_type IN ('psychiatric_admission', 'previous_therapy', 'medication', 'other_treatment')
      AND t.parent_event_id IS NULL
  );
