
-- M2M Partner Registry
CREATE TABLE public.m2m_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  affiliate_base_url TEXT NOT NULL,
  commission_rate NUMERIC NOT NULL DEFAULT 0,
  commission_type TEXT NOT NULL DEFAULT 'percentage',
  category_tags TEXT[] NOT NULL DEFAULT '{}',
  keyword_triggers TEXT[] NOT NULL DEFAULT '{}',
  postback_url TEXT,
  api_key_encrypted TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_dispatches INTEGER NOT NULL DEFAULT 0,
  total_conversions INTEGER NOT NULL DEFAULT 0,
  total_revenue_usd NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.m2m_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access m2m_partners"
  ON public.m2m_partners FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- M2M Dispatch Ledger
CREATE TABLE public.m2m_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_id UUID REFERENCES public.demand_signals(id),
  partner_id UUID REFERENCES public.m2m_partners(id),
  lead_context TEXT,
  matched_keywords TEXT[] DEFAULT '{}',
  affiliate_link TEXT NOT NULL,
  estimated_bounty_usd NUMERIC NOT NULL DEFAULT 0,
  actual_revenue_usd NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'dispatched' CHECK (status IN ('dispatched', 'pending', 'confirmed', 'rejected')),
  postback_log JSONB DEFAULT '{}',
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.m2m_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access m2m_ledger"
  ON public.m2m_ledger FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- Add m2m_status to demand_signals
ALTER TABLE public.demand_signals ADD COLUMN IF NOT EXISTS m2m_status TEXT DEFAULT 'new';

-- Indexes
CREATE INDEX idx_m2m_ledger_status ON public.m2m_ledger(status);
CREATE INDEX idx_m2m_ledger_partner ON public.m2m_ledger(partner_id);
CREATE INDEX idx_m2m_partners_active ON public.m2m_partners(is_active) WHERE is_active = true;
CREATE INDEX idx_m2m_partners_keywords ON public.m2m_partners USING GIN(keyword_triggers);

-- Trigger for updated_at on partners
CREATE TRIGGER update_m2m_partners_updated_at
  BEFORE UPDATE ON public.m2m_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
