-- =============================================
-- SIGNAL ENGINE: Complete Database Schema
-- =============================================

-- A1) API Keys table - stores hashed API keys for customers
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.users_customers(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL, -- First 8 chars for display (sk_live_xxxx...)
  label TEXT DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  rate_limit_tier TEXT NOT NULL DEFAULT 'basic' CHECK (rate_limit_tier IN ('basic', 'pro', 'business')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT
);

CREATE INDEX idx_api_keys_customer_id ON public.api_keys(customer_id);
CREATE INDEX idx_api_keys_status ON public.api_keys(status);

-- A2) Endpoint costs - pricing per API endpoint
CREATE TABLE public.endpoint_costs (
  endpoint_name TEXT PRIMARY KEY,
  cost_credits INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed endpoint costs
INSERT INTO public.endpoint_costs (endpoint_name, cost_credits, description) VALUES
  ('signal-wallet', 1, 'Wallet risk assessment'),
  ('signal-contract', 2, 'Smart contract analysis');

-- A3) API Requests - forensic insert-only log
CREATE TABLE public.api_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.users_customers(id),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id),
  endpoint TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'base',
  target_address TEXT NOT NULL,
  credits_charged INTEGER NOT NULL,
  risk_score NUMERIC NOT NULL CHECK (risk_score >= 0 AND risk_score <= 1),
  flags TEXT[] NOT NULL DEFAULT '{}',
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'review', 'block')),
  result_json JSONB NOT NULL,
  ip TEXT,
  user_agent TEXT,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_requests_customer_created ON public.api_requests(customer_id, created_at DESC);
CREATE INDEX idx_api_requests_endpoint_created ON public.api_requests(endpoint, created_at DESC);
CREATE INDEX idx_api_requests_target ON public.api_requests(target_address);

-- A4) Credit Events - insert-only ledger for credit movements
CREATE TABLE public.credit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.users_customers(id),
  type TEXT NOT NULL CHECK (type IN ('credit_add', 'credit_burn', 'adjustment', 'refund')),
  amount INTEGER NOT NULL, -- positive for add, negative for burn
  source TEXT NOT NULL CHECK (source IN ('payment', 'api_call', 'admin', 'refund', 'bonus')),
  ref_id UUID, -- reference to payment_id, api_request_id, etc.
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_events_customer_created ON public.credit_events(customer_id, created_at DESC);
CREATE INDEX idx_credit_events_type ON public.credit_events(type);

-- A5) Denylist - blocked wallets, IPs, API keys
CREATE TABLE public.denylist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('wallet', 'ip', 'api_key')),
  value TEXT NOT NULL,
  reason TEXT,
  active BOOLEAN DEFAULT true,
  blocked_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_denylist_type_value ON public.denylist(type, value);
CREATE UNIQUE INDEX idx_denylist_unique_active ON public.denylist(type, value) WHERE active = true;

-- A6) Extend credit_wallets with tracking fields
ALTER TABLE public.credit_wallets 
  ADD COLUMN IF NOT EXISTS total_credits_purchased INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_credits_burned INTEGER DEFAULT 0;

-- A7) API Key Deliveries - temporary storage for one-time key reveal
CREATE TABLE public.api_key_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.users_customers(id),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id),
  plaintext_key TEXT NOT NULL, -- Stored temporarily, encrypted at rest by Supabase
  delivered BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_key_deliveries_customer ON public.api_key_deliveries(customer_id);
CREATE INDEX idx_api_key_deliveries_expires ON public.api_key_deliveries(expires_at);

-- A8) Rate Limit Tracking
CREATE TABLE public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id),
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(api_key_id, window_start)
);

CREATE INDEX idx_rate_limits_key_window ON public.rate_limits(api_key_id, window_start);

-- =============================================
-- TRIGGERS: Prevent mutations on insert-only tables
-- =============================================

CREATE OR REPLACE FUNCTION public.prevent_mutations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'UPDATE and DELETE operations are not allowed on this table (insert-only ledger)';
  RETURN NULL;
END;
$$;

-- Apply to api_requests
CREATE TRIGGER prevent_api_requests_mutations
  BEFORE UPDATE OR DELETE ON public.api_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_mutations();

-- Apply to credit_events
CREATE TRIGGER prevent_credit_events_mutations
  BEFORE UPDATE OR DELETE ON public.credit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_mutations();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- api_keys RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to api_keys"
  ON public.api_keys FOR ALL
  USING (true)
  WITH CHECK (true);

-- endpoint_costs RLS (public read)
ALTER TABLE public.endpoint_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read endpoint_costs"
  ON public.endpoint_costs FOR SELECT
  USING (true);

-- api_requests RLS (insert-only, service role)
ALTER TABLE public.api_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to api_requests"
  ON public.api_requests FOR ALL
  USING (true)
  WITH CHECK (true);

-- credit_events RLS
ALTER TABLE public.credit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to credit_events"
  ON public.credit_events FOR ALL
  USING (true)
  WITH CHECK (true);

-- denylist RLS
ALTER TABLE public.denylist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to denylist"
  ON public.denylist FOR ALL
  USING (true)
  WITH CHECK (true);

-- api_key_deliveries RLS
ALTER TABLE public.api_key_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to api_key_deliveries"
  ON public.api_key_deliveries FOR ALL
  USING (true)
  WITH CHECK (true);

-- rate_limits RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to rate_limits"
  ON public.rate_limits FOR ALL
  USING (true)
  WITH CHECK (true);