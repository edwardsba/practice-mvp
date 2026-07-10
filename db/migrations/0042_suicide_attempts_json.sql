ALTER TABLE treatment_plans
  ADD COLUMN IF NOT EXISTS suicide_attempts_json jsonb;
