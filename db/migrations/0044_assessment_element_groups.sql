ALTER TABLE assessment_elements
  ADD COLUMN IF NOT EXISTS group_label text,
  ADD COLUMN IF NOT EXISTS subgroup_label text;
