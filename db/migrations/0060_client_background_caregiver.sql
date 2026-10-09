-- Free-text description of an other primary caregiver (for example grandparent, aunt, foster carer).
ALTER TABLE client_relationship_records
  ADD COLUMN IF NOT EXISTS caregiver_relationship text;
