-- Date of birth replaces a static age. Sex replaces free-text gender.
-- History drops severity and the extra self-harm flags.
ALTER TABLE client_relationship_records
  ADD COLUMN IF NOT EXISTS date_of_birth text,
  ADD COLUMN IF NOT EXISTS approximate_age integer,
  ADD COLUMN IF NOT EXISTS approximate_age_recorded_on text,
  ADD COLUMN IF NOT EXISTS sex text;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_relationship_records'
      AND column_name = 'age'
  ) THEN
    UPDATE client_relationship_records
    SET
      approximate_age = age,
      approximate_age_recorded_on = to_char(updated_at AT TIME ZONE 'Australia/Sydney', 'YYYY-MM-DD')
    WHERE age IS NOT NULL
      AND approximate_age IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_relationship_records'
      AND column_name = 'gender'
  ) THEN
    UPDATE client_relationship_records
    SET sex = CASE lower(btrim(gender))
      WHEN 'female' THEN 'Female'
      WHEN 'f' THEN 'Female'
      WHEN 'male' THEN 'Male'
      WHEN 'm' THEN 'Male'
      WHEN 'another term' THEN 'Another term'
      WHEN 'other' THEN 'Another term'
      WHEN 'prefer not to say' THEN 'Prefer not to say'
      ELSE NULL
    END
    WHERE sex IS NULL
      AND gender IS NOT NULL
      AND btrim(gender) <> '';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE client_relationship_records
  DROP COLUMN IF EXISTS age,
  DROP COLUMN IF EXISTS gender;
--> statement-breakpoint
ALTER TABLE client_event_records
  DROP COLUMN IF EXISTS severity_impact,
  DROP COLUMN IF EXISTS substance_involvement,
  DROP COLUMN IF EXISTS required_medical_attention,
  DROP COLUMN IF EXISTS required_hospitalisation;
