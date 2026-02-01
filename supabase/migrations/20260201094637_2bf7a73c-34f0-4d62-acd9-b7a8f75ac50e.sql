-- Create brain_settings singleton table
CREATE TABLE IF NOT EXISTS public.brain_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  brain_enabled boolean NOT NULL DEFAULT false,
  scan_enabled boolean NOT NULL DEFAULT true,
  auto_approve_threshold numeric NOT NULL DEFAULT 0.8,
  min_opportunity_value_usd numeric NOT NULL DEFAULT 20,
  auto_closing_enabled boolean NOT NULL DEFAULT true,
  outreach_enabled boolean NOT NULL DEFAULT false,
  max_daily_outreach integer NOT NULL DEFAULT 10,
  fulfillment_enabled boolean NOT NULL DEFAULT true,
  auto_sweep_enabled boolean NOT NULL DEFAULT false,
  auto_swap_enabled boolean NOT NULL DEFAULT false,
  treasury_target_network text NOT NULL DEFAULT 'base',
  treasury_target_asset text NOT NULL DEFAULT 'ETH',
  payout_wallet_address text,
  last_sweep_at timestamptz,
  session_rotation_enabled boolean NOT NULL DEFAULT true,
  session_ttl_hours integer NOT NULL DEFAULT 24,
  session_rotate_if_hours_left integer NOT NULL DEFAULT 2,
  max_value_per_tx_usd numeric NOT NULL DEFAULT 50,
  max_daily_value_usd numeric NOT NULL DEFAULT 200,
  max_daily_txs integer NOT NULL DEFAULT 20,
  allowed_contracts jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_functions jsonb NOT NULL DEFAULT '[]'::jsonb,
  emergency_stop boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brain_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to brain_settings" ON public.brain_settings;
CREATE POLICY "Service role full access to brain_settings"
  ON public.brain_settings FOR ALL
  USING (true) WITH CHECK (true);

-- Insert default settings
INSERT INTO public.brain_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- Create session_events if not exists
CREATE TABLE IF NOT EXISTS public.session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.zerodev_sessions(id),
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to session_events" ON public.session_events;
CREATE POLICY "Service role full access to session_events"
  ON public.session_events FOR ALL
  USING (true) WITH CHECK (true);