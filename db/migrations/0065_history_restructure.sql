-- Abuse becomes a traumatic event. Childhood screening answers fold into other significant events.
UPDATE client_event_records
SET event_type = 'traumatic_event',
    updated_at = NOW()
WHERE event_type = 'abuse';
--> statement-breakpoint
UPDATE client_background_interviews
SET screening_json = (
      WITH base AS (
        SELECT COALESCE(screening_json, '{}'::jsonb) AS s
      ),
      abuse_moved AS (
        SELECT
          CASE
            WHEN jsonb_exists(s, 'abuse') THEN
              (s - 'abuse') || jsonb_build_object(
                'traumatic_events',
                CASE
                  WHEN jsonb_exists(s, 'traumatic_events') THEN s -> 'traumatic_events'
                  ELSE s -> 'abuse'
                END
              )
            ELSE s
          END AS s
        FROM base
      ),
      childhood_merged AS (
        SELECT
          CASE
            WHEN jsonb_exists(s, 'childhood_events') THEN
              (s - 'childhood_events') || jsonb_build_object(
                'other_significant_events',
                CASE
                  WHEN s ->> 'other_significant_events' = 'yes' OR s ->> 'childhood_events' = 'yes' THEN 'yes'
                  WHEN jsonb_exists(s, 'other_significant_events') THEN s ->> 'other_significant_events'
                  ELSE s ->> 'childhood_events'
                END
              )
            ELSE s
          END AS s
        FROM abuse_moved
      )
      SELECT s FROM childhood_merged
    ),
    updated_at = NOW()
WHERE jsonb_exists(COALESCE(screening_json, '{}'::jsonb), 'abuse')
   OR jsonb_exists(COALESCE(screening_json, '{}'::jsonb), 'childhood_events');
