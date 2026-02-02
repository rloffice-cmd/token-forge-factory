-- =====================================================
-- SELF-AUDIT BRAIN TABLES
-- =====================================================

-- Decision Traces: Every scoring/routing decision with full context
CREATE TABLE IF NOT EXISTS public.decision_traces (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL, -- 'signal', 'opportunity', 'lead', 'checkout', 'outreach'
  entity_id uuid,
  source_url text,
  
  -- Intent & Pain
  intent text, -- NOISE, DISCUSSION, CURIOSITY, ACTIVE_PAIN, BUYING_SIGNAL
  pain_score integer,
  
  -- Trust
  trust_score integer,
  trust_cap_applied boolean DEFAULT false,
  interaction_count integer DEFAULT 0,
  free_value_events_count_24h integer DEFAULT 0,
  free_value_events_count_30d integer DEFAULT 0,
  
  -- Throttle
  throttle_state text, -- ON, OFF
  throttle_until timestamp with time zone,
  
  -- Decision
  decision text NOT NULL, -- SILENT, FREE_ONLY, PAID_OK, OUTREACH, BLOCKED
  reason_codes text[] DEFAULT '{}',
  
  -- Context
  offer_id uuid,
  platform text,
  actor_fingerprint text, -- platform + author hash for identity tracking
  
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_decision_traces_created ON public.decision_traces(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_traces_decision ON public.decision_traces(decision);
CREATE INDEX IF NOT EXISTS idx_decision_traces_actor ON public.decision_traces(actor_fingerprint);

-- Enable RLS
ALTER TABLE public.decision_traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to decision_traces" ON public.decision_traces FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- ACTOR PROFILES: Track interaction history per actor
-- =====================================================
CREATE TABLE IF NOT EXISTS public.actor_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fingerprint text NOT NULL UNIQUE, -- platform + author_hash
  platform text NOT NULL,
  author text,
  
  -- Interaction counts
  interaction_count_30d integer DEFAULT 0,
  free_value_events_count integer DEFAULT 0,
  outreach_received_count integer DEFAULT 0,
  
  -- Trust history
  highest_trust_score integer DEFAULT 50,
  has_paid boolean DEFAULT false,
  first_payment_at timestamp with time zone,
  total_paid_usd numeric DEFAULT 0,
  
  -- Timestamps
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actor_profiles_fingerprint ON public.actor_profiles(fingerprint);
CREATE INDEX IF NOT EXISTS idx_actor_profiles_platform ON public.actor_profiles(platform);

ALTER TABLE public.actor_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to actor_profiles" ON public.actor_profiles FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- SELF AUDIT RUNS: Track each audit cycle
-- =====================================================
CREATE TABLE IF NOT EXISTS public.self_audit_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_type text NOT NULL, -- 'scheduled', 'manual', 'triggered'
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  
  -- KPI Snapshot
  kpi_snapshot jsonb DEFAULT '{}'::jsonb,
  
  -- Findings
  anomalies_found integer DEFAULT 0,
  hypotheses jsonb DEFAULT '[]'::jsonb,
  
  -- Actions
  patches_proposed integer DEFAULT 0,
  patches_approved integer DEFAULT 0,
  patches_deployed integer DEFAULT 0,
  
  -- Result
  status text DEFAULT 'running', -- running, completed, failed
  summary text,
  
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.self_audit_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to self_audit_runs" ON public.self_audit_runs FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- PATCH PROPOSALS: Track proposed fixes
-- =====================================================
CREATE TABLE IF NOT EXISTS public.patch_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_run_id uuid REFERENCES public.self_audit_runs(id),
  
  -- Hypothesis
  hypothesis text NOT NULL,
  bug_type text NOT NULL, -- 'logic', 'data', 'commercial'
  severity integer DEFAULT 5, -- 1-10
  
  -- Evidence
  evidence_queries text[],
  evidence_results jsonb DEFAULT '{}'::jsonb,
  confidence numeric DEFAULT 0.7,
  
  -- Patch
  patch_type text, -- 'config', 'threshold', 'text', 'code'
  patch_target text, -- file/table/config key
  patch_diff text,
  rollback_plan text,
  
  -- Expected impact
  expected_impact jsonb DEFAULT '{}'::jsonb,
  expected_risk text,
  
  -- Status
  status text DEFAULT 'proposed', -- proposed, approved, deployed, verified, failed, rolled_back
  approved_at timestamp with time zone,
  deployed_at timestamp with time zone,
  verified_at timestamp with time zone,
  
  -- Results
  actual_impact jsonb DEFAULT '{}'::jsonb,
  verification_result text,
  
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patch_proposals_status ON public.patch_proposals(status);
CREATE INDEX IF NOT EXISTS idx_patch_proposals_audit_run ON public.patch_proposals(audit_run_id);

ALTER TABLE public.patch_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to patch_proposals" ON public.patch_proposals FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- Add throttle escalation tracking to brain_settings
-- =====================================================
ALTER TABLE public.brain_settings 
ADD COLUMN IF NOT EXISTS throttle_count_7d integer DEFAULT 0;

ALTER TABLE public.brain_settings 
ADD COLUMN IF NOT EXISTS last_throttle_reset_at timestamp with time zone DEFAULT now();