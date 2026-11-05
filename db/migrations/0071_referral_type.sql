-- Adds referralType on the existing reason JSON. Older Yes/No keys are left in place.
-- referred Yes → medical; else family involved Yes → family or friend (detail becomes their concerns);
-- else own initiative Yes → self; else blank.
UPDATE client_backgrounds
SET reason_for_attending_json = reason_for_attending_json || jsonb_build_object(
  'referralType',
  CASE
    WHEN reason_for_attending_json->>'referredByMedicalProfessional' = 'yes' THEN 'medical'
    WHEN reason_for_attending_json->>'familyInvolved' = 'yes' THEN 'family_or_friend'
    WHEN reason_for_attending_json->>'ownInitiative' = 'yes' THEN 'self'
    ELSE ''
  END,
  'theirConcerns',
  CASE
    WHEN COALESCE(reason_for_attending_json->>'referredByMedicalProfessional', '') IS DISTINCT FROM 'yes'
     AND reason_for_attending_json->>'familyInvolved' = 'yes'
    THEN COALESCE(reason_for_attending_json->>'familyInvolvement', '')
    ELSE COALESCE(reason_for_attending_json->>'theirConcerns', '')
  END,
  'referrerIsOther', COALESCE((reason_for_attending_json->>'referrerIsOther')::boolean, false),
  'referrerOther', COALESCE(reason_for_attending_json->>'referrerOther', '')
)
WHERE reason_for_attending_json IS NOT NULL
  AND NOT (reason_for_attending_json ? 'referralType');
--> statement-breakpoint
