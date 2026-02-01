-- =====================================================
-- MICRO PRODUCT STACK v0 - Sensor Layer Schema
-- =====================================================

-- Micro Events Table - tracks all micro product usage
CREATE TABLE public.micro_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.users_customers(id),
  product TEXT NOT NULL CHECK (product IN ('wallet-risk', 'webhook-check', 'payment-drift')),
  severity INTEGER NOT NULL DEFAULT 1 CHECK (severity >= 1 AND severity <= 10),
  estimated_loss_usd NUMERIC NOT NULL DEFAULT 0,
  cost_usd NUMERIC NOT NULL DEFAULT 0,
  raw_input JSONB NOT NULL DEFAULT '{}',
  raw_output JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Pain Scores Table - aggregated pain per customer per day
CREATE TABLE public.pain_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.users_customers(id),
  window_date DATE NOT NULL DEFAULT CURRENT_DATE,
  pain_score_total NUMERIC NOT NULL DEFAULT 0,
  estimated_loss_usd_total NUMERIC NOT NULL DEFAULT 0,
  events_count INTEGER NOT NULL DEFAULT 0,
  top_problem_type TEXT,
  wallet_risk_high_count INTEGER NOT NULL DEFAULT 0,
  webhook_failures_count INTEGER NOT NULL DEFAULT 0,
  payment_drift_total_usd NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, window_date)
);

-- Guardian Offers Table - auto-generated upsell offers
CREATE TABLE public.guardian_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.users_customers(id),
  estimated_monthly_loss_usd NUMERIC NOT NULL DEFAULT 0,
  reason TEXT NOT NULL CHECK (reason IN ('wallet_high', 'payment_drift', 'webhook_failures', 'combined')),
  price_usd NUMERIC NOT NULL DEFAULT 499,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'sent', 'viewed', 'paid', 'expired', 'declined')),
  payment_link TEXT,
  charge_id TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  sent_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Micro Rate Limits Table - daily spend caps
CREATE TABLE public.micro_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.users_customers(id),
  limit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  spent_usd NUMERIC NOT NULL DEFAULT 0,
  cap_usd NUMERIC NOT NULL DEFAULT 20,
  hits_count INTEGER NOT NULL DEFAULT 0,
  blocked_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, limit_date)
);

-- Micro Pricing Config Table
CREATE TABLE public.micro_pricing (
  product TEXT NOT NULL PRIMARY KEY,
  price_usd NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  description_he TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default pricing
INSERT INTO public.micro_pricing (product, price_usd, description, description_he) VALUES
  ('wallet-risk', 0.02, 'Quick wallet risk check', 'בדיקת סיכון ארנק מהירה'),
  ('webhook-check', 0.25, 'Webhook health verification', 'בדיקת תקינות Webhook'),
  ('payment-drift', 2.00, 'Payment drift detection', 'זיהוי פער בתשלומים');

-- Auto-Offer Rules Table
CREATE TABLE public.auto_offer_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_name TEXT NOT NULL UNIQUE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('wallet_high', 'payment_drift', 'webhook_failures', 'combined')),
  threshold_value NUMERIC NOT NULL,
  threshold_unit TEXT NOT NULL DEFAULT 'count',
  time_window_hours INTEGER NOT NULL DEFAULT 24,
  offer_reason TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default rules
INSERT INTO public.auto_offer_rules (rule_name, rule_type, threshold_value, threshold_unit, time_window_hours, offer_reason) VALUES
  ('wallet_high_3x', 'wallet_high', 3, 'count', 24, 'wallet_high'),
  ('drift_500', 'payment_drift', 500, 'usd', 1, 'payment_drift'),
  ('webhook_fail_2x', 'webhook_failures', 2, 'count', 24, 'webhook_failures');

-- Enable RLS
ALTER TABLE public.micro_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pain_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.micro_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.micro_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_offer_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for micro_events
CREATE POLICY "Service role full access to micro_events" ON public.micro_events
  AS RESTRICTIVE FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for pain_scores
CREATE POLICY "Service role full access to pain_scores" ON public.pain_scores
  AS RESTRICTIVE FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for guardian_offers
CREATE POLICY "Service role full access to guardian_offers" ON public.guardian_offers
  AS RESTRICTIVE FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for micro_rate_limits
CREATE POLICY "Service role full access to micro_rate_limits" ON public.micro_rate_limits
  AS RESTRICTIVE FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for micro_pricing (public read)
CREATE POLICY "Public read micro_pricing" ON public.micro_pricing
  AS RESTRICTIVE FOR SELECT USING (true);

-- RLS Policies for auto_offer_rules
CREATE POLICY "Service role full access to auto_offer_rules" ON public.auto_offer_rules
  AS RESTRICTIVE FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_micro_events_customer_created ON public.micro_events(customer_id, created_at DESC);
CREATE INDEX idx_micro_events_product ON public.micro_events(product);
CREATE INDEX idx_pain_scores_customer_date ON public.pain_scores(customer_id, window_date DESC);
CREATE INDEX idx_guardian_offers_customer ON public.guardian_offers(customer_id);
CREATE INDEX idx_guardian_offers_status ON public.guardian_offers(status);
CREATE INDEX idx_micro_rate_limits_customer_date ON public.micro_rate_limits(customer_id, limit_date);

-- Trigger for pain_scores updated_at
CREATE TRIGGER update_pain_scores_updated_at
  BEFORE UPDATE ON public.pain_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for micro_rate_limits updated_at
CREATE TRIGGER update_micro_rate_limits_updated_at
  BEFORE UPDATE ON public.micro_rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();