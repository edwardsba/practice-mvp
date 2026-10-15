-- Clinician background interview. Field values stay on client background.
-- self_report_id is reserved for a future client self-report and has no foreign key yet.
CREATE TABLE IF NOT EXISTS client_background_interviews (
  client_background_interview_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  practitioner_profile_id uuid NOT NULL REFERENCES practitioner_profiles(practitioner_profile_id),
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  screening_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_json jsonb,
  self_report_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS client_background_interviews_client_id_idx
  ON client_background_interviews (client_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS client_background_interviews_one_in_progress
  ON client_background_interviews (client_id)
  WHERE status = 'in_progress';
