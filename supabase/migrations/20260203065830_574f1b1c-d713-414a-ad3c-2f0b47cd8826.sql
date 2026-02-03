-- Customer DNA Engine: Core profile table for adaptive sales intelligence
CREATE TABLE public.customer_dna (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_fingerprint text NOT NULL UNIQUE,
  
  -- Trust & Engagement Metrics
  trust_level integer NOT NULL DEFAULT 30,
  curiosity_level integer NOT NULL DEFAULT 50,
  engagement_velocity numeric NOT NULL DEFAULT 0,
  
  -- Psychological Profile
  fear_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  buying_style text NOT NULL DEFAULT 'unknown', -- cautious | explorer | fast-buyer | skeptic | unknown
  technical_level text NOT NULL DEFAULT 'unknown', -- beginner | intermediate | advanced | unknown
  
  -- Conversion Metrics
  time_to_value boolean NOT NULL DEFAULT false,
  payment_resistance_score integer NOT NULL DEFAULT 50,
  objections_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Predictions
  lifetime_value_prediction numeric DEFAULT 0,
  churn_risk numeric DEFAULT 0.5,
  
  -- Preferred Channel & Communication
  preferred_channel text DEFAULT 'telegram',
  last_positive_interaction_at timestamp with time zone,
  last_negative_signal_at timestamp with time zone,
  
  -- Stats
  total_interactions integer NOT NULL DEFAULT 0,
  total_value_received integer NOT NULL DEFAULT 0,
  total_paid_usd numeric NOT NULL DEFAULT 0,
  
  -- Timestamps
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_dna ENABLE ROW LEVEL SECURITY;

-- Service role only access
CREATE POLICY "Service role full access to customer_dna"
  ON public.customer_dna
  AS RESTRICTIVE
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for fast fingerprint lookups
CREATE INDEX idx_customer_dna_fingerprint ON public.customer_dna(actor_fingerprint);
CREATE INDEX idx_customer_dna_trust_level ON public.customer_dna(trust_level);
CREATE INDEX idx_customer_dna_buying_style ON public.customer_dna(buying_style);

-- Trigger for updated_at
CREATE TRIGGER update_customer_dna_updated_at
  BEFORE UPDATE ON public.customer_dna
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add new columns to decision_traces for DNA tracking
ALTER TABLE public.decision_traces 
  ADD COLUMN IF NOT EXISTS buying_style text,
  ADD COLUMN IF NOT EXISTS fear_detected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS safe_mode_activated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dna_score integer,
  ADD COLUMN IF NOT EXISTS emotional_state text;