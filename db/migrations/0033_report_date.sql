ALTER TABLE simple_reports
  ADD COLUMN IF NOT EXISTS report_date DATE;

-- Backfill existing rows: use date_range_end where present, else created_at date.
UPDATE simple_reports
SET report_date = COALESCE(date_range_end, created_at::date)
WHERE report_date IS NULL;
