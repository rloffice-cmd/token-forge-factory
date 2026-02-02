-- Add throttle_until column to brain_settings for Sticky Throttle
ALTER TABLE public.brain_settings 
ADD COLUMN IF NOT EXISTS throttle_until timestamp with time zone DEFAULT NULL;

-- Add throttle_reason for forensic tracking
ALTER TABLE public.brain_settings 
ADD COLUMN IF NOT EXISTS throttle_reason text DEFAULT NULL;

-- Create free_value_events table to track real product interactions
CREATE TABLE IF NOT EXISTS public.free_value_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES public.leads(id),
  customer_id uuid REFERENCES public.users_customers(id),
  session_id text,
  event_type text NOT NULL, -- 'scan_started', 'results_viewed', 'time_on_page', 'report_downloaded'
  event_data jsonb DEFAULT '{}'::jsonb,
  source_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.free_value_events ENABLE ROW LEVEL SECURITY;

-- Service role access
CREATE POLICY "Service role full access to free_value_events" 
ON public.free_value_events 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_free_value_events_lead ON public.free_value_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_free_value_events_session ON public.free_value_events(session_id);
CREATE INDEX IF NOT EXISTS idx_free_value_events_created ON public.free_value_events(created_at DESC);