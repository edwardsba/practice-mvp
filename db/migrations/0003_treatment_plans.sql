CREATE TABLE treatment_plans (
  treatment_plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  practitioner_profile_id uuid NOT NULL REFERENCES practitioner_profiles(practitioner_profile_id),
  version_number integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  start_date date,
  end_date date,
  therapeutic_target text,
  behavioural_targets_json jsonb,
  ongoing_assessments_json jsonb,
  risk_management_json jsonb,
  support_services_json jsonb,
  psychoeducation_json jsonb,
  case_formulation_json jsonb,
  alternate_responses_json jsonb,
  quality_of_life_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE treatment_plans ENABLE ROW LEVEL SECURITY;
