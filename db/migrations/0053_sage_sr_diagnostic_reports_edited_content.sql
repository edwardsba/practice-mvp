ALTER TABLE sage_sr_diagnostic_reports
  ADD COLUMN IF NOT EXISTS edited_content_json jsonb;
