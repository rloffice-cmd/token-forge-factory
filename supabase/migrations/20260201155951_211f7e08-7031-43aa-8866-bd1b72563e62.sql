-- Create optimization_events table for tracking all optimization actions
CREATE TABLE IF NOT EXISTS public.optimization_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  optimizer TEXT NOT NULL,
  event_type TEXT NOT NULL,
  target_entity TEXT,
  target_id TEXT,
  action_taken TEXT NOT NULL,
  previous_value JSONB DEFAULT '{}'::jsonb,
  new_value JSONB DEFAULT '{}'::jsonb,
  impact_measured JSONB DEFAULT '{}'::jsonb,
  confidence NUMERIC DEFAULT 0.7,
  auto_implemented BOOLEAN DEFAULT false,
  rolled_back_at TIMESTAMP WITH TIME ZONE
);

-- Create landing_variants table for A/B test variants tracking
CREATE TABLE IF NOT EXISTS public.landing_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  element_key TEXT NOT NULL,
  variant_key TEXT NOT NULL,
  text_content TEXT NOT NULL,
  angle TEXT,
  hypothesis TEXT,
  views INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_rate NUMERIC GENERATED ALWAYS AS (CASE WHEN views > 0 THEN (conversions::numeric / views::numeric) * 100 ELSE 0 END) STORED,
  is_winner BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  experiment_id UUID REFERENCES campaign_experiments(id)
);

-- Create growth_forecasts table for revenue predictions
CREATE TABLE IF NOT EXISTS public.growth_forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  forecast_date DATE NOT NULL,
  period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  metric_name TEXT NOT NULL,
  predicted_value NUMERIC NOT NULL,
  actual_value NUMERIC,
  confidence NUMERIC DEFAULT 0.5,
  model_version TEXT,
  factors JSONB DEFAULT '{}'::jsonb
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_optimization_events_created ON optimization_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_events_optimizer ON optimization_events(optimizer);
CREATE INDEX IF NOT EXISTS idx_landing_variants_element ON landing_variants(element_key);
CREATE INDEX IF NOT EXISTS idx_landing_variants_active ON landing_variants(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_growth_forecasts_date ON growth_forecasts(forecast_date DESC);

-- Enable RLS
ALTER TABLE public.optimization_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_forecasts ENABLE ROW LEVEL SECURITY;

-- Service role policies
CREATE POLICY "Service role full access optimization_events" ON public.optimization_events
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access landing_variants" ON public.landing_variants
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access growth_forecasts" ON public.growth_forecasts
  FOR ALL USING (true) WITH CHECK (true);