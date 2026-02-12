
-- Click Analytics table for affiliate redirect tracking
CREATE TABLE public.click_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id TEXT,
  partner_id UUID REFERENCES public.m2m_partners(id),
  partner_slug TEXT NOT NULL,
  source_platform TEXT,
  source_url TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  referrer_url TEXT,
  redirect_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.click_analytics ENABLE ROW LEVEL SECURITY;

-- Service role only for writes, public read for aggregate stats
CREATE POLICY "Service role full access on click_analytics"
ON public.click_analytics FOR ALL
USING ((current_setting('request.jwt.claims', true)::json->>'role') = 'service_role');

CREATE POLICY "Authenticated users can read click_analytics"
ON public.click_analytics FOR SELECT
USING ((current_setting('request.jwt.claims', true)::json->>'role') = 'authenticated');

-- Index for fast queries
CREATE INDEX idx_click_analytics_partner ON public.click_analytics(partner_slug);
CREATE INDEX idx_click_analytics_created ON public.click_analytics(created_at DESC);
CREATE INDEX idx_click_analytics_lead ON public.click_analytics(lead_id);
