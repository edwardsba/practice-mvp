-- Episodes of one condition share condition_group_id. Older builds ignore the column.
ALTER TABLE client_event_records
  ADD COLUMN IF NOT EXISTS condition_group_id uuid;
--> statement-breakpoint
