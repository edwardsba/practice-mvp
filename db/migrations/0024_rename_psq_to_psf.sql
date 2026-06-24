UPDATE assessment_definitions
SET
  assessment_code = 'PSF',
  assessment_name = 'Post-Session Feedback',
  updated_at = NOW()
WHERE assessment_code = 'PSQ';
