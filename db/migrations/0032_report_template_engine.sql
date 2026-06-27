ALTER TABLE report_types
  ADD COLUMN IF NOT EXISTS template_key TEXT NOT NULL DEFAULT 'progress_report';

ALTER TABLE simple_reports
  ADD COLUMN IF NOT EXISTS report_type_id UUID;
