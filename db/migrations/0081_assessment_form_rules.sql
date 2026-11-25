-- Shared assessment form building blocks (nullable, additive only).
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE assessment_elements
  ADD COLUMN IF NOT EXISTS parent_element_key text,
  ADD COLUMN IF NOT EXISTS show_when_json jsonb,
  ADD COLUMN IF NOT EXISTS required_group_key text,
  ADD COLUMN IF NOT EXISTS help_text text;

ALTER TABLE assessment_responses
  ADD COLUMN IF NOT EXISTS response_order integer;
