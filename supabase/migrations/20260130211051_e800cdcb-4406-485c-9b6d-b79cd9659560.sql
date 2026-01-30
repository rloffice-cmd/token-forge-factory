-- Create failure_insights table for tracking job failures
CREATE TABLE IF NOT EXISTS public.failure_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  failure_type text NOT NULL, -- KILL_GATE | FAILED | PARSE_ERROR | SANDBOX_ERROR
  failure_category text, -- AMBIGUITY | INVALID_DATES | MALFORMED_ISO | etc
  root_cause text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0.7, -- 0..1
  pattern_signature text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS failure_insights_job_id_idx ON public.failure_insights(job_id);
CREATE INDEX IF NOT EXISTS failure_insights_task_id_idx ON public.failure_insights(task_id);
CREATE INDEX IF NOT EXISTS failure_insights_signature_idx ON public.failure_insights(pattern_signature);

-- Enable RLS
ALTER TABLE public.failure_insights ENABLE ROW LEVEL SECURITY;

-- RLS policies: public read and insert (no update/delete per security policy)
CREATE POLICY "Allow public read failure_insights"
ON public.failure_insights
FOR SELECT
USING (true);

CREATE POLICY "Allow public insert failure_insights"
ON public.failure_insights
FOR INSERT
WITH CHECK (true);