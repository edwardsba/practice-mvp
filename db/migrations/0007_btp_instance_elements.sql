ALTER TABLE assessment_instances
ADD COLUMN IF NOT EXISTS instance_elements_json jsonb;

ALTER TABLE assessment_elements
ADD COLUMN IF NOT EXISTS assessment_instance_id uuid REFERENCES assessment_instances(assessment_instance_id);

ALTER TABLE assessment_results
ALTER COLUMN severity DROP NOT NULL;
