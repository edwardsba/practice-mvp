ALTER TABLE battery_instances
  ADD COLUMN btp_instance_id uuid REFERENCES assessment_instances(assessment_instance_id),
  ADD COLUMN btp_link_id uuid REFERENCES assessment_access_links(assessment_access_link_id),
  ADD COLUMN assist_instance_id uuid REFERENCES assessment_instances(assessment_instance_id),
  ADD COLUMN assist_link_id uuid REFERENCES assessment_access_links(assessment_access_link_id),
  ADD COLUMN first_link_id uuid REFERENCES assessment_access_links(assessment_access_link_id),
  ADD COLUMN last_link_id uuid REFERENCES assessment_access_links(assessment_access_link_id);

UPDATE battery_instances
SET
  first_link_id = phq9_link_id,
  last_link_id = gad7_link_id,
  updated_at = NOW()
WHERE first_link_id IS NULL;
