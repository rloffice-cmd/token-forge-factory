
-- Brain Metrics Daily - מעקב KPI יומי
CREATE TABLE IF NOT EXISTS public.brain_metrics_daily (
  day DATE PRIMARY KEY,
  signals_count INTEGER NOT NULL DEFAULT 0,
  opp_count INTEGER NOT NULL DEFAULT 0,
  approved_count INTEGER NOT NULL DEFAULT 0,
  checkouts_created INTEGER NOT NULL DEFAULT 0,
  paid_count INTEGER NOT NULL DEFAULT 0,
  revenue_usd NUMERIC NOT NULL DEFAULT 0,
  fulfillment_success_rate NUMERIC DEFAULT NULL,
  outreach_sent INTEGER NOT NULL DEFAULT 0,
  conversion_rate NUMERIC DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for brain_metrics_daily
ALTER TABLE public.brain_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access brain_metrics_daily"
ON public.brain_metrics_daily
AS RESTRICTIVE
FOR ALL
USING (true)
WITH CHECK (true);

-- Add index for date range queries
CREATE INDEX IF NOT EXISTS idx_brain_metrics_daily_day ON public.brain_metrics_daily(day DESC);
