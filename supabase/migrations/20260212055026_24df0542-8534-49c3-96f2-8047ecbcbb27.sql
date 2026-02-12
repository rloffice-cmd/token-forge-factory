
-- Lead Marketplace table for brokerage operation
CREATE TABLE public.lead_marketplace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id),
  niche TEXT NOT NULL,
  pain_description TEXT NOT NULL,
  teaser TEXT NOT NULL,
  tech_stack TEXT[] DEFAULT '{}',
  smart_score INTEGER NOT NULL CHECK (smart_score >= 0 AND smart_score <= 100),
  price_usd NUMERIC(10,2) NOT NULL,
  tier TEXT NOT NULL DEFAULT 'silver' CHECK (tier IN ('silver', 'gold')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold', 'expired')),
  buyer_email TEXT,
  purchased_at TIMESTAMPTZ,
  full_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_marketplace ENABLE ROW LEVEL SECURITY;

-- Public can read available (anonymized) listings
CREATE POLICY "Anyone can view available listings"
ON public.lead_marketplace FOR SELECT
USING (status = 'available');

-- Only service_role can insert/update/delete
CREATE POLICY "Service role manages marketplace"
ON public.lead_marketplace FOR ALL
USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

-- Lead purchases tracking
CREATE TABLE public.lead_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.lead_marketplace(id),
  buyer_email TEXT NOT NULL,
  amount_usd NUMERIC(10,2) NOT NULL,
  payment_intent_id TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'failed')),
  delivered_at TIMESTAMPTZ,
  delivery_method TEXT DEFAULT 'webhook',
  webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages purchases"
ON public.lead_purchases FOR ALL
USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

-- Trigger for updated_at
CREATE TRIGGER update_lead_marketplace_updated_at
BEFORE UPDATE ON public.lead_marketplace
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
