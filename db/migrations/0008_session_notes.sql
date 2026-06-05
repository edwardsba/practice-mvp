CREATE TABLE session_notes (
  session_note_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  practitioner_profile_id uuid NOT NULL REFERENCES practitioner_profiles(practitioner_profile_id),
  appointment_id uuid REFERENCES appointments(appointment_id),
  battery_instance_id uuid REFERENCES battery_instances(battery_instance_id),
  session_date date NOT NULL,
  session_time time,
  practitioner_notes text,
  status text NOT NULL DEFAULT 'draft',
  finalised_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE session_notes ENABLE ROW LEVEL SECURITY;
