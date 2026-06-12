ALTER TABLE practitioner_profiles ADD COLUMN IF NOT EXISTS calendar_start_time time NOT NULL DEFAULT '07:00';
ALTER TABLE practitioner_profiles ADD COLUMN IF NOT EXISTS calendar_end_time time NOT NULL DEFAULT '20:00';
ALTER TABLE practitioner_profiles ADD COLUMN IF NOT EXISTS calendar_interval_minutes integer NOT NULL DEFAULT 30;
