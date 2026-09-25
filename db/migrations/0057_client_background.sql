-- Replace the versioned diagnostic intake document with living client background.
-- Test data only existed on this branch; nothing is copied forward.
DROP TABLE IF EXISTS intake_event_records;
--> statement-breakpoint
DROP TABLE IF EXISTS intake_relationship_records;
--> statement-breakpoint
DROP TABLE IF EXISTS intake_interviews;
--> statement-breakpoint
ALTER TABLE clients ADD COLUMN IF NOT EXISTS background_captured_at timestamptz;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS client_backgrounds (
  client_background_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES clients(client_id),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  identity_json jsonb,
  living_situation_json jsonb,
  education_json jsonb,
  occupation_json jsonb,
  risk_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS client_backgrounds_practice_id_idx
  ON client_backgrounds (practice_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS client_relationship_records (
  relationship_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  relationship_to_client text NOT NULL,
  gender text,
  given_name text,
  display_order integer NOT NULL DEFAULT 0,
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
  linked_partner_record_id uuid,
  partnership_record_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS client_relationship_records_client_id_idx
  ON client_relationship_records (client_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS client_partnership_records (
  partnership_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  partner_a_id uuid NOT NULL REFERENCES client_relationship_records(relationship_record_id) ON DELETE CASCADE,
  partner_b_id uuid NOT NULL REFERENCES client_relationship_records(relationship_record_id) ON DELETE CASCADE,
  relationship_status text,
  started text,
  ended text,
  quality_of_relationship text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS client_partnership_records_client_id_idx
  ON client_partnership_records (client_id);
--> statement-breakpoint
ALTER TABLE client_relationship_records
  DROP CONSTRAINT IF EXISTS client_relationship_records_linked_partner_fk;
--> statement-breakpoint
ALTER TABLE client_relationship_records
  ADD CONSTRAINT client_relationship_records_linked_partner_fk
  FOREIGN KEY (linked_partner_record_id)
  REFERENCES client_relationship_records(relationship_record_id)
  ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE client_relationship_records
  DROP CONSTRAINT IF EXISTS client_relationship_records_partnership_fk;
--> statement-breakpoint
ALTER TABLE client_relationship_records
  ADD CONSTRAINT client_relationship_records_partnership_fk
  FOREIGN KEY (partnership_record_id)
  REFERENCES client_partnership_records(partnership_record_id)
  ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS client_event_records (
  event_record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  event_type text NOT NULL,
  description text,
  start_precision text,
  start_value text,
  end_precision text,
  end_value text,
  end_ongoing boolean NOT NULL DEFAULT false,
  resolved_or_ongoing text,
  severity_impact text,
  treated boolean,
  treatment_type text,
  treatment_detail text,
  outcome text,
  attribution text NOT NULL DEFAULT 'self',
  family_relation text,
  family_side text,
  relationship_record_id uuid REFERENCES client_relationship_records(relationship_record_id) ON DELETE SET NULL,
  self_harm_type text,
  substance_involvement boolean,
  required_medical_attention boolean,
  required_hospitalisation boolean,
  substance_status text,
  abstinent_since_precision text,
  abstinent_since_value text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS client_event_records_client_id_idx
  ON client_event_records (client_id);
