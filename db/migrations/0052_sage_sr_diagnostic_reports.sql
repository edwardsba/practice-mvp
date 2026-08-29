CREATE TABLE IF NOT EXISTS sage_sr_diagnostic_reports (
  sage_sr_diagnostic_report_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  practitioner_profile_id uuid NOT NULL REFERENCES practitioner_profiles(practitioner_profile_id),
  report_date date,
  selected_instances_json jsonb NOT NULL,
  generated_content_json jsonb,
  report_status text NOT NULL DEFAULT 'draft',
  version_number integer NOT NULL DEFAULT 1,
  is_current_version boolean NOT NULL DEFAULT true,
  previous_version_id uuid,
  pdf_storage_path text,
  finalised_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sage_sr_diagnostic_reports_client_id_idx
  ON sage_sr_diagnostic_reports (client_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sage_sr_diagnostic_reports_client_current_idx
  ON sage_sr_diagnostic_reports (client_id, is_current_version);
