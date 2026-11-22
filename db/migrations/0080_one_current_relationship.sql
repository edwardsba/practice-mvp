-- One current intimate relationship per client.
-- Additive only. Agents do not apply this; Claude reviews and applies after the commit.

CREATE UNIQUE INDEX IF NOT EXISTS client_relationship_blocks_one_current
  ON client_relationship_blocks (client_id)
  WHERE kind = 'client_current';
