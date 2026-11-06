-- Retire background columns that the block screens and About / Who replaced.
-- Apply once, after the code that no longer reads these columns is on Production.
-- Drops person columns and the partnership table that relationship blocks replaced,
-- the history columns that About / Who replaced, and the old referral and medication JSON keys.
-- Does not touch client_backgrounds.relationship_status (the client's own status)
-- or client_relationship_blocks.started_on / ended_on.
-- event_type is text. family_events is left in place (no rows use it).

ALTER TABLE client_relationship_records
  DROP CONSTRAINT IF EXISTS client_relationship_records_linked_partner_fk,
  DROP CONSTRAINT IF EXISTS client_relationship_records_partnership_fk;
--> statement-breakpoint
ALTER TABLE client_relationship_records
  DROP COLUMN IF EXISTS length_of_relationship,
  DROP COLUMN IF EXISTS relationship_status,
  DROP COLUMN IF EXISTS how_ended,
  DROP COLUMN IF EXISTS later_relationships,
  DROP COLUMN IF EXISTS time_since_ended,
  DROP COLUMN IF EXISTS started_on,
  DROP COLUMN IF EXISTS ended_on,
  DROP COLUMN IF EXISTS partner_type,
  DROP COLUMN IF EXISTS parent_type,
  DROP COLUMN IF EXISTS adopted_on,
  DROP COLUMN IF EXISTS other_parent_kind,
  DROP COLUMN IF EXISTS other_parent_detail,
  DROP COLUMN IF EXISTS linked_partner_record_id,
  DROP COLUMN IF EXISTS partnership_record_id;
--> statement-breakpoint
DROP TABLE IF EXISTS client_partnership_records;
--> statement-breakpoint
ALTER TABLE client_event_records
  DROP COLUMN IF EXISTS attribution,
  DROP COLUMN IF EXISTS family_relation,
  DROP COLUMN IF EXISTS family_side;
--> statement-breakpoint
UPDATE client_backgrounds
SET reason_for_attending_json = reason_for_attending_json
  - 'attendedWillingly'
  - 'referredByMedicalProfessional'
  - 'familyInvolved'
  - 'familyInvolvement'
  - 'ownInitiative'
  - 'clientMotivation'
  - 'motivation'
WHERE reason_for_attending_json IS NOT NULL;
--> statement-breakpoint
UPDATE client_backgrounds
SET medication_json = medication_json
  - 'currentlyTaking'
  - 'previouslyTaken'
  - 'supervisedBy'
WHERE medication_json IS NOT NULL;
