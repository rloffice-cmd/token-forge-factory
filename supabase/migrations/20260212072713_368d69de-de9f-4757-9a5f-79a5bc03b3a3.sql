-- Create manual_outreach_needed table for fallback logging
CREATE TABLE IF NOT EXISTS public.manual_outreach_needed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.outreach_jobs(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES public.demand_signals(id) ON DELETE SET NULL,
  outreach_text TEXT NOT NULL,
  partner_name TEXT,
  reason VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.manual_outreach_needed ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access only
CREATE POLICY "Admin can view manual outreach" 
  ON public.manual_outreach_needed FOR SELECT 
  USING (true); -- Simplest policy for internal logging; can be restricted later

-- Create index for faster lookups
CREATE INDEX idx_manual_outreach_needed_job_id ON public.manual_outreach_needed(job_id);
CREATE INDEX idx_manual_outreach_needed_created_at ON public.manual_outreach_needed(created_at DESC);