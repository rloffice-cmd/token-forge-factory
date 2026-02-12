
-- Add actor_fingerprint to click_analytics
ALTER TABLE public.click_analytics ADD COLUMN IF NOT EXISTS actor_fingerprint text;

-- Add actor_fingerprint to affiliate_clicks  
ALTER TABLE public.affiliate_clicks ADD COLUMN IF NOT EXISTS actor_fingerprint text;

-- Add source, ref_id, note to treasury_ledger for audit trail
ALTER TABLE public.treasury_ledger ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.treasury_ledger ADD COLUMN IF NOT EXISTS ref_id text;
ALTER TABLE public.treasury_ledger ADD COLUMN IF NOT EXISTS note text;

-- Add suspicious flag to m2m_partners for anti-fraud
ALTER TABLE public.m2m_partners ADD COLUMN IF NOT EXISTS suspicious boolean DEFAULT false;
ALTER TABLE public.m2m_partners ADD COLUMN IF NOT EXISTS suspicious_reason text;

-- Add affiliate_click_id to affiliate_earnings for linking postback to click
ALTER TABLE public.affiliate_earnings ADD COLUMN IF NOT EXISTS affiliate_click_id uuid REFERENCES public.affiliate_clicks(id);

-- Create index for fast click analytics queries by platform
CREATE INDEX IF NOT EXISTS idx_click_analytics_platform ON public.click_analytics(source_platform);
CREATE INDEX IF NOT EXISTS idx_click_analytics_fingerprint ON public.click_analytics(actor_fingerprint);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_fingerprint ON public.affiliate_clicks(actor_fingerprint);
