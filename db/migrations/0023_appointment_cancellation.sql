ALTER TABLE appointments ADD COLUMN cancelled_at timestamptz;
ALTER TABLE appointments ADD COLUMN cancellation_source text;
