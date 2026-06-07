-- Practitioner profile & practice refactor (breaking change; test data only)

ALTER TABLE practices ADD COLUMN IF NOT EXISTS fax text;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS abn text;

ALTER TABLE practitioner_profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE practitioner_profiles ADD COLUMN IF NOT EXISTS preferred_name text;
ALTER TABLE practitioner_profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE practitioner_profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE practitioner_profiles ADD COLUMN IF NOT EXISTS email citext;
ALTER TABLE practitioner_profiles ADD COLUMN IF NOT EXISTS report_signature text;

UPDATE practitioner_profiles
SET
  first_name = COALESCE(NULLIF(first_name, ''), full_name, 'Unknown'),
  last_name = COALESCE(NULLIF(last_name, ''), 'Practitioner')
WHERE first_name IS NULL OR last_name IS NULL OR first_name = '' OR last_name = '';

ALTER TABLE practitioner_profiles ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE practitioner_profiles ALTER COLUMN last_name SET NOT NULL;

CREATE TABLE IF NOT EXISTS practitioner_practice_memberships (
  membership_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_profile_id uuid NOT NULL REFERENCES practitioner_profiles(practitioner_profile_id),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  medicare_provider_number text,
  role text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO practitioner_practice_memberships (
  practitioner_profile_id,
  practice_id,
  is_active,
  created_at,
  updated_at
)
SELECT
  practitioner_profile_id,
  practice_id,
  is_active,
  created_at,
  updated_at
FROM practitioner_profiles
WHERE practice_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM practitioner_practice_memberships ppm
    WHERE ppm.practitioner_profile_id = practitioner_profiles.practitioner_profile_id
      AND ppm.practice_id = practitioner_profiles.practice_id
  );

ALTER TABLE practitioner_profiles DROP CONSTRAINT IF EXISTS practitioner_profiles_practice_id_practices_practice_id_fk;
ALTER TABLE practitioner_profiles DROP CONSTRAINT IF EXISTS practitioner_profiles_practice_id_fkey;
ALTER TABLE practitioner_profiles DROP COLUMN IF EXISTS practice_id;
ALTER TABLE practitioner_profiles DROP COLUMN IF EXISTS full_name;

CREATE TABLE IF NOT EXISTS practitioner_availability_blocks (
  block_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES practitioner_practice_memberships(membership_id),
  day_of_week integer NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  mode text NOT NULL DEFAULT 'both',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'face_to_face';
