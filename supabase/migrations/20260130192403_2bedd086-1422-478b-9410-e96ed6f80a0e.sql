-- Data-to-Token Factory Database Schema
-- Complete schema with all required tables

-- Tasks table - stores task definitions with policy
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  policy_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Jobs table - stores job executions
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'CREATED',
  score NUMERIC,
  iteration INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Artifacts table - stores all artifacts (code, tests, reports)
CREATE TABLE public.artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Treasury ledger - tracks token rewards
CREATE TABLE public.treasury_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset TEXT NOT NULL DEFAULT 'DTF-TOKEN',
  amount NUMERIC NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Audit logs - tracks all pipeline actions
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row Level Security on all tables
-- For MVP, we allow public read/write (no auth required)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Public access policies for MVP (no authentication required)
CREATE POLICY "Allow public read tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Allow public insert tasks" ON public.tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update tasks" ON public.tasks FOR UPDATE USING (true);

CREATE POLICY "Allow public read jobs" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "Allow public insert jobs" ON public.jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update jobs" ON public.jobs FOR UPDATE USING (true);

CREATE POLICY "Allow public read artifacts" ON public.artifacts FOR SELECT USING (true);
CREATE POLICY "Allow public insert artifacts" ON public.artifacts FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read treasury" ON public.treasury_ledger FOR SELECT USING (true);
CREATE POLICY "Allow public insert treasury" ON public.treasury_ledger FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read audit_logs" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert audit_logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_jobs_task_id ON public.jobs(task_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_created_at ON public.jobs(created_at DESC);
CREATE INDEX idx_artifacts_job_id ON public.artifacts(job_id);
CREATE INDEX idx_artifacts_type ON public.artifacts(type);
CREATE INDEX idx_treasury_job_id ON public.treasury_ledger(job_id);
CREATE INDEX idx_audit_logs_job_id ON public.audit_logs(job_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for jobs updated_at
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default task (Date Extraction Forensic Auditor)
INSERT INTO public.tasks (id, name, policy_json) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Date Extraction Forensic Auditor',
  '{
    "function_name": "extract_iso_dates",
    "input_type": "str",
    "output_type": "list[str]",
    "rules": [
      "Extract only ISO-8601 format: YYYY-MM-DD",
      "Ambiguity = REJECT (return empty list)",
      "Invalid dates = REJECT",
      "Date range: 1900-01-01 to 2100-12-31",
      "None or empty string => []",
      "Output: unique list, order of appearance"
    ],
    "forbidden": [
      "No guessing dates",
      "No DD/MM or MM/DD interpretation",
      "No external libraries (only re, datetime)"
    ],
    "date_range": {
      "min": "1900-01-01",
      "max": "2100-12-31"
    }
  }'::jsonb
);

-- Enable realtime for jobs table
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;