ALTER TABLE appointment_types ADD COLUMN IF NOT EXISTS mode text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_type_id uuid
  REFERENCES appointment_types(appointment_type_id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS membership_id uuid
  REFERENCES practitioner_practice_memberships(membership_id);
