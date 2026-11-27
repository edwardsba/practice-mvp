-- Round AL: preferred name, Medicare expiry, claim type codes, one active Medicare/NDIS claim.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS preferred_name text;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS medicare_expiry text;

ALTER TABLE claim_types
  ADD COLUMN IF NOT EXISTS code text;

UPDATE claim_types
SET code = CASE
  WHEN lower(trim(claim_type_name)) = 'medicare' THEN 'medicare'
  WHEN lower(trim(claim_type_name)) = 'ndis' THEN 'ndis'
  WHEN lower(trim(claim_type_name)) IN ('private', 'workcover')
    OR lower(trim(claim_type_name)) LIKE 'workcover%'
    OR lower(trim(claim_type_name)) LIKE 'private%'
    THEN 'insurer'
  ELSE code
END
WHERE code IS NULL;

-- Backfill remaining known seeded insurer-style names that include WorkCover wording.
UPDATE claim_types
SET code = 'insurer'
WHERE code IS NULL
  AND (
    lower(trim(claim_type_name)) LIKE '%workcover%'
    OR lower(trim(claim_type_name)) LIKE '%workers compensation%'
    OR lower(trim(claim_type_name)) = 'private'
  );

CREATE OR REPLACE FUNCTION enforce_one_active_medicare_or_ndis_claim()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  claim_code text;
BEGIN
  IF NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT ct.code INTO claim_code
  FROM claim_types ct
  WHERE ct.claim_type_id = NEW.claim_type_id;

  IF claim_code IS DISTINCT FROM 'medicare' AND claim_code IS DISTINCT FROM 'ndis' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM claims c
    INNER JOIN claim_types ct ON ct.claim_type_id = c.claim_type_id
    WHERE c.client_id = NEW.client_id
      AND c.is_active = true
      AND ct.code = claim_code
      AND c.claim_id IS DISTINCT FROM NEW.claim_id
  ) THEN
    IF claim_code = 'medicare' THEN
      RAISE EXCEPTION 'This client already has a Medicare claim.';
    ELSE
      RAISE EXCEPTION 'This client already has an NDIS claim.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS claims_one_active_medicare_or_ndis ON claims;
CREATE TRIGGER claims_one_active_medicare_or_ndis
  BEFORE INSERT OR UPDATE OF is_active, claim_type_id, client_id
  ON claims
  FOR EACH ROW
  EXECUTE FUNCTION enforce_one_active_medicare_or_ndis_claim();
