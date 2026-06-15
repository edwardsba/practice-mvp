ALTER TABLE assessment_instances ADD COLUMN IF NOT EXISTS appointment_id uuid;
ALTER TABLE assessment_instances ADD COLUMN IF NOT EXISTS session_note_id uuid;
