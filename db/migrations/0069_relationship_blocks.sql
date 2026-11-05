-- Additive relationship blocks. Old link columns stay in place.
ALTER TABLE client_backgrounds
  ADD COLUMN IF NOT EXISTS previous_relationships text,
  ADD COLUMN IF NOT EXISTS other_children text,
  ADD COLUMN IF NOT EXISTS mother_other_relationships text,
  ADD COLUMN IF NOT EXISTS father_other_relationships text,
  ADD COLUMN IF NOT EXISTS caregiver_arrangements text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS client_relationship_blocks (
  relationship_block_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  kind text NOT NULL,
  parent_record_id uuid,
  parent_side text,
  status text,
  status_detail text,
  arrangement_type text,
  arrangement_detail text,
  started_on text,
  ended_on text,
  no_children boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE client_relationship_records
  ADD COLUMN IF NOT EXISTS relationship_block_id uuid,
  ADD COLUMN IF NOT EXISTS block_role text,
  ADD COLUMN IF NOT EXISTS block_role_type text,
  ADD COLUMN IF NOT EXISTS placement_review text;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE client_relationship_records
    ADD CONSTRAINT client_relationship_records_block_fk
    FOREIGN KEY (relationship_block_id)
    REFERENCES client_relationship_blocks (relationship_block_id)
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE client_relationship_blocks
    ADD CONSTRAINT client_relationship_blocks_parent_fk
    FOREIGN KEY (parent_record_id)
    REFERENCES client_relationship_records (relationship_record_id)
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
