-- Self-Healing Brain v2 Schema Migration
-- ================================================

-- 1) self_heal_policies - Truth Contracts
CREATE TABLE IF NOT EXISTS public.self_heal_policies (
  id boolean PRIMARY KEY DEFAULT true,
  policy_version text NOT NULL DEFAULT 'v2.0.0',
  identity_canon jsonb NOT NULL DEFAULT '{
    "actor_fingerprint_rule": "platform::author (NO URL hash)",
    "lead_key_rule": "context key for thread/session, NOT identity",
    "forbidden": ["storing lead_key in actor_profiles.fingerprint"],
    "allowed_lead_key_locations": ["decision_traces", "free_value_events", "actor_lead_links"]
  }'::jsonb,
  event_semantics jsonb NOT NULL DEFAULT '{
    "free_value_event_increments": ["free_value_events_count"],
    "interaction_count_increments_on": ["new demand_signal processed", "outreach delivered", "reply/engagement recorded"],
    "forbidden": ["auto-increment interaction_count on time_on_page_30s"]
  }'::jsonb,
  url_canon jsonb NOT NULL DEFAULT '{
    "normalization": "remove protocol diff, query, fragment, trailing slash",
    "hash_algorithm": "SHA-256 truncated to 16 hex chars",
    "forbidden": ["32-bit homebrew hash"]
  }'::jsonb,
  abuse_policy jsonb NOT NULL DEFAULT '{
    "require_trusted_lead_key_or_signed_token": true,
    "rate_limit_by": ["session_id", "ip", "event_type"],
    "dedup_window_minutes": 10,
    "max_events_per_session_per_hour": 100
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton_policy CHECK (id = true)
);

-- Enable RLS
ALTER TABLE public.self_heal_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to self_heal_policies" 
ON public.self_heal_policies FOR ALL
USING (true) WITH CHECK (true);

-- 2) self_heal_patches - Track deployed patches
CREATE TABLE IF NOT EXISTS public.self_heal_patches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_proposal_id uuid REFERENCES public.patch_proposals(id),
  deployed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'deployed' CHECK (status IN ('deployed', 'rolled_back', 'failed', 'verified')),
  canary_percent int NOT NULL DEFAULT 10,
  verify_window_hours int NOT NULL DEFAULT 12,
  kpi_before jsonb NOT NULL DEFAULT '{}'::jsonb,
  kpi_after jsonb,
  rollback_reason text,
  prior_config jsonb,
  verification_due_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.self_heal_patches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to self_heal_patches"
ON public.self_heal_patches FOR ALL
USING (true) WITH CHECK (true);

-- 3) actor_lead_links - Map actor_fingerprint to lead_key with confidence
CREATE TABLE IF NOT EXISTS public.actor_lead_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_fingerprint text NOT NULL,
  lead_key text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0.5,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(actor_fingerprint, lead_key)
);

CREATE INDEX IF NOT EXISTS idx_actor_lead_links_fingerprint ON public.actor_lead_links(actor_fingerprint);
CREATE INDEX IF NOT EXISTS idx_actor_lead_links_lead_key ON public.actor_lead_links(lead_key);

ALTER TABLE public.actor_lead_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to actor_lead_links"
ON public.actor_lead_links FOR ALL
USING (true) WITH CHECK (true);

-- 4) self_heal_flags - Feature flags for canary deployments
CREATE TABLE IF NOT EXISTS public.self_heal_flags (
  flag_name text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  rollout_percent int NOT NULL DEFAULT 0 CHECK (rollout_percent >= 0 AND rollout_percent <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.self_heal_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to self_heal_flags"
ON public.self_heal_flags FOR ALL
USING (true) WITH CHECK (true);

-- 5) self_heal_runs - Audit trail of healing runs
CREATE TABLE IF NOT EXISTS public.self_heal_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL DEFAULT 'scheduled' CHECK (run_type IN ('scheduled', 'manual', 'verification')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  kpi_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  anomalies_detected jsonb NOT NULL DEFAULT '[]'::jsonb,
  patches_proposed int NOT NULL DEFAULT 0,
  patches_deployed int NOT NULL DEFAULT 0,
  patches_rolled_back int NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_self_heal_runs_created ON public.self_heal_runs(created_at DESC);

ALTER TABLE public.self_heal_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to self_heal_runs"
ON public.self_heal_runs FOR ALL
USING (true) WITH CHECK (true);

-- 6) Update free_value_events with analysis columns (idempotent)
ALTER TABLE public.free_value_events 
  ADD COLUMN IF NOT EXISTS actor_fingerprint text,
  ADD COLUMN IF NOT EXISTS lead_key text,
  ADD COLUMN IF NOT EXISTS page_path text,
  ADD COLUMN IF NOT EXISTS ip_hash text,
  ADD COLUMN IF NOT EXISTS is_trusted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dedup_key text;

CREATE INDEX IF NOT EXISTS idx_free_value_events_session_type ON public.free_value_events(session_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_free_value_events_actor ON public.free_value_events(actor_fingerprint, created_at);
CREATE INDEX IF NOT EXISTS idx_free_value_events_dedup ON public.free_value_events(dedup_key);

-- 7) Update decision_traces with lead_key column
ALTER TABLE public.decision_traces
  ADD COLUMN IF NOT EXISTS lead_key text;

CREATE INDEX IF NOT EXISTS idx_decision_traces_actor ON public.decision_traces(actor_fingerprint, created_at);

-- 8) Update outreach_jobs with deferred status support
ALTER TABLE public.outreach_jobs
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

-- Add constraint if status doesn't have 'deferred' (idempotent approach - just ensure column exists)
CREATE INDEX IF NOT EXISTS idx_outreach_jobs_status_retry ON public.outreach_jobs(status, next_retry_at);

-- 9) Insert initial policy record
INSERT INTO public.self_heal_policies (id, policy_version)
VALUES (true, 'v2.0.0')
ON CONFLICT (id) DO UPDATE SET
  policy_version = 'v2.0.0',
  updated_at = now();

-- 10) Insert baseline feature flags
INSERT INTO public.self_heal_flags (flag_name, enabled, rollout_percent) VALUES
  ('sha256_url_hash', true, 100),
  ('actor_fingerprint_v2', true, 100),
  ('strict_event_semantics', true, 100),
  ('anti_abuse_free_value', true, 100)
ON CONFLICT (flag_name) DO NOTHING;