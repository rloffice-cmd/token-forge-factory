-- Outreach Jobs: what to send, where, status tracking
CREATE TABLE IF NOT EXISTS public.outreach_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'unknown',
  intent_topic TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0,
  lead_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  draft_text TEXT NOT NULL DEFAULT '',
  revised_text TEXT,
  channel TEXT NOT NULL DEFAULT 'telegram' CHECK (channel IN ('telegram')),
  destination TEXT NOT NULL DEFAULT 'telegram',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','gated','sending','sent','failed','dead')),
  gate_fail_reason TEXT,
  provider_message_id TEXT,
  provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_jobs_status_created ON public.outreach_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_jobs_retry ON public.outreach_jobs(status, next_retry_at) WHERE status = 'failed';

-- Simple rate-limit table: daily send caps
CREATE TABLE IF NOT EXISTS public.outreach_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  limit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sent_count INTEGER NOT NULL DEFAULT 0,
  cap_count INTEGER NOT NULL DEFAULT 20,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(limit_date)
);

-- Updated-at triggers
DROP TRIGGER IF EXISTS update_outreach_jobs_updated_at ON public.outreach_jobs;
CREATE TRIGGER update_outreach_jobs_updated_at
  BEFORE UPDATE ON public.outreach_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_outreach_limits_updated_at ON public.outreach_limits;
CREATE TRIGGER update_outreach_limits_updated_at
  BEFORE UPDATE ON public.outreach_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS (locked to service role only)
ALTER TABLE public.outreach_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access outreach_jobs"
  ON public.outreach_jobs AS RESTRICTIVE
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service role full access outreach_limits"
  ON public.outreach_limits AS RESTRICTIVE
  FOR ALL USING (true) WITH CHECK (true);