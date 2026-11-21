-- Additive: referral fields on funding_approvals; Private (self-funded) type;
-- move existing referrals from client_backgrounds.reason_for_attending_json.
-- Keep the JSON in place (main still reads it). Apply once.

ALTER TABLE funding_approvals
  ADD COLUMN IF NOT EXISTS referral_date text,
  ADD COLUMN IF NOT EXISTS referrer_comments text,
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS referrer_relationship_id uuid,
  ADD COLUMN IF NOT EXISTS referrer_other text;
--> statement-breakpoint
-- Private (self-funded) approval type per practice, linked to claim type Private.
INSERT INTO funding_approval_types (
  funding_approval_type_id,
  practice_id,
  name,
  claim_type_id,
  duration_months,
  appointments_approved,
  is_active,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  p.practice_id,
  'Private (self-funded)',
  ct.claim_type_id,
  NULL,
  NULL,
  true,
  now(),
  now()
FROM practices p
JOIN claim_types ct
  ON ct.practice_id = p.practice_id
 AND ct.claim_type_name = 'Private'
 AND ct.is_active = true
WHERE NOT EXISTS (
  SELECT 1
  FROM funding_approval_types existing
  WHERE existing.practice_id = p.practice_id
    AND existing.name = 'Private (self-funded)'
);
--> statement-breakpoint
-- Medical referrals: fill empty columns on the approval active on the interview
-- date, else the client's most recent approval.
WITH interview_dates AS (
  SELECT DISTINCT ON (i.client_id)
    i.client_id,
    i.practice_id,
    to_char(
      (COALESCE(i.completed_at, i.started_at) AT TIME ZONE 'Australia/Sydney'),
      'YYYY-MM-DD'
    ) AS interview_date
  FROM client_background_interviews i
  WHERE i.status IN ('completed', 'in_progress')
  ORDER BY i.client_id, COALESCE(i.completed_at, i.started_at) DESC
),
chosen_approval AS (
  SELECT DISTINCT ON (fa.client_id)
    fa.funding_approval_id,
    fa.client_id,
    fa.practice_id,
    fa.referrer_id,
    fa.referral_date,
    fa.referrer_comments,
    fa.referral_source,
    fa.referrer_relationship_id,
    fa.referrer_other
  FROM funding_approvals fa
  LEFT JOIN interview_dates id
    ON id.client_id = fa.client_id
   AND id.practice_id = fa.practice_id
  WHERE fa.is_active = true
  ORDER BY
    fa.client_id,
    CASE
      WHEN id.interview_date IS NOT NULL
       AND fa.start_date IS NOT NULL
       AND fa.start_date <= id.interview_date
       AND (fa.end_date IS NULL OR fa.end_date >= id.interview_date)
      THEN 0
      ELSE 1
    END,
    fa.start_date DESC NULLS LAST,
    fa.created_at DESC
),
medical_source AS (
  SELECT
    bg.client_id,
    bg.practice_id,
    bg.reason_for_attending_json->>'referrerProfessionalId' AS referrer_professional_id,
    bg.reason_for_attending_json->>'referralDate' AS referral_date_raw,
    COALESCE(bg.reason_for_attending_json->>'referrerConcerns', '') AS referrer_comments
  FROM client_backgrounds bg
  WHERE bg.reason_for_attending_json->>'referralType' = 'medical'
)
UPDATE funding_approvals fa
SET
  referrer_id = COALESCE(
    fa.referrer_id,
    CASE
      WHEN ms.referrer_professional_id ~ '^[0-9a-fA-F-]{36}$'
        AND EXISTS (
          SELECT 1 FROM professionals p
          WHERE p.professional_id = ms.referrer_professional_id::uuid
            AND p.practice_id = fa.practice_id
        )
      THEN ms.referrer_professional_id::uuid
      ELSE NULL
    END
  ),
  referral_date = COALESCE(
    fa.referral_date,
    CASE
      WHEN ms.referral_date_raw ~ '^\d{4}-\d{2}-\d{2}$' THEN ms.referral_date_raw
      ELSE NULL
    END
  ),
  referrer_comments = COALESCE(
    NULLIF(fa.referrer_comments, ''),
    NULLIF(ms.referrer_comments, '')
  ),
  updated_at = now()
FROM medical_source ms
JOIN chosen_approval ca
  ON ca.client_id = ms.client_id
 AND ca.practice_id = ms.practice_id
WHERE fa.funding_approval_id = ca.funding_approval_id;
--> statement-breakpoint
-- Family or friend referrals onto chosen approval.
WITH interview_dates AS (
  SELECT DISTINCT ON (i.client_id)
    i.client_id,
    i.practice_id,
    to_char(
      (COALESCE(i.completed_at, i.started_at) AT TIME ZONE 'Australia/Sydney'),
      'YYYY-MM-DD'
    ) AS interview_date
  FROM client_background_interviews i
  WHERE i.status IN ('completed', 'in_progress')
  ORDER BY i.client_id, COALESCE(i.completed_at, i.started_at) DESC
),
chosen_approval AS (
  SELECT DISTINCT ON (fa.client_id)
    fa.funding_approval_id,
    fa.client_id,
    fa.practice_id
  FROM funding_approvals fa
  LEFT JOIN interview_dates id
    ON id.client_id = fa.client_id
   AND id.practice_id = fa.practice_id
  WHERE fa.is_active = true
  ORDER BY
    fa.client_id,
    CASE
      WHEN id.interview_date IS NOT NULL
       AND fa.start_date IS NOT NULL
       AND fa.start_date <= id.interview_date
       AND (fa.end_date IS NULL OR fa.end_date >= id.interview_date)
      THEN 0
      ELSE 1
    END,
    fa.start_date DESC NULLS LAST,
    fa.created_at DESC
),
family_source AS (
  SELECT
    bg.client_id,
    bg.practice_id,
    bg.reason_for_attending_json->>'referrerRelationshipId' AS referrer_relationship_id,
    COALESCE((bg.reason_for_attending_json->>'referrerIsOther')::boolean, false) AS referrer_is_other,
    COALESCE(bg.reason_for_attending_json->>'referrerOther', '') AS referrer_other,
    COALESCE(bg.reason_for_attending_json->>'theirConcerns', '') AS their_concerns,
    bg.reason_for_attending_json->>'referralDate' AS referral_date_raw
  FROM client_backgrounds bg
  WHERE bg.reason_for_attending_json->>'referralType' = 'family_or_friend'
)
UPDATE funding_approvals fa
SET
  referral_source = COALESCE(fa.referral_source, 'family_or_friend'),
  referrer_relationship_id = COALESCE(
    fa.referrer_relationship_id,
    CASE
      WHEN NOT fs.referrer_is_other
       AND fs.referrer_relationship_id ~ '^[0-9a-fA-F-]{36}$'
       AND EXISTS (
         SELECT 1 FROM client_relationship_records r
         WHERE r.relationship_record_id = fs.referrer_relationship_id::uuid
           AND r.client_id = fa.client_id
           AND r.practice_id = fa.practice_id
       )
      THEN fs.referrer_relationship_id::uuid
      ELSE NULL
    END
  ),
  referrer_other = COALESCE(
    NULLIF(fa.referrer_other, ''),
    CASE
      WHEN fs.referrer_is_other THEN NULLIF(fs.referrer_other, '')
      ELSE NULL
    END
  ),
  referral_date = COALESCE(
    fa.referral_date,
    CASE
      WHEN fs.referral_date_raw ~ '^\d{4}-\d{2}-\d{2}$' THEN fs.referral_date_raw
      ELSE NULL
    END
  ),
  referrer_comments = COALESCE(
    NULLIF(fa.referrer_comments, ''),
    NULLIF(fs.their_concerns, '')
  ),
  updated_at = now()
FROM family_source fs
JOIN chosen_approval ca
  ON ca.client_id = fs.client_id
 AND ca.practice_id = fs.practice_id
WHERE fa.funding_approval_id = ca.funding_approval_id
  AND fa.referrer_id IS NULL;
--> statement-breakpoint
-- Self-referrals onto chosen approval.
WITH interview_dates AS (
  SELECT DISTINCT ON (i.client_id)
    i.client_id,
    i.practice_id,
    to_char(
      (COALESCE(i.completed_at, i.started_at) AT TIME ZONE 'Australia/Sydney'),
      'YYYY-MM-DD'
    ) AS interview_date
  FROM client_background_interviews i
  WHERE i.status IN ('completed', 'in_progress')
  ORDER BY i.client_id, COALESCE(i.completed_at, i.started_at) DESC
),
chosen_approval AS (
  SELECT DISTINCT ON (fa.client_id)
    fa.funding_approval_id,
    fa.client_id,
    fa.practice_id
  FROM funding_approvals fa
  LEFT JOIN interview_dates id
    ON id.client_id = fa.client_id
   AND id.practice_id = fa.practice_id
  WHERE fa.is_active = true
  ORDER BY
    fa.client_id,
    CASE
      WHEN id.interview_date IS NOT NULL
       AND fa.start_date IS NOT NULL
       AND fa.start_date <= id.interview_date
       AND (fa.end_date IS NULL OR fa.end_date >= id.interview_date)
      THEN 0
      ELSE 1
    END,
    fa.start_date DESC NULLS LAST,
    fa.created_at DESC
),
self_source AS (
  SELECT bg.client_id, bg.practice_id
  FROM client_backgrounds bg
  WHERE bg.reason_for_attending_json->>'referralType' = 'self'
)
UPDATE funding_approvals fa
SET
  referral_source = COALESCE(fa.referral_source, 'self'),
  updated_at = now()
FROM self_source ss
JOIN chosen_approval ca
  ON ca.client_id = ss.client_id
 AND ca.practice_id = ss.practice_id
WHERE fa.funding_approval_id = ca.funding_approval_id
  AND fa.referrer_id IS NULL;
--> statement-breakpoint
-- Clients with a referral in JSON but no funding approval: create one.
-- Medical with a referrer → MHTP Initial (+ Medicare claim if needed).
-- Otherwise → Private (self-funded) (+ Private claim if needed).
WITH needs_approval AS (
  SELECT
    bg.client_id,
    bg.practice_id,
    bg.reason_for_attending_json->>'referralType' AS referral_type,
    bg.reason_for_attending_json->>'referrerProfessionalId' AS referrer_professional_id,
    bg.reason_for_attending_json->>'referralDate' AS referral_date_raw,
    COALESCE(bg.reason_for_attending_json->>'referrerConcerns', '') AS referrer_concerns,
    bg.reason_for_attending_json->>'referrerRelationshipId' AS referrer_relationship_id,
    COALESCE((bg.reason_for_attending_json->>'referrerIsOther')::boolean, false) AS referrer_is_other,
    COALESCE(bg.reason_for_attending_json->>'referrerOther', '') AS referrer_other,
    COALESCE(bg.reason_for_attending_json->>'theirConcerns', '') AS their_concerns
  FROM client_backgrounds bg
  WHERE COALESCE(bg.reason_for_attending_json->>'referralType', '') IN (
      'medical', 'family_or_friend', 'self'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM funding_approvals fa
      WHERE fa.client_id = bg.client_id
        AND fa.practice_id = bg.practice_id
        AND fa.is_active = true
    )
),
medicare_claim_type AS (
  SELECT claim_type_id, practice_id
  FROM claim_types
  WHERE claim_type_name = 'Medicare' AND is_active = true
),
private_claim_type AS (
  SELECT claim_type_id, practice_id
  FROM claim_types
  WHERE claim_type_name = 'Private' AND is_active = true
),
mhtp_type AS (
  SELECT funding_approval_type_id, practice_id, appointments_approved, duration_months
  FROM funding_approval_types
  WHERE name = 'MHTP Initial' AND is_active = true
),
private_type AS (
  SELECT funding_approval_type_id, practice_id, appointments_approved, duration_months
  FROM funding_approval_types
  WHERE name = 'Private (self-funded)' AND is_active = true
),
ensured_medicare_claims AS (
  INSERT INTO claims (
    claim_id, practice_id, client_id, claim_type_id, is_active, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    n.practice_id,
    n.client_id,
    mct.claim_type_id,
    true,
    now(),
    now()
  FROM needs_approval n
  JOIN medicare_claim_type mct ON mct.practice_id = n.practice_id
  WHERE n.referral_type = 'medical'
    AND n.referrer_professional_id ~ '^[0-9a-fA-F-]{36}$'
    AND EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.professional_id = n.referrer_professional_id::uuid
        AND p.practice_id = n.practice_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM claims c
      WHERE c.client_id = n.client_id
        AND c.practice_id = n.practice_id
        AND c.claim_type_id = mct.claim_type_id
        AND c.is_active = true
    )
  RETURNING claim_id, client_id, practice_id, claim_type_id
),
ensured_private_claims AS (
  INSERT INTO claims (
    claim_id, practice_id, client_id, claim_type_id, is_active, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    n.practice_id,
    n.client_id,
    pct.claim_type_id,
    true,
    now(),
    now()
  FROM needs_approval n
  JOIN private_claim_type pct ON pct.practice_id = n.practice_id
  WHERE NOT (
      n.referral_type = 'medical'
      AND n.referrer_professional_id ~ '^[0-9a-fA-F-]{36}$'
      AND EXISTS (
        SELECT 1 FROM professionals p
        WHERE p.professional_id = n.referrer_professional_id::uuid
          AND p.practice_id = n.practice_id
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM claims c
      WHERE c.client_id = n.client_id
        AND c.practice_id = n.practice_id
        AND c.claim_type_id = pct.claim_type_id
        AND c.is_active = true
    )
  RETURNING claim_id, client_id, practice_id, claim_type_id
),
medicare_claims AS (
  SELECT c.claim_id, c.client_id, c.practice_id
  FROM claims c
  JOIN medicare_claim_type mct
    ON mct.claim_type_id = c.claim_type_id
   AND mct.practice_id = c.practice_id
  WHERE c.is_active = true
  UNION
  SELECT claim_id, client_id, practice_id FROM ensured_medicare_claims
),
private_claims AS (
  SELECT c.claim_id, c.client_id, c.practice_id
  FROM claims c
  JOIN private_claim_type pct
    ON pct.claim_type_id = c.claim_type_id
   AND pct.practice_id = c.practice_id
  WHERE c.is_active = true
  UNION
  SELECT claim_id, client_id, practice_id FROM ensured_private_claims
),
new_approvals AS (
  INSERT INTO funding_approvals (
    funding_approval_id,
    practice_id,
    client_id,
    claim_id,
    funding_approval_type_id,
    referrer_id,
    start_date,
    end_date,
    appointments_approved,
    approval_status,
    is_active,
    referral_date,
    referrer_comments,
    referral_source,
    referrer_relationship_id,
    referrer_other,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    n.practice_id,
    n.client_id,
    CASE
      WHEN n.referral_type = 'medical'
       AND n.referrer_professional_id ~ '^[0-9a-fA-F-]{36}$'
       AND EXISTS (
         SELECT 1 FROM professionals p
         WHERE p.professional_id = n.referrer_professional_id::uuid
           AND p.practice_id = n.practice_id
       )
      THEN (SELECT mc.claim_id FROM medicare_claims mc
            WHERE mc.client_id = n.client_id AND mc.practice_id = n.practice_id
            LIMIT 1)
      ELSE (SELECT pc.claim_id FROM private_claims pc
            WHERE pc.client_id = n.client_id AND pc.practice_id = n.practice_id
            LIMIT 1)
    END,
    CASE
      WHEN n.referral_type = 'medical'
       AND n.referrer_professional_id ~ '^[0-9a-fA-F-]{36}$'
       AND EXISTS (
         SELECT 1 FROM professionals p
         WHERE p.professional_id = n.referrer_professional_id::uuid
           AND p.practice_id = n.practice_id
       )
      THEN mt.funding_approval_type_id
      ELSE pt.funding_approval_type_id
    END,
    CASE
      WHEN n.referral_type = 'medical'
       AND n.referrer_professional_id ~ '^[0-9a-fA-F-]{36}$'
       AND EXISTS (
         SELECT 1 FROM professionals p
         WHERE p.professional_id = n.referrer_professional_id::uuid
           AND p.practice_id = n.practice_id
       )
      THEN n.referrer_professional_id::uuid
      ELSE NULL
    END,
    CASE
      WHEN n.referral_date_raw ~ '^\d{4}-\d{2}-\d{2}$' THEN n.referral_date_raw
      ELSE NULL
    END,
    CASE
      WHEN n.referral_date_raw ~ '^\d{4}-\d{2}-\d{2}$'
       AND n.referral_type = 'medical'
       AND n.referrer_professional_id ~ '^[0-9a-fA-F-]{36}$'
       AND EXISTS (
         SELECT 1 FROM professionals p
         WHERE p.professional_id = n.referrer_professional_id::uuid
           AND p.practice_id = n.practice_id
       )
       AND mt.duration_months IS NOT NULL
      THEN to_char(
        (n.referral_date_raw::date + (mt.duration_months || ' months')::interval)::date,
        'YYYY-MM-DD'
      )
      ELSE NULL
    END,
    CASE
      WHEN n.referral_type = 'medical'
       AND n.referrer_professional_id ~ '^[0-9a-fA-F-]{36}$'
       AND EXISTS (
         SELECT 1 FROM professionals p
         WHERE p.professional_id = n.referrer_professional_id::uuid
           AND p.practice_id = n.practice_id
       )
      THEN mt.appointments_approved
      ELSE pt.appointments_approved
    END,
    'active',
    true,
    CASE
      WHEN n.referral_date_raw ~ '^\d{4}-\d{2}-\d{2}$' THEN n.referral_date_raw
      ELSE NULL
    END,
    CASE
      WHEN n.referral_type = 'medical' THEN NULLIF(n.referrer_concerns, '')
      WHEN n.referral_type = 'family_or_friend' THEN NULLIF(n.their_concerns, '')
      ELSE NULL
    END,
    CASE
      WHEN n.referral_type = 'family_or_friend' THEN 'family_or_friend'
      WHEN n.referral_type = 'self' THEN 'self'
      ELSE NULL
    END,
    CASE
      WHEN n.referral_type = 'family_or_friend'
       AND NOT n.referrer_is_other
       AND n.referrer_relationship_id ~ '^[0-9a-fA-F-]{36}$'
       AND EXISTS (
         SELECT 1 FROM client_relationship_records r
         WHERE r.relationship_record_id = n.referrer_relationship_id::uuid
           AND r.client_id = n.client_id
           AND r.practice_id = n.practice_id
       )
      THEN n.referrer_relationship_id::uuid
      ELSE NULL
    END,
    CASE
      WHEN n.referral_type = 'family_or_friend' AND n.referrer_is_other
      THEN NULLIF(n.referrer_other, '')
      ELSE NULL
    END,
    now(),
    now()
  FROM needs_approval n
  LEFT JOIN mhtp_type mt ON mt.practice_id = n.practice_id
  LEFT JOIN private_type pt ON pt.practice_id = n.practice_id
  WHERE (
    (
      n.referral_type = 'medical'
      AND n.referrer_professional_id ~ '^[0-9a-fA-F-]{36}$'
      AND EXISTS (
        SELECT 1 FROM professionals p
        WHERE p.professional_id = n.referrer_professional_id::uuid
          AND p.practice_id = n.practice_id
      )
      AND mt.funding_approval_type_id IS NOT NULL
    )
    OR (
      NOT (
        n.referral_type = 'medical'
        AND n.referrer_professional_id ~ '^[0-9a-fA-F-]{36}$'
        AND EXISTS (
          SELECT 1 FROM professionals p
          WHERE p.professional_id = n.referrer_professional_id::uuid
            AND p.practice_id = n.practice_id
        )
      )
      AND pt.funding_approval_type_id IS NOT NULL
    )
  )
  RETURNING funding_approval_id, funding_approval_type_id
)
INSERT INTO funding_approval_report_links (
  link_id,
  funding_approval_id,
  appointment_number,
  report_type,
  report_type_id,
  simple_report_id,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  na.funding_approval_id,
  r.appointment_number,
  r.report_type,
  r.report_type_id,
  NULL,
  now(),
  now()
FROM new_approvals na
JOIN funding_approval_type_reports r
  ON r.funding_approval_type_id = na.funding_approval_type_id
WHERE NOT EXISTS (
  SELECT 1
  FROM funding_approval_report_links existing
  WHERE existing.funding_approval_id = na.funding_approval_id
    AND existing.appointment_number = r.appointment_number
);
