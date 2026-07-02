ALTER TABLE funding_approval_type_reports ADD COLUMN report_type_id uuid REFERENCES report_types(report_type_id);
ALTER TABLE funding_approval_report_links ADD COLUMN report_type_id uuid REFERENCES report_types(report_type_id);

UPDATE funding_approval_type_reports fatr
SET report_type_id = rt.report_type_id
FROM report_types rt, funding_approval_types fat
WHERE fatr.funding_approval_type_id = fat.funding_approval_type_id
  AND rt.practice_id = fat.practice_id
  AND lower(trim(rt.name)) = lower(trim(fatr.report_type));

UPDATE funding_approval_report_links falink
SET report_type_id = fatr.report_type_id
FROM funding_approval_type_reports fatr, funding_approvals fa
WHERE falink.funding_approval_id = fa.funding_approval_id
  AND falink.appointment_number = fatr.appointment_number
  AND fatr.funding_approval_type_id = fa.funding_approval_type_id
  AND fatr.report_type_id IS NOT NULL;
