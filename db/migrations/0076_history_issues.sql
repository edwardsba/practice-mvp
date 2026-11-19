-- Additive: history issues (condition groups as first-class rows), treatment
-- answers, parent_event_id for sub-events, and treatment → issue links.
-- Keep condition_event_id in place (main still reads it). Apply once.

CREATE TABLE IF NOT EXISTS client_history_issues (
  issue_id uuid PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(client_id),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  category text NOT NULL,
  about text NOT NULL,
  relationship_record_id uuid REFERENCES client_relationship_records(relationship_record_id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  treatment_answer text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE client_event_records
  ADD COLUMN IF NOT EXISTS parent_event_id uuid;
--> statement-breakpoint
-- One issue per existing condition_group_id (issue_id = condition_group_id).
-- Title, category, about and who come from the group's earliest episode.
INSERT INTO client_history_issues (
  issue_id,
  client_id,
  practice_id,
  category,
  about,
  relationship_record_id,
  title,
  treatment_answer,
  display_order,
  created_at,
  updated_at
)
SELECT
  g.condition_group_id,
  g.client_id,
  g.practice_id,
  g.event_type,
  COALESCE(NULLIF(g.about, ''), 'self'),
  g.relationship_record_id,
  COALESCE(NULLIF(trim(g.title), ''), CASE g.event_type
    WHEN 'emotional_problems' THEN 'Emotional problems'
    WHEN 'substance_use' THEN 'Substance use'
    WHEN 'illness_injury' THEN 'Illness / injury'
    ELSE g.event_type
  END),
  NULL,
  0,
  now(),
  now()
FROM (
  SELECT DISTINCT ON (e.condition_group_id)
    e.condition_group_id,
    e.client_id,
    e.practice_id,
    e.event_type,
    e.about,
    e.relationship_record_id,
    e.title,
    e.start_value,
    e.display_order
  FROM client_event_records e
  WHERE e.condition_group_id IS NOT NULL
    AND e.event_type IN ('emotional_problems', 'substance_use', 'illness_injury')
  ORDER BY
    e.condition_group_id,
    CASE WHEN e.start_value IS NULL OR trim(e.start_value) = '' THEN 1 ELSE 0 END,
    e.start_value ASC NULLS LAST,
    e.display_order ASC
) g
WHERE NOT EXISTS (
  SELECT 1 FROM client_history_issues i WHERE i.issue_id = g.condition_group_id
);
--> statement-breakpoint
-- Treatments inherit the linked episode's condition_group_id (issue).
UPDATE client_event_records t
SET condition_group_id = e.condition_group_id,
    updated_at = now()
FROM client_event_records e
WHERE t.condition_event_id = e.event_record_id
  AND t.event_type IN ('psychiatric_admission', 'previous_therapy', 'medication')
  AND t.condition_group_id IS NULL
  AND e.condition_group_id IS NOT NULL;
--> statement-breakpoint
-- treatment_answer: yes where the issue has treatments.
UPDATE client_history_issues i
SET treatment_answer = 'yes',
    updated_at = now()
WHERE i.treatment_answer IS NULL
  AND EXISTS (
    SELECT 1
    FROM client_event_records t
    WHERE t.condition_group_id = i.issue_id
      AND t.event_type IN ('psychiatric_admission', 'previous_therapy', 'medication')
  );
--> statement-breakpoint
-- Client issues with no treatments: none when all three old client treatment
-- questions were answered No; otherwise leave blank.
UPDATE client_history_issues i
SET treatment_answer = 'none',
    updated_at = now()
FROM (
  SELECT DISTINCT ON (cbi.client_id)
    cbi.client_id,
    cbi.screening_json
  FROM client_background_interviews cbi
  ORDER BY cbi.client_id, COALESCE(cbi.completed_at, cbi.started_at) DESC
) latest
WHERE i.client_id = latest.client_id
  AND i.about = 'self'
  AND i.treatment_answer IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM client_event_records t
    WHERE t.condition_group_id = i.issue_id
      AND t.event_type IN ('psychiatric_admission', 'previous_therapy', 'medication')
  )
  AND COALESCE(latest.screening_json->>'psychiatric_admission', '') = 'no'
  AND COALESCE(latest.screening_json->>'previous_therapy', '') = 'no'
  AND COALESCE(latest.screening_json->>'medication_history', '') = 'no';
--> statement-breakpoint
-- Family issues with no treatments: none when old family hospital-admission
-- answer was No; otherwise leave blank.
UPDATE client_history_issues i
SET treatment_answer = 'none',
    updated_at = now()
FROM (
  SELECT DISTINCT ON (cbi.client_id)
    cbi.client_id,
    cbi.screening_json
  FROM client_background_interviews cbi
  ORDER BY cbi.client_id, COALESCE(cbi.completed_at, cbi.started_at) DESC
) latest
WHERE i.client_id = latest.client_id
  AND i.about = 'significant_other'
  AND i.treatment_answer IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM client_event_records t
    WHERE t.condition_group_id = i.issue_id
      AND t.event_type IN ('psychiatric_admission', 'previous_therapy', 'medication')
  )
  AND COALESCE(latest.screening_json->>'family_psychiatric_admission', '') = 'no';
--> statement-breakpoint
-- Other treatment not linked to an issue: set Yes when any unlinked treatments exist.
UPDATE client_background_interviews cbi
SET screening_json = jsonb_set(
  COALESCE(cbi.screening_json, '{}'::jsonb),
  '{other_treatment}',
  '"yes"'::jsonb,
  true
),
updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM client_event_records t
  WHERE t.client_id = cbi.client_id
    AND t.practice_id = cbi.practice_id
    AND t.event_type IN ('psychiatric_admission', 'previous_therapy', 'medication')
    AND t.condition_group_id IS NULL
    AND t.condition_event_id IS NULL
    AND COALESCE(t.about, 'self') = 'self'
)
AND (
  cbi.screening_json->>'other_treatment' IS NULL
  OR cbi.screening_json->>'other_treatment' = ''
);
