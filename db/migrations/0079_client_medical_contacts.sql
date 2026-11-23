-- Additive: client medical contacts (professionals linked to a client).
-- Backfill from medication event prescriber_professional_id. Apply once.

CREATE TABLE IF NOT EXISTS client_medical_contacts (
  medical_contact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  practice_id uuid NOT NULL REFERENCES practices(practice_id),
  professional_id uuid NOT NULL REFERENCES professionals(professional_id),
  is_main boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS client_medical_contacts_client_professional_uidx
  ON client_medical_contacts (client_id, professional_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS client_medical_contacts_one_main_uidx
  ON client_medical_contacts (client_id)
  WHERE is_main = true;
--> statement-breakpoint
-- One row per distinct (client, medication prescriber professional).
INSERT INTO client_medical_contacts (
  medical_contact_id,
  client_id,
  practice_id,
  professional_id,
  is_main,
  notes,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  e.client_id,
  e.practice_id,
  e.prescriber_professional_id,
  false,
  NULL,
  now(),
  now()
FROM (
  SELECT DISTINCT
    client_id,
    practice_id,
    prescriber_professional_id
  FROM client_event_records
  WHERE event_type = 'medication'
    AND prescriber_professional_id IS NOT NULL
) e
WHERE NOT EXISTS (
  SELECT 1
  FROM client_medical_contacts c
  WHERE c.client_id = e.client_id
    AND c.professional_id = e.prescriber_professional_id
);
--> statement-breakpoint
-- Exactly one contact → mark as main.
UPDATE client_medical_contacts AS c
SET is_main = true,
    updated_at = now()
WHERE c.is_main = false
  AND (
    SELECT count(*)::int
    FROM client_medical_contacts x
    WHERE x.client_id = c.client_id
  ) = 1;
