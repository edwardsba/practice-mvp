ALTER TABLE practitioner_profiles
  ADD COLUMN IF NOT EXISTS signature_image_path text;
