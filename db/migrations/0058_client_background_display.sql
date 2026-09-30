-- Health status replaces the deceased checkbox. Title is the history list label.
ALTER TABLE client_relationship_records
  ADD COLUMN IF NOT EXISTS health_status text;
--> statement-breakpoint
UPDATE client_relationship_records
SET health_status = 'deceased'
WHERE deceased = true
  AND (health_status IS NULL OR btrim(health_status) = '');
--> statement-breakpoint
ALTER TABLE client_event_records
  ADD COLUMN IF NOT EXISTS title text;
