-- Round AO step 2: drop old column copies and scrub retired JSON keys.
-- Apply only after the AO code round is live on Production.
-- Schema (Drizzle) already drops sexual_orientation*, risk_json in the same round.

ALTER TABLE client_backgrounds
  DROP COLUMN IF EXISTS sexual_orientation,
  DROP COLUMN IF EXISTS sexual_orientation_other,
  DROP COLUMN IF EXISTS risk_json;

UPDATE client_backgrounds
SET living_situation_json = living_situation_json - 'livesWith' - 'livesWithOther'
WHERE living_situation_json ? 'livesWith'
   OR living_situation_json ? 'livesWithOther';

UPDATE client_background_interviews
SET screening_json = screening_json
  - 'psychiatric_admission'
  - 'previous_therapy'
  - 'medication_history'
  - 'family_psychiatric_admission'
  - 'other_treatment'
WHERE screening_json ? 'psychiatric_admission'
   OR screening_json ? 'previous_therapy'
   OR screening_json ? 'medication_history'
   OR screening_json ? 'family_psychiatric_admission'
   OR screening_json ? 'other_treatment';

UPDATE client_background_interviews
SET snapshot_json = jsonb_set(
  snapshot_json,
  '{screening}',
  (snapshot_json -> 'screening')
    - 'psychiatric_admission'
    - 'previous_therapy'
    - 'medication_history'
    - 'family_psychiatric_admission'
    - 'other_treatment',
  true
)
WHERE snapshot_json ? 'screening'
  AND (
    (snapshot_json -> 'screening') ? 'psychiatric_admission'
    OR (snapshot_json -> 'screening') ? 'previous_therapy'
    OR (snapshot_json -> 'screening') ? 'medication_history'
    OR (snapshot_json -> 'screening') ? 'family_psychiatric_admission'
    OR (snapshot_json -> 'screening') ? 'other_treatment'
  );

UPDATE client_background_interviews
SET answers_json = jsonb_set(
  answers_json,
  '{items}',
  (answers_json -> 'items') - 's6_parents_other' - 's8_other_treatment',
  true
)
WHERE answers_json ? 'items'
  AND (
    (answers_json -> 'items') ? 's6_parents_other'
    OR (answers_json -> 'items') ? 's8_other_treatment'
  );
