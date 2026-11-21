-- Additive: explicit Children / Siblings answers on relationship blocks.
-- Keep no_children in step with children_answer = 'none' so main keeps working.
-- Apply once.

ALTER TABLE client_relationship_blocks
  ADD COLUMN IF NOT EXISTS children_answer text,
  ADD COLUMN IF NOT EXISTS siblings_answer text;
--> statement-breakpoint
-- Backfill children_answer from members and no_children.
UPDATE client_relationship_blocks b
SET children_answer = 'yes'
WHERE children_answer IS NULL
  AND EXISTS (
    SELECT 1
    FROM client_relationship_records r
    WHERE r.relationship_block_id = b.relationship_block_id
      AND r.block_role = 'child'
  );
--> statement-breakpoint
UPDATE client_relationship_blocks
SET children_answer = 'none'
WHERE children_answer IS NULL
  AND no_children = true;
--> statement-breakpoint
-- Backfill siblings_answer from sibling members.
UPDATE client_relationship_blocks b
SET siblings_answer = 'yes'
WHERE siblings_answer IS NULL
  AND EXISTS (
    SELECT 1
    FROM client_relationship_records r
    WHERE r.relationship_block_id = b.relationship_block_id
      AND r.block_role = 'sibling'
  );
