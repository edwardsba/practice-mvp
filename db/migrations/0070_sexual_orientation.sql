-- Additive. Sexual orientation on the living background. Old code ignores the columns.
ALTER TABLE client_backgrounds
  ADD COLUMN IF NOT EXISTS sexual_orientation text,
  ADD COLUMN IF NOT EXISTS sexual_orientation_other text;
