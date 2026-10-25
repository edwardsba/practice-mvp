-- Why the client is attending: referral, family involvement, initiative, willingness, motivation.
ALTER TABLE client_backgrounds
  ADD COLUMN IF NOT EXISTS reason_for_attending_json jsonb;
