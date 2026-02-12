
-- Auto Leads: discovered targets for autonomous outreach
CREATE TABLE public.auto_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  lead_category TEXT NOT NULL,
  matched_partner TEXT,
  source TEXT NOT NULL DEFAULT 'hunter',
  source_url TEXT,
  confidence NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'discovered',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  dry_run BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hunter Activity Log: forensic audit trail
CREATE TABLE public.hunter_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  lead_id UUID REFERENCES public.auto_leads(id),
  partner_name TEXT,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'info',
  dry_run BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hunter Settings: Monster Mode + config
CREATE TABLE public.hunter_settings (
  id BOOLEAN NOT NULL DEFAULT true PRIMARY KEY,
  monster_mode BOOLEAN NOT NULL DEFAULT false,
  dry_run_mode BOOLEAN NOT NULL DEFAULT true,
  daily_limit INTEGER NOT NULL DEFAULT 50,
  sends_today INTEGER NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at TIMESTAMPTZ,
  domain TEXT NOT NULL DEFAULT 'getsignalforge.com',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.hunter_settings (id, monster_mode, dry_run_mode, daily_limit)
VALUES (true, false, true, 50);

-- Enable RLS
ALTER TABLE public.auto_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hunter_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hunter_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies: service_role only for writes, allow reads for authenticated
CREATE POLICY "Allow read auto_leads" ON public.auto_leads FOR SELECT USING (true);
CREATE POLICY "Service role insert auto_leads" ON public.auto_leads FOR INSERT WITH CHECK (
  (SELECT current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role'
);
CREATE POLICY "Service role update auto_leads" ON public.auto_leads FOR UPDATE USING (
  (SELECT current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role'
);

CREATE POLICY "Allow read hunter_activity_log" ON public.hunter_activity_log FOR SELECT USING (true);
CREATE POLICY "Service role insert hunter_activity_log" ON public.hunter_activity_log FOR INSERT WITH CHECK (
  (SELECT current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role'
);

CREATE POLICY "Allow read hunter_settings" ON public.hunter_settings FOR SELECT USING (true);
CREATE POLICY "Service role update hunter_settings" ON public.hunter_settings FOR UPDATE USING (
  (SELECT current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role'
);

-- Indexes for performance
CREATE INDEX idx_auto_leads_status ON public.auto_leads(status);
CREATE INDEX idx_auto_leads_category ON public.auto_leads(lead_category);
CREATE INDEX idx_auto_leads_email ON public.auto_leads(email);
CREATE INDEX idx_hunter_activity_created ON public.hunter_activity_log(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_auto_leads_updated_at
  BEFORE UPDATE ON public.auto_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hunter_settings_updated_at
  BEFORE UPDATE ON public.hunter_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
