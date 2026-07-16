ALTER TABLE assessment_options
  ADD COLUMN IF NOT EXISTS is_reporting_baseline boolean NOT NULL DEFAULT false;
