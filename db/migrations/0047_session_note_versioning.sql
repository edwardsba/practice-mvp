ALTER TABLE session_notes
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_current_version boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS previous_version_id uuid REFERENCES session_notes(session_note_id);
