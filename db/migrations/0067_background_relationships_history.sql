ALTER TABLE client_relationship_records
  ADD COLUMN IF NOT EXISTS caregiver_relationship_detail text,
  ADD COLUMN IF NOT EXISTS started_on text,
  ADD COLUMN IF NOT EXISTS ended_on text,
  ADD COLUMN IF NOT EXISTS partner_type text,
  ADD COLUMN IF NOT EXISTS parent_type text,
  ADD COLUMN IF NOT EXISTS adopted_on text,
  ADD COLUMN IF NOT EXISTS not_known boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS other_parent_kind text,
  ADD COLUMN IF NOT EXISTS other_parent_detail text;
--> statement-breakpoint
ALTER TABLE client_event_records
  ADD COLUMN IF NOT EXISTS condition_event_id uuid,
  ADD COLUMN IF NOT EXISTS admission_type text,
  ADD COLUMN IF NOT EXISTS facility text,
  ADD COLUMN IF NOT EXISTS admission_length text,
  ADD COLUMN IF NOT EXISTS prescriber_professional_id uuid,
  ADD COLUMN IF NOT EXISTS prescriber_name text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_event_records_condition_event_id_fkey'
  ) THEN
    ALTER TABLE client_event_records
      ADD CONSTRAINT client_event_records_condition_event_id_fkey
      FOREIGN KEY (condition_event_id) REFERENCES client_event_records (event_record_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_event_records_prescriber_professional_id_fkey'
  ) THEN
    ALTER TABLE client_event_records
      ADD CONSTRAINT client_event_records_prescriber_professional_id_fkey
      FOREIGN KEY (prescriber_professional_id) REFERENCES professionals (professional_id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
UPDATE client_relationship_records AS record
SET
  caregiver_relationship_detail = CASE WHEN mapped.kind = 'other' THEN btrim(record.caregiver_relationship) ELSE NULL END,
  caregiver_relationship = mapped.kind
FROM (
  SELECT
    relationship_record_id,
    CASE
      WHEN btrim(caregiver_relationship) ~* '(grandparent|grandmother|grandfather|grandma|grandpa|nanna|\mnan\M|\mpop\M)' THEN 'grandparent'
      WHEN btrim(caregiver_relationship) ~* 'foster' THEN 'foster_carer'
      WHEN btrim(caregiver_relationship) ~* 'kinship' THEN 'kinship_carer'
      WHEN btrim(caregiver_relationship) ~* '(residential|out[- ]of[- ]home|\moohc\M)' THEN 'residential'
      WHEN btrim(caregiver_relationship) ~* '(family friend|\mfriend\M)' THEN 'family_friend'
      WHEN btrim(caregiver_relationship) ~* '(relative|aunt|uncle|cousin)' THEN 'other_relative'
      ELSE 'other'
    END AS kind
  FROM client_relationship_records
  WHERE relationship_to_client = 'other_caregiver'
    AND caregiver_relationship IS NOT NULL
    AND btrim(caregiver_relationship) <> ''
    AND caregiver_relationship NOT IN (
      'grandparent', 'other_relative', 'family_friend', 'foster_carer', 'kinship_carer', 'residential', 'other'
    )
) AS mapped
WHERE record.relationship_record_id = mapped.relationship_record_id;
--> statement-breakpoint
UPDATE client_relationship_records
SET parent_type = 'biological'
WHERE relationship_to_client IN ('mother', 'father', 'parent')
  AND parent_type IS NULL;
--> statement-breakpoint
INSERT INTO client_event_records (
  client_id,
  practice_id,
  event_type,
  title,
  end_ongoing,
  resolved_or_ongoing,
  attribution,
  prescriber_name,
  display_order
)
SELECT
  client_id,
  practice_id,
  'medication',
  'Medication',
  true,
  'ongoing',
  'self',
  NULLIF(btrim(medication_json->>'supervisedBy'), ''),
  0
FROM client_backgrounds
WHERE medication_json->>'currentlyTaking' = 'yes'
  AND NOT EXISTS (
    SELECT 1
    FROM client_event_records AS existing
    WHERE existing.client_id = client_backgrounds.client_id
      AND existing.event_type = 'medication'
      AND existing.title = 'Medication'
      AND existing.end_ongoing = true
  );
--> statement-breakpoint
UPDATE client_background_interviews AS interview
SET screening_json = COALESCE(interview.screening_json, '{}'::jsonb)
  || jsonb_build_object('medication_history', background.medication_json->>'previouslyTaken')
FROM client_backgrounds AS background
WHERE interview.client_id = background.client_id
  AND interview.practice_id = background.practice_id
  AND background.medication_json->>'previouslyTaken' IN ('yes', 'no', 'not_asked')
  AND NOT (COALESCE(interview.screening_json, '{}'::jsonb) ? 'medication_history');
