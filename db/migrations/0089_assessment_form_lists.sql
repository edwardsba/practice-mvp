-- Form engine: in-person option flag + list config for person_list / history_list.
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE assessment_elements
  ADD COLUMN IF NOT EXISTS allow_in_person boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS list_config_json jsonb;
