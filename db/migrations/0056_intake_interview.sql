CREATE TABLE IF NOT EXISTS intake_interviews (
  intake_interview_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  practitioner_profile_id uuid NOT NULL REFERENCES practitioner_profiles(practitioner_profile_id),
  interview_date date,
  status text NOT NULL DEFAULT 'draft',
  version_number integer NOT NULL DEFAULT 1,
  is_current_version boolean NOT NULL DEFAULT true,
  previous_version_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  identity_json jsonb,
  family_of_origin_roster_json jsonb,
  partners_children_roster_json jsonb,
  family_of_origin_summary text,
  partners_children_summary text,
  family_history_json jsonb,
  living_situation_json jsonb,
  education_json jsonb,
  occupation_json jsonb,
  financial_situation_json jsonb,
  social_support_json jsonb,
  finalised_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS intake_interviews_client_id_idx
  ON intake_interviews (client_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS intake_interviews_client_current_idx
  ON intake_interviews (client_id, is_current_version);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS intake_relationship_records (
  relationship_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_interview_id uuid NOT NULL REFERENCES intake_interviews(intake_interview_id),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  section text NOT NULL,
  roster_key text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  relationship_to_client text NOT NULL,
  given_name text,
  linked_partner_record_id uuid,
  age integer,
  deceased boolean NOT NULL DEFAULT false,
  age_at_death integer,
  health_or_cause_of_death text,
  length_of_relationship text,
  relationship_status text,
  time_since_ended text,
  quality_of_relationship text,
  dependency text,
  living_situation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS intake_relationship_records_interview_idx
  ON intake_relationship_records (intake_interview_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS intake_event_records (
  event_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_interview_id uuid NOT NULL REFERENCES intake_interviews(intake_interview_id),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  event_category text NOT NULL,
  sub_domain text NOT NULL,
  person_kind text NOT NULL,
  relationship_record_id uuid,
  endorsed boolean NOT NULL DEFAULT false,
  reason_description text,
  age_date_start text,
  age_date_end text,
  resolved_or_ongoing text,
  severity_impact text,
  treated boolean,
  treatment_type text,
  treatment_detail text,
  outcome text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS intake_event_records_interview_idx
  ON intake_event_records (intake_interview_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS intake_event_records_relationship_idx
  ON intake_event_records (relationship_record_id);
