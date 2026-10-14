-- Client's current relationship status, and supportive / conflict ratings on each relationship.
ALTER TABLE client_backgrounds
  ADD COLUMN IF NOT EXISTS relationship_status text;
--> statement-breakpoint
ALTER TABLE client_backgrounds
  ADD COLUMN IF NOT EXISTS relationship_status_other text;
--> statement-breakpoint
ALTER TABLE client_relationship_records
  ADD COLUMN IF NOT EXISTS supportive text;
--> statement-breakpoint
ALTER TABLE client_relationship_records
  ADD COLUMN IF NOT EXISTS conflict text;
