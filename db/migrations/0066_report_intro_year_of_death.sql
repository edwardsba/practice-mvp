ALTER TABLE practitioner_profiles
  ADD COLUMN IF NOT EXISTS report_introduction text;
--> statement-breakpoint
ALTER TABLE client_relationship_records
  ADD COLUMN IF NOT EXISTS date_of_death text;
