-- Ticket scraper state tracking
-- Stores results from each check to avoid duplicate alerts

CREATE TABLE IF NOT EXISTS ticket_scraper_state (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  results jsonb DEFAULT '[]'::jsonb,
  found_count integer DEFAULT 0,
  source text DEFAULT 'github_action', -- 'github_action' or 'edge_function'
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_ticket_scraper_state_checked ON ticket_scraper_state (checked_at DESC);

-- Auto-cleanup: keep only last 24 hours of data
CREATE OR REPLACE FUNCTION cleanup_old_scraper_state()
RETURNS void AS $$
BEGIN
  DELETE FROM ticket_scraper_state WHERE created_at < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Schedule the edge function to run every 2 minutes via pg_cron
-- Note: You need to enable pg_cron extension in your Supabase project dashboard
-- Settings > Database > Extensions > pg_cron

-- Uncomment after enabling pg_cron:
-- SELECT cron.schedule(
--   'ticket-checker-cron',
--   '*/2 * * * *',
--   $$
--   SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/ticket-checker',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- Cleanup old state daily
-- SELECT cron.schedule('cleanup-scraper-state', '0 3 * * *', $$ SELECT cleanup_old_scraper_state(); $$);
