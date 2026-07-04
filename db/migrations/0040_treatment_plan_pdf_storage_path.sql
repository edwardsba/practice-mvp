ALTER TABLE treatment_plans
  ADD COLUMN IF NOT EXISTS pdf_storage_path text;
