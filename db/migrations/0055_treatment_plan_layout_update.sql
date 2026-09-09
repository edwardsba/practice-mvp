-- Treatment plan layout update (2026-09): new fields, renamed/reshaped fields, and
-- removal of columns replaced by the static Treatment Summary block. Existing rows
-- are test data only (confirmed with Ben) — no backfill/data migration needed.

ALTER TABLE treatment_plans
  ADD COLUMN IF NOT EXISTS diagnosis_report_date date,
  ADD COLUMN IF NOT EXISTS smart_goals_json jsonb,
  ADD COLUMN IF NOT EXISTS medication_supervision_json jsonb,
  ADD COLUMN IF NOT EXISTS treatment_model_json jsonb;

ALTER TABLE treatment_plans
  DROP COLUMN IF EXISTS behavioural_targets_json,
  DROP COLUMN IF EXISTS risk_management_json,
  DROP COLUMN IF EXISTS psychoeducation_json,
  DROP COLUMN IF EXISTS case_formulation_json,
  DROP COLUMN IF EXISTS alternate_responses_json,
  DROP COLUMN IF EXISTS quality_of_life_json;
