ALTER TABLE assessment_options
  ADD COLUMN IF NOT EXISTS is_default_selection boolean NOT NULL DEFAULT false;
