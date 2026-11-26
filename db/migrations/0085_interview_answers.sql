-- Round AK: Background interview answers_json (nine-section shell marks).
-- Additive only. Claude applies after review.

ALTER TABLE client_background_interviews
  ADD COLUMN IF NOT EXISTS answers_json jsonb NOT NULL DEFAULT '{}'::jsonb;
