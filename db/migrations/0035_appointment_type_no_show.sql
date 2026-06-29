ALTER TABLE appointment_types ADD COLUMN IF NOT EXISTS is_no_show_type boolean NOT NULL DEFAULT false;
