-- Create swap_orders table
CREATE TABLE IF NOT EXISTS public.swap_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_payment_id uuid,
  network text NOT NULL,
  asset_in text NOT NULL,
  amount_in numeric NOT NULL,
  asset_out text NOT NULL,
  expected_amount_out numeric,
  min_amount_out numeric,
  slippage_bps integer,
  gas_est_usd numeric,
  status text NOT NULL DEFAULT 'planned',
  tx_hash text,
  failure_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.swap_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to swap_orders" ON public.swap_orders;
CREATE POLICY "Service role full access to swap_orders"
  ON public.swap_orders FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_swap_orders_status ON public.swap_orders(status, created_at);

-- Create treasury_routes table
CREATE TABLE IF NOT EXISTS public.treasury_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_network text NOT NULL,
  to_network text NOT NULL DEFAULT 'base',
  asset_in text NOT NULL,
  asset_out text NOT NULL DEFAULT 'ETH',
  strategy text NOT NULL DEFAULT 'direct',
  is_active boolean DEFAULT true,
  max_slippage_bps integer DEFAULT 50,
  max_gas_usd numeric DEFAULT 2.0,
  min_amount_usd numeric DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.treasury_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to treasury_routes" ON public.treasury_routes;
CREATE POLICY "Service role full access to treasury_routes"
  ON public.treasury_routes FOR ALL
  USING (true) WITH CHECK (true);

-- Create treasury_balances table
CREATE TABLE IF NOT EXISTS public.treasury_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL,
  asset text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  balance_usd numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(network, asset)
);

ALTER TABLE public.treasury_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to treasury_balances" ON public.treasury_balances;
CREATE POLICY "Service role full access to treasury_balances"
  ON public.treasury_balances FOR ALL
  USING (true) WITH CHECK (true);

-- Create source_discovery_queue
CREATE TABLE IF NOT EXISTS public.source_discovery_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_topic text NOT NULL,
  candidate_url text NOT NULL,
  candidate_type text NOT NULL,
  confidence numeric DEFAULT 0.5,
  status text NOT NULL DEFAULT 'queued',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.source_discovery_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to source_discovery_queue" ON public.source_discovery_queue;
CREATE POLICY "Service role full access to source_discovery_queue"
  ON public.source_discovery_queue FOR ALL
  USING (true) WITH CHECK (true);

-- Create webhook_endpoints table
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.users_customers(id),
  endpoint_url text UNIQUE NOT NULL,
  endpoint_secret_hash text NOT NULL,
  plan text DEFAULT 'starter',
  is_active boolean DEFAULT true,
  events_count integer DEFAULT 0,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to webhook_endpoints" ON public.webhook_endpoints;
CREATE POLICY "Service role full access to webhook_endpoints"
  ON public.webhook_endpoints FOR ALL
  USING (true) WITH CHECK (true);

-- Create webhook_events table
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event_type text,
  payload jsonb NOT NULL,
  headers jsonb,
  signature_valid boolean,
  replayed boolean DEFAULT false,
  replayed_at timestamptz,
  replay_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to webhook_events" ON public.webhook_events;
CREATE POLICY "Service role full access to webhook_events"
  ON public.webhook_events FOR ALL
  USING (true) WITH CHECK (true);

-- Add quota tracking to api_keys
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS plan text DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS quota_monthly integer DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS used_monthly integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quota_reset_at timestamptz;

-- Update offers table
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS pricing_model jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fulfillment_type text DEFAULT 'api_key';

-- Add fulfillment tracking columns
ALTER TABLE public.fulfillment_jobs
  ADD COLUMN IF NOT EXISTS output jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fulfillment_type text;

-- Add opportunity columns
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS signal_id_v2 uuid,
  ADD COLUMN IF NOT EXISTS est_value_usd numeric,
  ADD COLUMN IF NOT EXISTS risk_score numeric DEFAULT 0;

-- Add missing columns to offer_sources
ALTER TABLE public.offer_sources
  ADD COLUMN IF NOT EXISTS query text,
  ADD COLUMN IF NOT EXISTS query_keywords text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS health_score numeric DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_count integer DEFAULT 0;