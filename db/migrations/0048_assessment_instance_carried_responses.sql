ALTER TABLE assessment_instances
  ADD COLUMN IF NOT EXISTS carried_responses_json jsonb;
