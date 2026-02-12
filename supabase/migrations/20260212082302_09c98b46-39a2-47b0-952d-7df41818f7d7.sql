
-- Add EV routing columns to m2m_partners
ALTER TABLE public.m2m_partners 
  ADD COLUMN IF NOT EXISTS commission_value_usd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_conv_rate numeric DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS ev_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS testing_phase boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS testing_leads_sent integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS niche_winner boolean DEFAULT false;

-- Populate commission_value_usd from existing commission_rate for active partners
-- (commission_rate was previously used as a percentage, commission_value_usd is the flat USD value per conversion)
