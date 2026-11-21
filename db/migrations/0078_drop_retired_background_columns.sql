-- Apply only after the code that stops using these columns is live on Production.
ALTER TABLE client_backgrounds DROP COLUMN IF EXISTS reason_for_attending_json;
ALTER TABLE client_relationship_blocks DROP COLUMN IF EXISTS no_children;
ALTER TABLE client_event_records
  DROP COLUMN IF EXISTS condition_event_id,
  DROP COLUMN IF EXISTS treated,
  DROP COLUMN IF EXISTS treatment_type,
  DROP COLUMN IF EXISTS treatment_detail,
  DROP COLUMN IF EXISTS outcome;
ALTER TABLE client_relationship_records
  DROP COLUMN IF EXISTS approximate_age,
  DROP COLUMN IF EXISTS approximate_age_recorded_on,
  DROP COLUMN IF EXISTS child_type;
