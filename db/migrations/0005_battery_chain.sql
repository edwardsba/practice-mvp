ALTER TABLE assessment_access_links
ADD COLUMN IF NOT EXISTS next_access_link_id uuid REFERENCES assessment_access_links(assessment_access_link_id);

ALTER TABLE assessment_access_links
ADD COLUMN IF NOT EXISTS next_raw_token text;
