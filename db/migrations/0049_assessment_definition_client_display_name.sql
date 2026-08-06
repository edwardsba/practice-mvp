ALTER TABLE assessment_definitions
  ADD COLUMN IF NOT EXISTS client_display_name text;
