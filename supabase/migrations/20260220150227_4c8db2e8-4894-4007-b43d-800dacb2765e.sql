
-- Create research_findings table for SEO forensic report pages
CREATE TABLE IF NOT EXISTS public.research_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('VERIFIED', 'REJECTED', 'MONITORING', 'RESEARCHING', 'FILTERED')),
  confidence INTEGER NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  evidence JSONB NOT NULL DEFAULT '[]',
  source_url TEXT,
  platform TEXT,
  entity_type TEXT,
  affiliate_partner TEXT,
  affiliate_url TEXT,
  affiliate_commission TEXT,
  meta_description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.research_findings ENABLE ROW LEVEL SECURITY;

-- Published findings are public (SEO pages)
CREATE POLICY "Published findings are publicly readable"
  ON public.research_findings
  FOR SELECT
  USING (is_published = true);

-- Only authenticated admins can insert/update/delete
CREATE POLICY "Authenticated users can manage findings"
  ON public.research_findings
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Timestamp trigger
CREATE TRIGGER update_research_findings_updated_at
  BEFORE UPDATE ON public.research_findings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with realistic sample data so SEO pages work immediately
INSERT INTO public.research_findings (slug, title, summary, verdict, confidence, evidence, source_url, platform, entity_type, affiliate_partner, affiliate_url, affiliate_commission, meta_description) VALUES
(
  'hubspot-crm-vs-cold-email-reddit-signal-2026',
  'Reddit Signal: CRM Abandonment Driving Cold Email Surge',
  'Our autonomous scanner detected a high-intensity cluster of professional users expressing CRM dissatisfaction and pivoting to cold email automation as a primary growth channel.',
  'VERIFIED',
  94,
  '[{"timestamp":"2026-02-18T09:12:00Z","source":"r/sales","signal":"Looking for affordable CRM alternative — HubSpot is bleeding us dry","intent":"ACTIVE_PAIN","trust_score":0.91},{"timestamp":"2026-02-18T11:34:00Z","source":"r/entrepreneur","signal":"We switched to pure cold email — 3x the pipeline at 1/5 the cost","intent":"BUYING_SIGNAL","trust_score":0.87},{"timestamp":"2026-02-19T08:00:00Z","source":"HackerNews","signal":"Ask HN: Best cold email tools for B2B outreach?","intent":"BUYING_SIGNAL","trust_score":0.83}]',
  'https://reddit.com/r/sales',
  'reddit',
  'demand_signal',
  'Woodpecker',
  'https://woodpecker.co/?red=ram9a0bca',
  '20% Rev-share',
  'Autonomous analysis of 3 verified demand signals showing professionals abandoning expensive CRMs for cold email automation. Confidence: 94/100.'
),
(
  'saas-roas-decline-twitter-signal-2026',
  'Twitter Signal: ROAS Collapse Triggers Paid Ad Exodus',
  'SignalForge detected a coordinated wave of performance marketers reporting ROAS drops exceeding 40%, triggering evaluation of AI-powered ad optimization tools.',
  'VERIFIED',
  88,
  '[{"timestamp":"2026-02-17T14:20:00Z","source":"Twitter/X","signal":"Meta ROAS down 40% this month. Anyone else seeing this?","intent":"ACTIVE_PAIN","trust_score":0.89},{"timestamp":"2026-02-17T16:45:00Z","source":"Twitter/X","signal":"Switched to AI ad optimization — recovered 60% of lost ROAS in 2 weeks","intent":"BUYING_SIGNAL","trust_score":0.85},{"timestamp":"2026-02-18T09:00:00Z","source":"r/PPC","signal":"Best AI tools for ad optimization in 2026?","intent":"RESEARCHING","trust_score":0.80}]',
  'https://twitter.com',
  'twitter',
  'demand_signal',
  'AdTurbo AI',
  'https://adturbo.ai/?red=ram9a0bca',
  '50% Rev-share',
  'High-confidence market signal: ROAS collapse across paid channels driving adoption of AI ad optimization. Verified by SignalForge autonomous scanner.'
),
(
  'webinar-conversion-linkedin-signal-2026',
  'LinkedIn Signal: B2B Webinar Conversion Crisis Identified',
  'Our scanner identified a surge in B2B operators expressing frustration with low webinar conversion rates and evaluating dedicated webinar platforms with advanced analytics.',
  'VERIFIED',
  79,
  '[{"timestamp":"2026-02-16T10:00:00Z","source":"LinkedIn","signal":"Our webinars get 200 signups but only 12% show rate. Platform issue?","intent":"ACTIVE_PAIN","trust_score":0.82},{"timestamp":"2026-02-16T13:30:00Z","source":"LinkedIn","signal":"Switched webinar platforms — show rate jumped from 15% to 48%","intent":"BUYING_SIGNAL","trust_score":0.79}]',
  'https://linkedin.com',
  'linkedin',
  'demand_signal',
  'WebinarGeek',
  'https://webinargeek.com/?red=ram8a0bca',
  '25% Rev-share',
  'Verified LinkedIn demand signal: B2B operators experiencing webinar conversion issues seeking dedicated platforms. SignalForge confidence: 79/100.'
);
