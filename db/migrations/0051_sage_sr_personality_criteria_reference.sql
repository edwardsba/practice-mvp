CREATE TABLE IF NOT EXISTS sage_sr_personality_criteria_reference (
  sage_sr_personality_criteria_reference_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disorder text NOT NULL,
  criterion_number integer NOT NULL,
  criterion_text text NOT NULL,
  threshold_required integer NOT NULL,
  total_criteria integer NOT NULL,
  item_text text NOT NULL,
  reverse_scored boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sage_sr_personality_criteria_reference_disorder_idx
  ON sage_sr_personality_criteria_reference (disorder);
