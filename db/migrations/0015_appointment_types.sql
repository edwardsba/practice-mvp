CREATE TABLE IF NOT EXISTS appointment_types (
  appointment_type_id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  nickname text NOT NULL,
  name text NOT NULL,
  reference_number text,
  claim_type_id uuid REFERENCES claim_types(claim_type_id),
  membership_id uuid REFERENCES practitioner_practice_memberships(membership_id),
  duration_minutes integer DEFAULT 50 NOT NULL,
  status text DEFAULT 'active' NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS appointment_type_fees (
  fee_id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  appointment_type_id uuid NOT NULL REFERENCES appointment_types(appointment_type_id),
  fee numeric(10, 2) NOT NULL,
  tax numeric(10, 2) DEFAULT '0' NOT NULL,
  total numeric(10, 2) NOT NULL,
  start_date text NOT NULL,
  end_date text,
  status text DEFAULT 'active' NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
