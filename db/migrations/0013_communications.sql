CREATE TABLE IF NOT EXISTS communications (
  communication_id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  practitioner_profile_id uuid NOT NULL REFERENCES practitioner_profiles(practitioner_profile_id),
  template_type text NOT NULL,
  to_email text NOT NULL,
  cc_email text,
  bcc_email text,
  subject text NOT NULL,
  message_text text,
  assessment_access_link_id uuid REFERENCES assessment_access_links(assessment_access_link_id),
  sent_at timestamp with time zone DEFAULT now() NOT NULL,
  status text DEFAULT 'sent' NOT NULL,
  error_message text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
