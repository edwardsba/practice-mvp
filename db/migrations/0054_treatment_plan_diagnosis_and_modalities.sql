ALTER TABLE treatment_plans
  ADD COLUMN IF NOT EXISTS diagnosis text,
  ADD COLUMN IF NOT EXISTS treatment_modalities_json jsonb;
