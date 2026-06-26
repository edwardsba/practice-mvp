ALTER TABLE simple_reports
  ADD COLUMN IF NOT EXISTS recipient_type text,
  ADD COLUMN IF NOT EXISTS funding_approval_id uuid;
