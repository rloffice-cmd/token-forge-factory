
-- Add travel vertical columns to demand_signals
ALTER TABLE public.demand_signals
ADD COLUMN IF NOT EXISTS travel_tier integer,
ADD COLUMN IF NOT EXISTS travel_intent_data jsonb;

-- Add warm-up and ROI tracking columns to existing system_metrics
ALTER TABLE public.system_metrics
ADD COLUMN IF NOT EXISTS metric_date date,
ADD COLUMN IF NOT EXISTS metric_key text,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Index for travel tier lookups
CREATE INDEX IF NOT EXISTS idx_demand_signals_travel_tier ON public.demand_signals(travel_tier) WHERE travel_tier IS NOT NULL;
