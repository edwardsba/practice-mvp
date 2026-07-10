ALTER TABLE simple_reports
  ADD COLUMN IF NOT EXISTS letter_body_json jsonb;
