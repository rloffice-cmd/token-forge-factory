-- =============================================
-- AGENT MARKETPLACE + AFFILIATE ENGINE SCHEMA
-- =============================================

-- ========== AI AGENT MARKETPLACE ==========

-- Agent catalog - products for sale
CREATE TABLE public.agent_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_he TEXT NOT NULL,
  description TEXT NOT NULL,
  description_he TEXT NOT NULL,
  category TEXT NOT NULL, -- 'telegram_bot', 'discord_bot', 'monitor', 'scraper', 'automation'
  price_usd NUMERIC NOT NULL,
  price_eth NUMERIC, -- auto-calculated
  features JSONB NOT NULL DEFAULT '[]',
  tech_stack JSONB NOT NULL DEFAULT '[]', -- e.g., ['telegram', 'supabase', 'ai']
  demo_url TEXT,
  preview_image TEXT,
  delivery_time_hours INTEGER NOT NULL DEFAULT 24,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  sales_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Agent orders
CREATE TABLE public.agent_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agent_catalog(id),
  customer_email TEXT NOT NULL,
  customer_telegram TEXT,
  customization_notes TEXT,
  price_usd NUMERIC NOT NULL,
  price_eth NUMERIC,
  payment_id UUID REFERENCES public.payments(id),
  charge_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'building', 'delivered', 'refunded'
  delivery_url TEXT,
  delivery_notes TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ========== AFFILIATE AUTOMATION ENGINE ==========

-- Affiliate programs we're registered in
CREATE TABLE public.affiliate_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'cloud', 'api', 'saas', 'crypto', 'dev_tools'
  base_url TEXT NOT NULL,
  affiliate_id TEXT, -- our affiliate ID
  affiliate_link_template TEXT, -- e.g., 'https://example.com?ref={affiliate_id}'
  commission_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage', 'fixed', 'recurring'
  commission_value NUMERIC NOT NULL DEFAULT 0, -- percentage or fixed USD
  cookie_days INTEGER DEFAULT 30,
  min_payout_usd NUMERIC DEFAULT 50,
  payout_method TEXT DEFAULT 'paypal', -- 'paypal', 'crypto', 'wire'
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tracked clicks and referrals
CREATE TABLE public.affiliate_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.affiliate_programs(id),
  source TEXT NOT NULL, -- 'content_queue', 'outreach', 'landing', 'manual'
  source_id TEXT, -- reference to content_queue.id or outreach_jobs.id
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_hash TEXT, -- hashed for privacy
  user_agent TEXT,
  referrer_url TEXT,
  converted BOOLEAN NOT NULL DEFAULT false,
  converted_at TIMESTAMP WITH TIME ZONE,
  commission_usd NUMERIC
);

-- Affiliate earnings ledger
CREATE TABLE public.affiliate_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.affiliate_programs(id),
  click_id UUID REFERENCES public.affiliate_clicks(id),
  amount_usd NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'paid', 'rejected'
  reference_id TEXT, -- external reference from affiliate network
  notes TEXT,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Content with affiliate links (extends content_queue behavior)
CREATE TABLE public.affiliate_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.affiliate_programs(id),
  content_queue_id UUID REFERENCES public.content_queue(id),
  headline TEXT NOT NULL,
  body TEXT NOT NULL,
  cta_text TEXT NOT NULL,
  affiliate_link TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'reddit', 'twitter', 'hackernews', 'telegram', 'blog'
  target_keywords JSONB NOT NULL DEFAULT '[]',
  performance_score NUMERIC DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  earnings_usd NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'queued', 'published', 'paused'
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.agent_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_content ENABLE ROW LEVEL SECURITY;

-- Service role policies (backend access only)
CREATE POLICY "Service role full access to agent_catalog" ON public.agent_catalog FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to agent_orders" ON public.agent_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to affiliate_programs" ON public.affiliate_programs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to affiliate_clicks" ON public.affiliate_clicks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to affiliate_earnings" ON public.affiliate_earnings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to affiliate_content" ON public.affiliate_content FOR ALL USING (true) WITH CHECK (true);

-- Public read for catalog
CREATE POLICY "Public read agent_catalog" ON public.agent_catalog FOR SELECT USING (is_active = true);

-- Add indexes for performance
CREATE INDEX idx_agent_orders_status ON public.agent_orders(status);
CREATE INDEX idx_affiliate_clicks_program ON public.affiliate_clicks(program_id);
CREATE INDEX idx_affiliate_clicks_converted ON public.affiliate_clicks(converted);
CREATE INDEX idx_affiliate_earnings_status ON public.affiliate_earnings(status);
CREATE INDEX idx_affiliate_content_status ON public.affiliate_content(status);

-- Triggers for updated_at
CREATE TRIGGER update_agent_catalog_updated_at BEFORE UPDATE ON public.agent_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_orders_updated_at BEFORE UPDATE ON public.agent_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();