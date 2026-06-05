CREATE TABLE client_emergency_contacts (
  contact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  role text,
  name text NOT NULL,
  phone text,
  email text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE TABLE crisis_plans (
  crisis_plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  practitioner_profile_id uuid NOT NULL REFERENCES practitioner_profiles(practitioner_profile_id),
  version_number integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  date_of_plan date NOT NULL,
  emergency_numbers_json jsonb,
  doing_well_json jsonb,
  stay_well_json jsonb,
  becoming_unwell_json jsonb,
  get_better_json jsonb,
  unwell_json jsonb,
  crisis_response_json jsonb,
  pdf_storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crisis_plans ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public)
VALUES ('crisis-plans', 'crisis-plans', false)
ON CONFLICT (id) DO NOTHING;
