CREATE TABLE IF NOT EXISTS claim_types (
  claim_type_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  claim_type_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS funding_approval_types (
  funding_approval_type_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  name text NOT NULL,
  claim_type_id uuid REFERENCES claim_types(claim_type_id),
  duration_months integer,
  appointments_approved integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS funding_approval_type_reports (
  report_requirement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funding_approval_type_id uuid NOT NULL REFERENCES funding_approval_types(funding_approval_type_id),
  appointment_number integer NOT NULL,
  report_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claims (
  claim_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  claim_type_id uuid NOT NULL REFERENCES claim_types(claim_type_id),
  medicare_card_number text,
  insurance_organisation_id uuid REFERENCES professional_organisations(organisation_id),
  insurance_reference_number text,
  start_date text,
  end_date text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS funding_approvals (
  funding_approval_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  claim_id uuid REFERENCES claims(claim_id),
  funding_approval_type_id uuid REFERENCES funding_approval_types(funding_approval_type_id),
  referrer_id uuid REFERENCES professionals(professional_id),
  start_date text,
  end_date text,
  appointments_approved integer,
  approval_status text NOT NULL DEFAULT 'active',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS funding_approval_report_links (
  link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funding_approval_id uuid NOT NULL REFERENCES funding_approvals(funding_approval_id),
  appointment_number integer NOT NULL,
  report_type text NOT NULL,
  simple_report_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS funding_approval_id uuid;

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_funding_approval_id_funding_approvals_funding_approval_id_fk;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_funding_approval_id_funding_approvals_funding_approval_id_fk
  FOREIGN KEY (funding_approval_id)
  REFERENCES funding_approvals(funding_approval_id);
