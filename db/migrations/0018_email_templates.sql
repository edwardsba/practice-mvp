CREATE TABLE IF NOT EXISTS email_templates (
  email_template_id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  template_key text,
  name text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  default_cc text,
  default_bcc text,
  has_action_button boolean DEFAULT false NOT NULL,
  action_button_label text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
