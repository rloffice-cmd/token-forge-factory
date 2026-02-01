-- =============================================
-- Demand-to-Deal Engine Schema
-- מנוע עסקאות אוטונומי 24/7
-- =============================================

-- 1. offer_sources - מקורות לסריקת ביקוש
CREATE TABLE public.offer_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'github_issues', 'reddit', 'twitter', 'forum', 'api_directory'
  url TEXT NOT NULL,
  scan_config JSONB NOT NULL DEFAULT '{}', -- keywords, filters, rate limits
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scanned_at TIMESTAMPTZ,
  scan_interval_minutes INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. demand_signals - סיגנלים גולמיים של ביקוש
CREATE TABLE public.demand_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES public.offer_sources(id),
  external_id TEXT, -- ID מקורי מהמקור
  source_url TEXT,
  query_text TEXT NOT NULL, -- הטקסט שזוהה
  payload_json JSONB NOT NULL DEFAULT '{}',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  urgency_score NUMERIC DEFAULT 0, -- 0-1
  relevance_score NUMERIC DEFAULT 0, -- 0-1
  category TEXT, -- 'webhook', 'api', 'security', 'data'
  status TEXT NOT NULL DEFAULT 'new', -- 'new', 'scored', 'matched', 'rejected', 'stale'
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_id, external_id)
);

-- 3. offers - מוצרים שאפשר לספק אוטומטית
CREATE TABLE public.offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_he TEXT NOT NULL,
  description TEXT,
  description_he TEXT,
  pack_id TEXT REFERENCES public.credit_packs(id), -- קישור לחבילת קרדיטים
  delivery_type TEXT NOT NULL, -- 'api_key', 'report', 'download'
  delivery_config JSONB NOT NULL DEFAULT '{}', -- הגדרות אספקה
  keywords TEXT[] NOT NULL DEFAULT '{}', -- מילות מפתח להתאמה
  min_value_usd NUMERIC NOT NULL DEFAULT 20,
  is_active BOOLEAN NOT NULL DEFAULT true,
  terms_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. opportunities - הזדמנויות שזוהו ונוקדו
CREATE TABLE public.opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_id UUID NOT NULL REFERENCES public.demand_signals(id),
  offer_id UUID REFERENCES public.offers(id),
  expected_value_usd NUMERIC,
  composite_score NUMERIC DEFAULT 0, -- 0-1, ציון משוקלל
  confidence_score NUMERIC DEFAULT 0, -- 0-1
  risk_flags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new', -- 'new', 'approved', 'closing', 'closed', 'rejected', 'failed'
  rejection_reason TEXT,
  auto_approved BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. closing_attempts - ניסיונות סגירה
CREATE TABLE public.closing_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id),
  action TEXT NOT NULL, -- 'generated_offer', 'created_checkout', 'sent_notification'
  checkout_url TEXT,
  charge_id TEXT,
  payment_id UUID REFERENCES public.payments(id),
  result TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed', 'expired'
  error_message TEXT,
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. fulfillment_jobs - משימות אספקה
CREATE TABLE public.fulfillment_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id),
  opportunity_id UUID REFERENCES public.opportunities(id),
  offer_id UUID REFERENCES public.offers(id),
  delivery_type TEXT NOT NULL, -- 'api_key', 'report', 'download'
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'processing', 'delivered', 'failed'
  api_key_id UUID REFERENCES public.api_keys(id),
  artifact_url TEXT,
  delivery_email TEXT,
  error_message TEXT,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. engine_config - הגדרות מנוע גלובליות
CREATE TABLE public.engine_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- הכנסת הגדרות ברירת מחדל
INSERT INTO public.engine_config (config_key, config_value, description) VALUES
('auto_approve_threshold', '0.8', 'סף ציון לאישור אוטומטי של הזדמנויות'),
('min_opportunity_value_usd', '20', 'ערך מינימלי לעסקה'),
('max_daily_closings', '50', 'מקסימום ניסיונות סגירה ביום'),
('scan_enabled', 'true', 'האם סריקת ביקוש פעילה'),
('auto_closing_enabled', 'false', 'האם סגירה אוטומטית פעילה'),
('fulfillment_enabled', 'true', 'האם אספקה אוטומטית פעילה');

-- אינדקסים לביצועים
CREATE INDEX idx_demand_signals_status ON public.demand_signals(status);
CREATE INDEX idx_demand_signals_detected_at ON public.demand_signals(detected_at DESC);
CREATE INDEX idx_opportunities_status ON public.opportunities(status);
CREATE INDEX idx_opportunities_score ON public.opportunities(composite_score DESC);
CREATE INDEX idx_fulfillment_jobs_status ON public.fulfillment_jobs(status);
CREATE INDEX idx_fulfillment_jobs_payment ON public.fulfillment_jobs(payment_id);
CREATE INDEX idx_closing_attempts_opportunity ON public.closing_attempts(opportunity_id);

-- RLS Policies
ALTER TABLE public.offer_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closing_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_config ENABLE ROW LEVEL SECURITY;

-- Service role full access (admin system)
CREATE POLICY "Service role full access to offer_sources" ON public.offer_sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to demand_signals" ON public.demand_signals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to offers" ON public.offers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to opportunities" ON public.opportunities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to closing_attempts" ON public.closing_attempts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to fulfillment_jobs" ON public.fulfillment_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to engine_config" ON public.engine_config FOR ALL USING (true) WITH CHECK (true);

-- Trigger לעדכון updated_at
CREATE TRIGGER update_opportunities_updated_at
BEFORE UPDATE ON public.opportunities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_engine_config_updated_at
BEFORE UPDATE ON public.engine_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();