ALTER TABLE client_relationship_records
  ADD COLUMN IF NOT EXISTS how_ended text,
  ADD COLUMN IF NOT EXISTS later_relationships text,
  ADD COLUMN IF NOT EXISTS child_type text,
  ADD COLUMN IF NOT EXISTS child_type_detail text;
--> statement-breakpoint
ALTER TABLE client_event_records
  ADD COLUMN IF NOT EXISTS about text,
  ADD COLUMN IF NOT EXISTS about_other text;
--> statement-breakpoint
UPDATE client_relationship_records
SET how_ended = CASE
  WHEN relationship_status ~* 'separat' THEN 'separated'
  WHEN relationship_status ~* 'divorc' THEN 'divorced'
  WHEN relationship_status ~* 'widow|died|death' THEN 'partner_died'
  ELSE 'other'
END
WHERE relationship_to_client = 'prior_partner'
  AND how_ended IS NULL
  AND relationship_status IS NOT NULL
  AND btrim(relationship_status) <> '';
--> statement-breakpoint
UPDATE client_relationship_records
SET later_relationships = 'not_asked'
WHERE relationship_to_client IN ('mother', 'father', 'parent')
  AND later_relationships IS NULL;
--> statement-breakpoint
UPDATE client_relationship_records AS parent
SET later_relationships = 'yes'
WHERE parent.relationship_to_client IN ('mother', 'father', 'parent')
  AND parent.later_relationships IS DISTINCT FROM 'none'
  AND parent.later_relationships IS DISTINCT FROM 'yes'
  AND EXISTS (
    SELECT 1
    FROM client_partnership_records AS partnership
    JOIN client_relationship_records AS other
      ON other.relationship_record_id = CASE
        WHEN partnership.partner_a_id = parent.relationship_record_id THEN partnership.partner_b_id
        ELSE partnership.partner_a_id
      END
    WHERE (partnership.partner_a_id = parent.relationship_record_id
        OR partnership.partner_b_id = parent.relationship_record_id)
      AND other.relationship_to_client = 'step_parent'
  );
--> statement-breakpoint
UPDATE client_relationship_records
SET child_type = 'step_child'
WHERE relationship_to_client = 'child_step'
  AND child_type IS NULL;
--> statement-breakpoint
UPDATE client_relationship_records
SET child_type = 'biological'
WHERE relationship_to_client = 'child_biological'
  AND child_type IS NULL;
--> statement-breakpoint
UPDATE client_event_records
SET about = CASE
  WHEN attribution = 'self' THEN 'self'
  ELSE 'significant_other'
END
WHERE about IS NULL;
--> statement-breakpoint
UPDATE client_event_records
SET about_other = NULLIF(btrim(family_relation), '')
WHERE about = 'significant_other'
  AND relationship_record_id IS NULL
  AND family_relation IS NOT NULL
  AND btrim(family_relation) <> ''
  AND (about_other IS NULL OR btrim(about_other) = '');
--> statement-breakpoint
UPDATE client_event_records
SET event_type = 'emotional_problems'
WHERE event_type = 'family_events';
